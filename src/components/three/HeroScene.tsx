"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Matrix4, PerspectiveCamera, PMREMGenerator, Quaternion, Vector3 } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getLenis } from "@/hooks/useLenis";
import {
  CITIES,
  CITY_HEADINGS,
  CITY_VIEW,
  EARTH_RADIUS,
  STAGES,
  STAGE_POSES,
  SUN_DIRECTION,
  UNIPOLE_SCALE,
  boardYaw,
  latLonToVector,
  surfaceFrame,
  surfaceUp,
} from "./hero/geo";
import { Atmosphere, EarthSurface, StarField, Sun } from "./hero/EarthGlobe";
import { CitySite } from "./hero/CitySite";

/** Tall scroll track so each city transition is long and gentle. */
const SCROLL_HEIGHT = 1150;
const BACKGROUND = "#02060f";
/**
 * Natural frequency of the critically damped camera spring (rad/s). Lower is
 * softer; ~1.9 settles in ≈2.5 s with no overshoot or oscillation.
 */
const SPRING = 1.6;
/**
 * Share of the hero scroll track used by the city journey. The remainder is a
 * hold on the final unipole, so the camera has fully arrived (spring settled)
 * before the next section scrolls in.
 */
const JOURNEY_END = 0.94;
/** Share of each segment held still at either end (city "hold"). */
const HOLD = 0.16;
/**
 * City label is scrubbed by the camera's distance (in stages) to the nearest
 * city: it starts building at LABEL_START and is complete by LABEL_FULL,
 * i.e. just as the camera settles into the city hold.
 */
const LABEL_START = 0.42;
const LABEL_FULL = 0.14;
const LABEL_ACCENT = "#f07a4a";
/** Fraction of the viewport height the scene is pushed down on portrait screens. */
const PORTRAIT_SHIFT = 0.08;
const UP_Y = new Vector3(0, 1, 0);

/**
 * Label anchor: the upper right edge of each board (model units → world),
 * using the same basis and yaw as CitySite so it sits exactly on the board.
 */
const LABEL_ANCHORS = CITIES.map((city, index) => {
  const frame = surfaceFrame(city.lat, city.lon);
  const basis = new Matrix4().makeBasis(frame.east, frame.up, frame.north.clone().negate());
  const q = new Quaternion().setFromRotationMatrix(basis);
  q.multiply(new Quaternion().setFromAxisAngle(UP_Y, boardYaw(index)));
  return new Vector3(0.5, 1.06, 0.1)
    .multiplyScalar(UNIPOLE_SCALE)
    .applyQuaternion(q)
    .add(latLonToVector(city.lat, city.lon, EARTH_RADIUS));
});
const CITY_UPS = CITIES.map((city) => surfaceUp(city.lat, city.lon));

type RigHooks = {
  onStage: (index: number) => void;
  /** Switch label content to a city (1-based stage index). */
  setLabelCity: (index: number) => void;
  /** Scrub the label timeline (0 hidden → 1 fully shown). */
  setLabelProgress: (progress: number) => void;
  /** Keep the text inside the viewport (connector stays on the board). */
  fitLabel: (anchorX: number, viewportWidth: number) => void;
};

function smoothstep(t: number) {
  const v = MathUtils.clamp(t, 0, 1);
  return v * v * (3 - 2 * v);
}

/** Sine in-out: zero velocity at both ends, no abrupt acceleration. */
function easeInOutSine(t: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * MathUtils.clamp(t, 0, 1));
}

/** Smooth bump 0→1→0 with zero slope at both ends. */
function bump(t: number) {
  const s = Math.sin(Math.PI * MathUtils.clamp(t, 0, 1));
  return s * s;
}

/**
 * The single camera controller.
 *
 * ScrollTrigger only reports the raw scroll progress (targetRef). Damping is a
 * critically damped spring integrated here, inside the render loop, so the
 * camera is updated in the same frame it is drawn — no ticker mismatch
 * between GSAP and React Three Fiber, no overshoot, and identical paths when
 * scrolling forwards or backwards.
 *
 * City → city moves are orbit-based: the camera always looks at a focus point
 * that glides along the ground from one city to the next, while distance and
 * elevation rise and fall (zoom out → travel/rotate → zoom in). It can never
 * swing away from the route or look straight down.
 */
function CameraRig({
  targetRef,
  reducedMotion,
  cloudOpacityRef,
  nearRef,
  hooksRef,
  labelRef,
}: {
  targetRef: React.RefObject<number>;
  reducedMotion: boolean;
  cloudOpacityRef: React.RefObject<number>;
  nearRef: React.RefObject<number>;
  hooksRef: React.RefObject<RigHooks | null>;
  labelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const spring = useRef({ x: 0, v: 0, stage: 0, labelCity: -1, labelProgress: -1 });
  const scratchRef = useRef({
    dirA: new Vector3(),
    dirB: new Vector3(),
    dir: new Vector3(),
    target: new Vector3(),
    east: new Vector3(),
    north: new Vector3(),
    look: new Vector3(),
    projected: new Vector3(),
    rotation: new Quaternion(),
    partial: new Quaternion(),
    identity: new Quaternion(),
  });

  useFrame(({ camera, size }, delta) => {
    if (camera instanceof PerspectiveCamera) {
      // Portrait screens need a wider lens to keep the horizon composition.
      const aspect = size.width / size.height;
      const fov = aspect < 0.8 ? 62 : aspect < 1.2 ? 50 : 36;
      const shift = aspect < 0.8 ? Math.round(size.height * PORTRAIT_SHIFT) : 0;
      const offset = camera.view?.enabled ? -camera.view.offsetY : 0;
      if (camera.fov !== fov || offset !== shift || (shift && camera.view?.fullWidth !== size.width)) {
        camera.fov = fov;
        if (shift) camera.setViewOffset(size.width, size.height, 0, -shift, size.width, size.height);
        else camera.clearViewOffset();
        camera.updateProjectionMatrix();
      }
    }

    // Critically damped spring towards the scroll progress (sub-stepped for stability).
    const s = spring.current;
    const goal = MathUtils.clamp(targetRef.current ?? 0, 0, 1);
    if (reducedMotion) {
      s.x = goal;
      s.v = 0;
    } else {
      const dt = Math.min(delta, 0.1);
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        s.v += (SPRING * SPRING * (goal - s.x) - 2 * SPRING * s.v) * h;
        s.x += s.v * h;
      }
    }
    const value = MathUtils.clamp(s.x, 0, 1);

    const last = STAGE_POSES.length - 1;
    const timeline = value * last;
    const from = Math.min(Math.floor(timeline), last - 1);
    const fraction = MathUtils.clamp(timeline - from, 0, 1);
    const e = MathUtils.clamp((fraction - HOLD) / (1 - 2 * HOLD), 0, 1);
    const { dirA, dirB, dir, target, east, north, look, projected, rotation, partial, identity } = scratchRef.current;

    let altitude: number;
    if (from === 0) {
      // Overview → first city: descend along a great circle.
      const a = STAGE_POSES[0];
      const b = STAGE_POSES[1];
      const eased = easeInOutSine(e);
      dirA.copy(a.position).normalize();
      dirB.copy(b.position).normalize();
      rotation.setFromUnitVectors(dirA, dirB);
      partial.copy(identity).slerp(rotation, eased);
      dir.copy(dirA).applyQuaternion(partial);
      const radius = MathUtils.lerp(a.position.length(), b.position.length(), eased);
      target.lerpVectors(a.target, b.target, eased);
      camera.position.copy(dir).multiplyScalar(radius);
      altitude = radius - EARTH_RADIUS;
    } else {
      // City → city: orbit a focus point that travels along the ground.
      const ia = from - 1;
      const ib = from;
      const travel = easeInOutSine((e - 0.18) / 0.64);
      const lift = bump(e);

      rotation.setFromUnitVectors(CITY_UPS[ia], CITY_UPS[ib]);
      partial.copy(identity).slerp(rotation, travel);
      dir.copy(CITY_UPS[ia]).applyQuaternion(partial); // focus direction

      const ha = CITY_HEADINGS[ia];
      const turn = ((CITY_HEADINGS[ib] - ha + 540) % 360) - 180; // shortest way round
      const heading = MathUtils.degToRad(ha + turn * travel);
      const span = CITY_UPS[ia].angleTo(CITY_UPS[ib]) * EARTH_RADIUS;
      const distance = CITY_VIEW.distance + lift * (0.35 + span * 1.1);
      const elevation = MathUtils.degToRad(CITY_VIEW.elevation + lift * 24);

      east.crossVectors(UP_Y, dir).normalize();
      north.crossVectors(dir, east);
      look.copy(north).multiplyScalar(Math.cos(heading)).addScaledVector(east, Math.sin(heading));
      target.copy(dir).multiplyScalar(EARTH_RADIUS + CITY_VIEW.targetHeight);
      camera.position
        .copy(target)
        .addScaledVector(look, -Math.cos(elevation) * distance)
        .addScaledVector(dir, Math.sin(elevation) * distance);
      dir.copy(camera.position).normalize();
      altitude = camera.position.length() - EARTH_RADIUS;
    }

    camera.up.copy(dir);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    // Thin out clouds close to the ground so the cities stay readable.
    cloudOpacityRef.current = MathUtils.lerp(0.08, 1, smoothstep((altitude - 0.3) / 1.6));
    nearRef.current = 1 - smoothstep((altitude - 0.15) / 1.5);

    // Stage (navigation) and label state — callbacks fire only on change.
    const hooks = hooksRef.current;
    const nearest = Math.round(timeline);
    if (hooks && nearest !== s.stage) {
      s.stage = nearest;
      hooks.onStage(nearest);
    }
    // Label is driven by the same smoothed progress as the camera, so it
    // builds while approaching, is complete on arrival and reverses on exit.
    const labelProgress =
      nearest > 0 ? 1 - smoothstep((Math.abs(timeline - nearest) - LABEL_FULL) / (LABEL_START - LABEL_FULL)) : 0;
    if (hooks && labelProgress > 0 && nearest !== s.labelCity) {
      s.labelCity = nearest;
      hooks.setLabelCity(nearest);
    }
    if (hooks && Math.abs(labelProgress - s.labelProgress) > 0.0005) {
      s.labelProgress = labelProgress;
      hooks.setLabelProgress(labelProgress);
    }

    // Keep the label pinned to the active board (direct DOM write, no re-render).
    const label = labelRef.current;
    if (label && s.labelCity > 0 && labelProgress > 0) {
      projected.copy(LABEL_ANCHORS[s.labelCity - 1]).project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      label.style.visibility = projected.z < 1 ? "visible" : "hidden";
      hooks?.fitLabel(x, size.width);
    } else if (label && labelProgress === 0) {
      label.style.visibility = "hidden";
    }
  });

  return null;
}

/** Image-based lighting for the metal structures, generated locally (no HDR download). */
function SceneEnvironment() {
  const get = useThree((state) => state.get);

  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.32;
    return () => {
      scene.environment = null;
      target.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [get]);

  return null;
}

function GlobeWorld({
  targetRef,
  activeIndex,
  reducedMotion,
  hooksRef,
  labelRef,
}: {
  targetRef: React.RefObject<number>;
  activeIndex: number;
  reducedMotion: boolean;
  hooksRef: React.RefObject<RigHooks | null>;
  labelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const cloudOpacityRef = useRef(1);
  const nearRef = useRef(0);

  // Cool moonlight from above South India; warm dawn rim from the sun side.
  const moonPosition = useMemo(
    () => surfaceUp(14, 74).multiplyScalar(40).add(new Vector3(-8, 10, 6)),
    []
  );
  const sunPosition = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(60), []);

  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <SceneEnvironment />

      <hemisphereLight args={["#8fb6ff", "#0a1222", 0.35]} />
      <directionalLight position={moonPosition} intensity={0.9} color="#b9cdf5" />
      <directionalLight position={sunPosition} intensity={0.6} color="#ffb877" />

      <StarField />
      <Sun />
      <Atmosphere />

      <Suspense fallback={null}>
        <EarthSurface cloudOpacityRef={cloudOpacityRef} nearRef={nearRef} />
      </Suspense>

      {CITIES.map((city, index) => (
        <CitySite
          key={city.name}
          city={city}
          index={index}
          active={activeIndex === index + 1}
          reducedMotion={reducedMotion}
        />
      ))}

      <CameraRig
        targetRef={targetRef}
        reducedMotion={reducedMotion}
        cloudOpacityRef={cloudOpacityRef}
        nearRef={nearRef}
        hooksRef={hooksRef}
        labelRef={labelRef}
      />
    </>
  );
}

export function HeroScene() {
  const reduced = useReducedMotion();

  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(0);
  const hooksRef = useRef<RigHooks | null>(null);

  const labelRef = useRef<HTMLDivElement>(null);
  const labelInnerRef = useRef<HTMLDivElement>(null);
  const labelNameRef = useRef<HTMLDivElement>(null);
  const labelProjectsRef = useRef<HTMLDivElement>(null);
  const labelLineRef = useRef<HTMLDivElement>(null);
  const labelDotRef = useRef<HTMLSpanElement>(null);
  const labelPulseRef = useRef<HTMLSpanElement>(null);
  const labelVerticalRef = useRef<HTMLDivElement>(null);
  const labelTextRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [inView, setInView] = useState(true);

  // Every refresh starts at the hero overview: disable browser scroll
  // restoration and reset the scroll position before ScrollTrigger reads it.
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const toTop = () => {
      getLenis()?.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
    };
    toTop();
    // Some browsers restore late (around `load`); re-assert once then.
    if (document.readyState !== "complete") window.addEventListener("load", toTop, { once: true });
    return () => {
      window.removeEventListener("load", toTop);
      history.scrollRestoration = previous;
    };
  }, []);

  // ScrollTrigger reports raw progress only; the camera spring does the easing.
  useEffect(() => {
    const section = sectionRef.current;
    const copy = copyRef.current;
    if (!section || !copy) return;

    gsap.registerPlugin(ScrollTrigger);
    // Keep ScrollTrigger in lock-step with Lenis' smoothed scroll position.
    const offLenis = getLenis()?.on("scroll", ScrollTrigger.update);

    const context = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          targetRef.current = Math.min(1, self.progress / JOURNEY_END);
        },
        onRefresh: (self) => {
          targetRef.current = Math.min(1, self.progress / JOURNEY_END);
        },
      });
      targetRef.current = Math.min(1, trigger.progress / JOURNEY_END);

      // Hero copy eases away as the camera leaves the overview.
      gsap.to(copy, {
        autoAlpha: 0,
        y: reduced ? 0 : -36,
        ease: "power1.in",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${Math.round(window.innerHeight * 0.7)}`,
          scrub: reduced ? true : 1.2,
          invalidateOnRefresh: true,
        },
      });
    }, section);

    return () => {
      offLenis?.();
      context.revert();
    };
  }, [reduced]);

  // City label: one paused GSAP timeline (connector draws in, then the name
  // and project count fade up). The camera rig scrubs its progress each frame
  // from the camera's own progress — no ScrollTrigger, no extra loop.
  useEffect(() => {
    const inner = labelInnerRef.current;
    const name = labelNameRef.current;
    const projects = labelProjectsRef.current;
    const horizontal = labelLineRef.current;
    const vertical = labelVerticalRef.current;
    const corner = labelDotRef.current;
    const top = labelPulseRef.current;
    const text = labelTextRef.current;
    if (!inner || !name || !projects || !horizontal || !vertical || !corner || !top || !text) return;

    const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });
    timeline
      .fromTo(inner, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0)
      .fromTo(horizontal, { scaleX: 0 }, { scaleX: 1, duration: 0.22, ease: "power1.out" }, 0)
      .fromTo(corner, { scale: 0 }, { scale: 1, duration: 0.1, ease: "power1.out" }, 0.18)
      .fromTo(vertical, { scaleY: 0 }, { scaleY: 1, duration: 0.22, ease: "power1.out" }, 0.22)
      .fromTo(top, { scale: 0 }, { scale: 1, duration: 0.1, ease: "power1.out" }, 0.4)
      .fromTo(name, { autoAlpha: 0, y: reduced ? 0 : 14 }, { autoAlpha: 1, y: 0, duration: 0.38, ease: "power2.out" }, 0.42)
      .fromTo(projects, { autoAlpha: 0, y: reduced ? 0 : 10 }, { autoAlpha: 1, y: 0, duration: 0.36, ease: "power2.out" }, 0.56);
    timeline.progress(0);

    hooksRef.current = {
      onStage: (index) => setActiveIndex((current) => (current === index ? current : index)),
      setLabelCity: (index) => {
        const city = CITIES[index - 1];
        if (!city) return;
        name.textContent = city.name;
        projects.textContent = city.projects ? `${city.projects} projects completed` : "";
        projects.style.display = city.projects ? "block" : "none";
      },
      fitLabel: (anchorX, viewportWidth) => {
        // Transforms don't dirty layout, so these reads stay cheap per frame.
        const margin = 16;
        const left = anchorX + text.offsetLeft;
        const right = left + text.offsetWidth;
        const shift = Math.max(margin - left, Math.min(0, viewportWidth - margin - right));
        text.style.translate = `${shift.toFixed(1)}px 0`;
      },
      setLabelProgress: (progress) => {
        timeline.progress(reduced ? (progress > 0.5 ? 1 : 0) : progress);
      },
    };

    return () => {
      hooksRef.current = null;
      timeline.kill();
    };
  }, [reduced]);

  // Stop rendering the WebGL scene once the hero has scrolled out of view.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "200px 0px" }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const goToStage = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;

    const start =
      window.scrollY +
      section.getBoundingClientRect().top;

    const scrollable =
      section.offsetHeight - window.innerHeight;

    const destination =
      start +
      (index / (STAGES.length - 1)) * JOURNEY_END *
        scrollable;

    // Route through Lenis when active so the two scrollers don't fight.
    const lenis = getLenis();

    if (lenis) {
      lenis.scrollTo(destination, { immediate: reduced });
      return;
    }

    window.scrollTo({
      top: destination,
      behavior: reduced ? "instant" : "smooth",
    });
  };

  const fullSize: CSSProperties = {
    position: "absolute",
    inset: 0,
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Onepole advertising network"
      data-header-theme="dark"
      style={{
        position: "relative",
        height: `${SCROLL_HEIGHT}vh`,
        background: BACKGROUND,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          width: "100%",
          height: "100svh",
          overflow: "hidden",
          isolation: "isolate",
          background: BACKGROUND,
        }}
      >
        {/* 3D Earth */}
        <div style={{ ...fullSize, zIndex: 0 }}>
          <Canvas
            frameloop={inView ? "always" : "never"}
            dpr={[1, 1.5]}
            camera={{
              position: STAGE_POSES[0].position.toArray(),
              fov: 36,
              near: 0.01,
              far: 2000,
            }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: "high-performance",
            }}
            style={{
              width: "100%",
              height: "100%",
              touchAction: "pan-y",
            }}
          >
            <GlobeWorld
              targetRef={targetRef}
              activeIndex={activeIndex}
              reducedMotion={reduced}
              hooksRef={hooksRef}
              labelRef={labelRef}
            />
          </Canvas>
        </div>

        {/* Readability: soft top falloff behind the copy only */}
        <div
          style={{
            ...fullSize,
            zIndex: 1,
            pointerEvents: "none",
            background: `
              linear-gradient(
                180deg,
                rgba(2,6,15,.55) 0%,
                rgba(2,6,15,.12) 32%,
                transparent 55%
              )
            `,
          }}
        />

        {/* City label: name + project count above an orange elbow connector
            that ends on the active board (positioned by the camera rig). */}
        <div
          ref={labelRef}
          aria-live="polite"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            zIndex: 4,
            pointerEvents: "none",
            willChange: "transform",
            visibility: "hidden",
          }}
        >
          <div
            ref={labelInnerRef}
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              opacity: 0,
              visibility: "hidden",
              ["--reach" as string]: "clamp(44px, 6vw, 92px)",
              ["--rise" as string]: "clamp(40px, 7vh, 78px)",
            }}
          >
            {/* Horizontal run from the board out to the corner. */}
            <div
              ref={labelLineRef}
              style={{
                position: "absolute",
                left: 0,
                bottom: -1,
                width: "var(--reach)",
                height: 2,
                background: LABEL_ACCENT,
                transformOrigin: "0% 50%",
              }}
            />
            {/* Vertical run from the corner up to the text. */}
            <div
              ref={labelVerticalRef}
              style={{
                position: "absolute",
                left: "calc(var(--reach) - 1px)",
                bottom: 0,
                width: 2,
                height: "var(--rise)",
                background: LABEL_ACCENT,
                transformOrigin: "50% 100%",
              }}
            />
            {/* Corner endpoint. */}
            <span
              ref={labelDotRef}
              style={{
                position: "absolute",
                left: "calc(var(--reach) - 7px)",
                bottom: -7,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: LABEL_ACCENT,
              }}
            />
            {/* Top endpoint. */}
            <span
              ref={labelPulseRef}
              style={{
                position: "absolute",
                left: "calc(var(--reach) - 7px)",
                bottom: "calc(var(--rise) - 7px)",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: LABEL_ACCENT,
              }}
            />
            {/* Name and project count. */}
            <div
              ref={labelTextRef}
              style={{
                position: "absolute",
                left: "calc(var(--reach) - clamp(48px, 4.6vw, 96px))",
                bottom: "calc(var(--rise) + 12px)",
                whiteSpace: "nowrap",
                color: "#ffffff",
                textShadow: "0 2px 18px rgba(0,0,0,.45)",
              }}
            >
              <div
                ref={labelNameRef}
                style={{
                  fontSize: "clamp(30px, 4.2vw, 64px)",
                  fontWeight: 700,
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                }}
              />
              <div
                ref={labelProjectsRef}
                style={{
                  display: "none",
                  marginTop: 6,
                  fontSize: "clamp(14px, 1.55vw, 24px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                }}
              />
            </div>
          </div>
        </div>

        {/* Hero content — centred near the top, above the horizon */}
        <div
          ref={copyRef}
          style={{
            position: "absolute",
            zIndex: 3,
            top: "clamp(104px, 15vh, 150px)",
            left: 0,
            right: 0,
            marginInline: "auto",
            width: "min(760px, calc(100% - 40px))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            pointerEvents: "none",
            color: "#ffffff",
          }}
        >

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 3.6vw, 58px)",
              fontWeight: 600,
              lineHeight: 1.04,
              letterSpacing: "-0.045em",
              textShadow: "0 2px 24px rgba(0,0,0,.35)",
            }}
          >
            <span style={{ display: "block" }}>
              Onepole.
            </span>

            <span
              style={{
                display: "block",
                color: "#c9cfd8",
              }}
            >
              Maximum brand visibility.
            </span>
          </h1>


          <button
            onClick={() => goToStage(1)}
            style={{
              marginTop: 22,
              padding: "12px 20px",
              minHeight: 44,
              background: "rgba(8,13,23,.55)",
              border: "1px solid rgba(255,255,255,.6)",
              borderRadius: 999,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              pointerEvents: "auto",
              backdropFilter: "blur(12px)",
            }}
          >
            Explore Our Network &nbsp; →
          </button>
        </div>



        {/* Small-screen adjustments without separate CSS */}
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            html {
              scroll-behavior: auto;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
