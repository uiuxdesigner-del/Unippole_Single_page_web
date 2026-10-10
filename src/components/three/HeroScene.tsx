"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MathUtils,
  Matrix4,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Texture,
  Vector3,
  type Material,
  type Mesh,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getLenis, glideEasing, setHeroNavigator } from "@/hooks/useLenis";
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
import { Atmosphere, EarthSurface, StarField, Sun, preloadEarthTextures } from "./hero/EarthGlobe";
import { CitySite } from "./hero/CitySite";

const BACKGROUND = "#02060f";
/**
 * Natural frequency of the critically damped camera spring (rad/s). Lower is
 * softer; ~1.9 settles in ≈2.5 s with no overshoot or oscillation.
 */
const SPRING = 1.6;
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
/** Hero copy fades out over this much of the overview → Chennai move (stages). */
const COPY_FADE = 0.35;
/** Fraction of the viewport height the scene is pushed down on portrait screens. */
const PORTRAIT_SHIFT = 0.08;
const UP_Y = new Vector3(0, 1, 0);
const LAST_STAGE = STAGES.length - 1;
/** Seconds for one full city → city move (holds trimmed). */
const STEP_DURATION = 2.4;
/** Wheel events closer together than this belong to the same gesture. */
const WHEEL_GESTURE_GAP = 220;
/** Finger travel (px) that counts as one intentional swipe. */
const SWIPE_DISTANCE = 36;
/** "Skip 3D experience": target section and scroll duration. */
const SKIP_TARGET_ID = "unipole-types";
const SKIP_DURATION = 0.7;
/** Skip button → types section: cinematic scroll + hero dim (seconds). */
const SKIP_TRANSITION = 1.05;
/**
 * Scrolling with no wheel/touch/key input for this long (ms), and not a Lenis
 * smooth scroll, is treated as scrollbar dragging: no city animations.
 */
const INPUT_WINDOW = 1200;

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
  /** Hero heading/CTA visibility (1 at the overview → 0 once the camera leaves). */
  setCopyProgress: (progress: number) => void;
};

function smoothstep(t: number) {
  const v = MathUtils.clamp(t, 0, 1);
  return v * v * (3 - 2 * v);
}

/** Sine in-out: zero velocity at both ends, no abrupt acceleration. */
function easeInOutSine(t: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * MathUtils.clamp(t, 0, 1));
}

/** Same curve as GSAP's "power2.inOut" (for the Lenis scroll it pairs with). */
function easePower2InOut(t: number) {
  const v = MathUtils.clamp(t, 0, 1);
  return v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
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
  directRef,
  valueRef,
  busyRef,
  snapRef,
}: {
  targetRef: React.RefObject<number>;
  reducedMotion: boolean;
  cloudOpacityRef: React.RefObject<number>;
  nearRef: React.RefObject<number>;
  hooksRef: React.RefObject<RigHooks | null>;
  labelRef: React.RefObject<HTMLDivElement | null>;
  /** True while a step tween drives targetRef (already eased → no spring). */
  directRef: React.RefObject<boolean>;
  /** Progress the camera is actually showing (read by the step controller). */
  valueRef: React.RefObject<number>;
  /** Written each frame: camera spring, step tween or page scroll in motion. */
  busyRef: React.RefObject<boolean>;
  /** One-shot: jump the spring straight to the goal (used after a skip). */
  snapRef: React.RefObject<boolean>;
}) {
  const spring = useRef({ x: 0, v: 0, stage: 0, labelCity: -1, labelProgress: -1, copyProgress: -1 });
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
    lastPosition: new Vector3(),
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
    if (reducedMotion || directRef.current || snapRef.current) {
      snapRef.current = false;
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
    valueRef.current = value;

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

    // Busy = the view actually moved this frame (the spring settling inside a
    // city hold is invisible), a step is running, or the page is scrolling.
    const { lastPosition } = scratchRef.current;
    const moved = camera.position.distanceToSquared(lastPosition) > 1e-10;
    lastPosition.copy(camera.position);
    busyRef.current = moved || directRef.current || Boolean(getLenis()?.isScrolling);

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
    const copyProgress = 1 - smoothstep(timeline / COPY_FADE);
    if (hooks && Math.abs(copyProgress - s.copyProgress) > 0.001) {
      s.copyProgress = copyProgress;
      hooks.setCopyProgress(copyProgress);
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

/**
 * Mounted after every suspending resource (Earth textures) has resolved. It
 * uploads all textures and compiles every shader up front, then waits for a
 * few rendered frames so the camera rig, environment map and materials are in
 * place before the scene is revealed — no half-lit globe or broken models.
 */
function SceneReady({ onReady }: { onReady: () => void }) {
  const get = useThree((state) => state.get);

  useEffect(() => {
    const { gl, scene, camera } = get();
    let cancelled = false;
    let raf = 0;

    const textures = new Set<Texture>();
    scene.traverse((object) => {
      const material = (object as Mesh).material as Material | Material[] | undefined;
      if (!material) return;
      (Array.isArray(material) ? material : [material]).forEach((entry) => {
        Object.values(entry).forEach((value) => {
          if (value instanceof Texture) textures.add(value);
        });
        const uniforms = (entry as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms;
        if (uniforms) {
          Object.values(uniforms).forEach((uniform) => {
            if (uniform?.value instanceof Texture) textures.add(uniform.value);
          });
        }
      });
    });
    textures.forEach((texture) => gl.initTexture(texture));

    const reveal = () => {
      let frames = 0;
      const tick = () => {
        if (cancelled) return;
        frames += 1;
        if (frames >= 3) onReady();
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) reveal();
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [get, onReady]);

  return null;
}

/**
 * If the WebGL context or an asset fails, drop the 3D layer and still run the
 * hero entrance instead of leaving the loading veil up forever.
 */
class SceneErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Hero 3D scene failed to load", error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function GlobeWorld({
  targetRef,
  activeIndex,
  reducedMotion,
  hooksRef,
  labelRef,
  directRef,
  valueRef,
  snapRef,
  onReady,
}: {
  targetRef: React.RefObject<number>;
  activeIndex: number;
  reducedMotion: boolean;
  hooksRef: React.RefObject<RigHooks | null>;
  labelRef: React.RefObject<HTMLDivElement | null>;
  directRef: React.RefObject<boolean>;
  valueRef: React.RefObject<number>;
  snapRef: React.RefObject<boolean>;
  onReady: () => void;
}) {
  const cloudOpacityRef = useRef(1);
  const nearRef = useRef(0);
  const cameraBusyRef = useRef(true);

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

      {/* Suspends the whole world (see HeroScene) until the textures load. */}
      <EarthSurface cloudOpacityRef={cloudOpacityRef} nearRef={nearRef} cameraBusyRef={cameraBusyRef} />

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
        directRef={directRef}
        valueRef={valueRef}
        busyRef={cameraBusyRef}
        snapRef={snapRef}
      />

      <SceneReady onReady={onReady} />
    </>
  );
}

export function HeroScene() {
  preloadEarthTextures();
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

  // Step controller state (refs: read inside event handlers and useFrame).
  const steppingRef = useRef(false);
  const directRef = useRef(false);
  const valueRef = useRef(0);
  const readyRef = useRef(false);
  const stepToRef = useRef<((index: number) => void) | null>(null);
  const skippingRef = useRef(false);
  const snapRef = useRef(false);
  const skipRef = useRef<(() => void) | null>(null);
  const skipIconRef = useRef<HTMLSpanElement>(null);
  const skipFloatRef = useRef<HTMLSpanElement>(null);
  const skipGlowRef = useRef<HTMLSpanElement>(null);
  const skipHoverRef = useRef<gsap.core.Timeline | null>(null);
  const heroInnerRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);

  const veilRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const introPlayedRef = useRef(false);

  const handleReady = useCallback(() => {
    readyRef.current = true;
    setReady(true);
  }, []);

  // Entrance: runs once, only after SceneReady (or a scene failure) reports
  // in. The veil fades to reveal the finished globe while the hero copy
  // glides from the viewport centre to its resting position (transform only).
  useEffect(() => {
    const veil = veilRef.current;
    const intro = introRef.current;
    if (!ready || !veil || !intro || introPlayedRef.current) return;
    introPlayedRef.current = true;

    const startY = new DOMMatrixReadOnly(getComputedStyle(intro).transform).m42;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline({ defaults: { duration: instant ? 0 : 1.35, ease: "power3.inOut" } });
    timeline
      .fromTo(intro, { y: startY }, { y: 0, force3D: true, clearProps: "willChange" }, 0)
      .to(veil, { autoAlpha: 0 }, 0);

    return () => {
      // Unmount mid-animation: jump to the end state so nothing stays hidden.
      timeline.progress(1).kill();
    };
  }, [ready]);

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

  // Keep ScrollTrigger (used by the sections below) in step with Lenis.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const offLenis = getLenis()?.on("scroll", ScrollTrigger.update);
    return () => offLenis?.();
  }, []);

  // The hero is one viewport tall and its camera is driven by an internal
  // stage index, never by the page scroll position:
  //  - wheel / swipe / arrow keys while the hero fills the viewport move the
  //    camera exactly one city (GSAP tween, the page does not scroll);
  //  - past Tirunelveli (or above the overview) input scrolls the page as usual;
  //  - the scrollbar and header links are plain page navigation.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const proxy = { value: 0 };
    let tween: gsap.core.Tween | null = null;
    let lastWheel = 0;
    let lastWheelAbs = 0;
    let lastWheelDir = 0;
    let touchY = 0;
    let touchDecided = false;
    let touchCapture = false;
    let touchFired = false;
    let touchEdge: (() => void) | null = null;
    let settleTimer = 0;
    let navTimer = 0;
    /** City the camera is on (0 = overview). */
    let stage = Math.round(valueRef.current * LAST_STAGE);
    let lastInputAt = 0;
    /** Ignore the scroll events produced by our own navigation. */
    let quietUntil = 0;
    /** Scrollbar drag in progress, where it started, and whether the thumb is held. */
    let dragging = false;
    let dragStartY = 0;
    let thumbHeld = false;
    let lastScrollY = window.scrollY;
    let heroVisible = true;

    const locked = () => document.body.style.overflow === "hidden";
    const heroTop = () => window.scrollY + section.getBoundingClientRect().top;
    const heroBottom = () => heroTop() + section.offsetHeight;
    /** The hero fills the viewport (its top edge is at the top of the view). */
    const heroInPlace = () => Math.abs(section.getBoundingClientRect().top) <= 2;

    /** Jump the camera to a city with no animation. */
    const showCamera = (index: number) => {
      if (Math.abs(targetRef.current * LAST_STAGE - index) < 1e-3) return;
      targetRef.current = index / LAST_STAGE;
      snapRef.current = true;
    };

    const finish = (index: number) => {
      tween = null;
      targetRef.current = index / LAST_STAGE;
      directRef.current = false;
      steppingRef.current = false;
    };

    // One city move: zoom out → travel → zoom in, on the camera only.
    const stepTo = (requested: number) => {
      const index = MathUtils.clamp(Math.round(requested), 0, LAST_STAGE);
      stage = index;
      tween?.kill();
      steppingRef.current = true;
      directRef.current = true;

      if (reduced) {
        finish(index);
        return;
      }

      // Start from what the camera shows now and skip the still "hold" parts
      // of the segment, so motion begins at once and ends exactly on arrival.
      const shown = valueRef.current * LAST_STAGE;
      const direction = Math.sign(index - shown) || 1;
      const near = Math.round(shown);
      let from = shown;
      if (Math.abs(shown - near) <= HOLD) {
        const trimmed = near + direction * HOLD;
        if ((index - trimmed) * direction >= 0) from = trimmed;
      }
      let to = index - direction * HOLD;
      if ((to - from) * direction <= 0) to = index;
      const duration = MathUtils.clamp(
        (STEP_DURATION * Math.abs(to - from)) / (1 - 2 * HOLD),
        0.5,
        STEP_DURATION * 1.2
      );

      proxy.value = from;
      targetRef.current = from / LAST_STAGE;
      tween = gsap.to(proxy, {
        value: to,
        duration,
        ease: "none", // the rig applies sine easing per segment
        onUpdate: () => {
          targetRef.current = proxy.value / LAST_STAGE;
        },
        onComplete: () => finish(index),
      });
    };
    stepToRef.current = stepTo;

    // Programmatic page navigation (Home, header links, skip, scrollbar
    // release): one short scroll, no city animation. Landing on the hero
    // shows the overview straight away; leaving it keeps the current view
    // until it is off screen, and a wheel re-entry later resumes there.
    let dimTween: gsap.core.Tween | null = null;
    const heroInner = heroInnerRef.current;
    const navigate = (
      destination: number,
      enterStage = 0,
      { duration = SKIP_DURATION, dimHero = false, skipCards = false, onArrive }: { duration?: number; dimHero?: boolean; skipCards?: boolean; onArrive?: () => void } = {}
    ) => {
      if (skippingRef.current || locked()) return false;
      const bottom = heroBottom();
      // Path never touches the hero: leave it to the normal scroller.
      if (window.scrollY >= bottom - 1 && destination >= bottom - 1) return false;

      skippingRef.current = true;
      dragging = false;
      tween?.kill();
      tween = null;
      steppingRef.current = false;
      directRef.current = false;
      window.clearTimeout(settleTimer);

      const entering = destination < bottom - 1;
      // Leaving keeps the stage, so coming back with the wheel resumes there.
      if (entering) stage = enterStage;
      if (entering) showCamera(enterStage);

      // Skip only: the hero gently dims (opacity + slight scale, GPU only)
      // while it scrolls away and the types section rises into view.
      const inner = heroInner;
      const dim = dimHero && !reduced && !entering && inner;
      if (dim) {
        dimTween?.kill();
        dimTween = gsap.to(inner, { opacity: 0.15, scale: 0.98, force3D: true, duration, ease: "power2.inOut" });
      }

      const done = () => {
        if (!skippingRef.current) return;
        window.clearTimeout(navTimer);
        // The hero is off screen now: restore it for the way back.
        if (dim) {
          dimTween?.kill();
          dimTween = null;
          gsap.set(inner, { clearProps: "opacity,transform" });
        }
        skippingRef.current = false;
        quietUntil = performance.now() + 400;
        heroVisible = window.scrollY < heroBottom();
        // Leaving the hero always resets it: coming back shows the overview.
        if (!entering && !heroVisible) stage = 0;
        // Off screen the overview stays rendered (no stale city on return).
        showCamera(entering ? enterStage : heroVisible ? stage : 0);
        ScrollTrigger.update();
        onArrive?.();
      };
      const lenis = getLenis();
      if (lenis && !reduced && duration > 0) {
        lenis.scrollTo(destination, {
          duration,
          easing: skipCards ? glideEasing(window.scrollY, destination) : dimHero ? easePower2InOut : easeInOutSine,
          force: true,
          lock: true,
          onComplete: done,
        });
        navTimer = window.setTimeout(done, duration * 1000 + 600); // safety net
      } else {
        if (lenis) lenis.scrollTo(destination, { immediate: true, force: true });
        else window.scrollTo(0, destination);
        done();
      }
      return true;
    };
    setHeroNavigator((destination, duration, onArrive) => navigate(destination, 0, { ...(duration !== undefined ? { duration } : {}), skipCards: true, onArrive }));

    const typesPosition = () => {
      const destinationElement = document.getElementById(SKIP_TARGET_ID);
      if (!destinationElement) return null;
      // The types section pins itself at "top top" (its own padding clears the
      // floating header), so land exactly on its ScrollTrigger start; fall
      // back to the section's top edge if it has no trigger.
      const triggers = ScrollTrigger.getAll();
      const sectionTrigger =
        triggers.find((trigger) => trigger.pin === destinationElement) ??
        triggers.find((trigger) => trigger.trigger === destinationElement);
      return Math.round(sectionTrigger ? sectionTrigger.start : window.scrollY + destinationElement.getBoundingClientRect().top);
    };
    skipRef.current = () => {
      const destination = typesPosition();
      if (destination !== null) navigate(destination, 0, { duration: SKIP_TRANSITION, dimHero: true });
    };

    /** Should input in `direction` drive the camera instead of the page? */
    const shouldCapture = (direction: number) => {
      if (skippingRef.current || locked() || !heroInPlace()) return false;
      if (steppingRef.current) return true;
      // Tirunelveli reached: the next scroll enters the types section.
      if (direction > 0 && stage === LAST_STAGE) return false;
      // Overview: nothing above the hero, normal page behaviour.
      if (direction < 0 && stage === 0) return false;
      return true;
    };

    // Section edges: at Tirunelveli the next downward gesture glides into the
    // types section; at the top of the types section an upward gesture glides
    // back to the hero, which continues from its current stage.
    const edgeAction = (direction: number) => {
      if (skippingRef.current || steppingRef.current || locked()) return null;
      if (direction > 0 && stage === LAST_STAGE && heroInPlace()) return () => skipRef.current?.();
      if (direction < 0) {
        const types = typesPosition();
        // Only from the first card: otherwise the gesture steps the cards back.
        const firstCard = (document.getElementById(SKIP_TARGET_ID)?.dataset.stepIndex ?? "0") === "0";
        if (types !== null && firstCard && Math.abs(window.scrollY - types) <= 2) return () => navigate(heroTop(), stage);
      }
      return null;
    };

    const step = (direction: number) => {
      if (steppingRef.current) return;
      const next = stage + direction;
      if (next >= 0 && next <= LAST_STAGE) stepTo(next);
    };

    const onWheel = (event: WheelEvent) => {
      lastInputAt = performance.now();
      if (!readyRef.current || event.ctrlKey || locked()) return;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const dy = event.deltaY * scale;
      if (!dy || Math.abs(dy) < Math.abs(event.deltaX * scale)) return;
      const direction = dy > 0 ? 1 : -1;
      const now = performance.now();
      const abs = Math.abs(dy);
      // New gesture: a pause, a reversal or a clear re-acceleration (not inertia).
      const fresh =
        now - lastWheel > WHEEL_GESTURE_GAP ||
        direction !== lastWheelDir ||
        (abs > lastWheelAbs * 1.6 && abs > 24);
      lastWheel = now;
      lastWheelAbs = abs;
      lastWheelDir = direction;

      const edge = edgeAction(direction);
      if (edge) {
        event.preventDefault();
        event.stopPropagation();
        if (fresh) edge();
        return;
      }
      if (!shouldCapture(direction)) return;
      event.preventDefault();
      event.stopPropagation(); // keep Lenis from scrolling the page
      if (fresh) step(direction);
    };

    const onTouchStart = (event: TouchEvent) => {
      lastInputAt = performance.now();
      touchDecided = event.touches.length !== 1;
      touchCapture = false;
      touchFired = false;
      touchY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      lastInputAt = performance.now();
      if (!readyRef.current || locked()) return;
      const dy = touchY - (event.touches[0]?.clientY ?? touchY); // > 0 scrolls down
      if (!touchDecided) {
        if (!dy) return;
        touchDecided = true;
        touchEdge = edgeAction(dy > 0 ? 1 : -1);
        touchCapture = Boolean(touchEdge) || shouldCapture(dy > 0 ? 1 : -1);
      }
      if (!touchCapture) return;
      if (event.cancelable) event.preventDefault();
      if (!touchFired && Math.abs(dy) > SWIPE_DISTANCE) {
        touchFired = true;
        if (touchEdge) touchEdge();
        else step(dy > 0 ? 1 : -1);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      lastInputAt = performance.now();
      if (!readyRef.current || locked() || event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const space = event.key === " ";
      if (space && target?.closest("button, a")) return;
      let direction = 0;
      if (event.key === "ArrowDown" || event.key === "PageDown" || (space && !event.shiftKey)) direction = 1;
      else if (event.key === "ArrowUp" || event.key === "PageUp" || (space && event.shiftKey)) direction = -1;
      if (!direction) return;
      const edge = edgeAction(direction);
      if (edge) {
        event.preventDefault();
        if (!event.repeat) edge();
        return;
      }
      if (!shouldCapture(direction)) return;
      event.preventDefault();
      if (!event.repeat) step(direction);
    };

    // Scrollbar released with the hero partly on screen: finish at a section
    // boundary in the drag direction (types section or hero overview).
    const settle = (dragged: boolean) => {
      if (!dragged || !readyRef.current || steppingRef.current || skippingRef.current || locked()) return;
      dragging = false;
      const top = heroTop();
      const y = window.scrollY;
      const types = typesPosition() ?? heroBottom();
      if (y > top + 1 && y < types - 1) navigate(y > dragStartY ? types : top);
    };

    // Page scrolling never animates the camera; it only decides which view
    // is shown when the hero comes (back) into view:
    //  - dragged back with the scrollbar → overview;
    //  - wheel/keys from below → the stage the hero was left at.
    // While the hero is off screen the overview stays rendered, and a wheel
    // scroll back up switches to the stage's view before the hero shows.
    const onScroll = () => {
      const y = window.scrollY;
      const previousY = lastScrollY;
      lastScrollY = y;
      const bottom = heroBottom();
      const wasVisible = heroVisible;
      heroVisible = y < bottom;
      // Once the hero is off screen it is reset: scrolling back up lands on the overview, not the last city.
      if (!heroVisible) stage = 0;
      if (steppingRef.current || skippingRef.current || performance.now() < quietUntil) return;
      const dragged = performance.now() - lastInputAt > INPUT_WINDOW && getLenis()?.isScrolling !== "smooth";
      if (dragged) {
        if (!dragging) {
          dragging = true;
          dragStartY = previousY;
        }
        // Scrollbar navigation always comes back to the overview.
        if (!heroVisible || !wasVisible) stage = 0;
      }
      if (!heroVisible) showCamera(!dragged && y < previousY ? stage : 0);
      else if (!wasVisible) showCamera(stage);
      window.clearTimeout(settleTimer);
      // Never redirect while the scrollbar thumb is still held.
      if (!thumbHeld) settleTimer = window.setTimeout(() => settle(dragged), dragged ? 350 : 200);
    };

    // A press on the page scrollbar (outside the content box) marks the thumb
    // as held; any sign of release lets a pending drag settle.
    const onPointerDown = (event: MouseEvent) => {
      if (event.clientX >= document.documentElement.clientWidth) thumbHeld = true;
    };
    const releaseThumb = () => {
      if (!thumbHeld) return;
      thumbHeld = false;
      if (!dragging) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => settle(true), 120);
    };
    const onMouseMove = (event: MouseEvent) => {
      if (thumbHeld && event.buttons === 0) releaseThumb();
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("pointerup", releaseThumb, true);
    window.addEventListener("mouseup", releaseThumb, true);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("blur", releaseThumb);

    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("pointerup", releaseThumb, true);
      window.removeEventListener("mouseup", releaseThumb, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("blur", releaseThumb);
      window.clearTimeout(settleTimer);
      window.clearTimeout(navTimer);
      dimTween?.kill();
      if (heroInner) gsap.set(heroInner, { clearProps: "opacity,transform" });
      setHeroNavigator(null);
      tween?.kill();
      steppingRef.current = false;
      directRef.current = false;
      skippingRef.current = false;
      stepToRef.current = null;
      skipRef.current = null;
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
    const copy = copyRef.current;
    if (!inner || !name || !projects || !horizontal || !vertical || !corner || !top || !text || !copy) return;

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
      setCopyProgress: (progress) => {
        const value = reduced ? (progress > 0.5 ? 1 : 0) : progress;
        gsap.set(copy, { autoAlpha: value, y: reduced ? 0 : -36 * (1 - value) });
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
      // One viewport of margin: the scene is already re-rendered (e.g. reset
      // to the overview after a scrollbar drag) before it scrolls into view.
      { rootMargin: "100% 0px" }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Hovering/focusing the skip button signals intent: start loading and
  // decoding the types section's lazy images (off the main thread) so they
  // don't decode mid-transition. Runs once.
  const typesWarmedRef = useRef(false);
  const warmTypesSection = () => {
    if (typesWarmedRef.current) return;
    typesWarmedRef.current = true;
    document.querySelectorAll<HTMLImageElement>(`#${SKIP_TARGET_ID} img`).forEach((img) => {
      img.loading = "eager";
      img.decode().catch(() => undefined);
    });
  };

  // Skip button animations, compositor-only (transform + opacity):
  //  - idle float on the outer span as translate3d, so sub-pixel motion stays
  //    smooth on its own GPU layer instead of snapping pixel by pixel;
  //  - one prebuilt hover timeline (lift + scale, stronger glow layer faded
  //    in by opacity) that is played/reversed, never recreated.
  useEffect(() => {
    const float = skipFloatRef.current;
    const icon = skipIconRef.current;
    const glow = skipGlowRef.current;
    if (!float || !icon || !glow) return;

    const floatTween = reduced
      ? null
      : gsap.to(float, { y: -4, force3D: true, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });

    const hover = gsap.timeline({ paused: true, defaults: { duration: reduced ? 0.01 : 0.35, ease: "power2.out" } });
    if (!reduced) hover.to(icon, { y: -3, scale: 1.04, force3D: true }, 0);
    hover.to(glow, { opacity: 1 }, 0);
    skipHoverRef.current = hover;

    return () => {
      floatTween?.kill();
      hover.kill();
      skipHoverRef.current = null;
      gsap.set([float, icon, glow], { clearProps: "transform,opacity" });
    };
  }, [reduced]);

  const setSkipHover = (active: boolean) => {
    if (active) warmTypesSection();
    const hover = skipHoverRef.current;
    if (!hover) return;
    if (active) hover.play();
    else hover.reverse();
  };

  const goToStage = (index: number) => {
    stepToRef.current?.(index);
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
        height: "100svh",
        background: BACKGROUND,
      }}
    >
      <div
        ref={heroInnerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100svh",
          overflow: "hidden",
          isolation: "isolate",
          background: BACKGROUND,
        }}
      >
        {/* 3D Earth */}
        <div style={{ ...fullSize, zIndex: 0 }}>
          <SceneErrorBoundary onError={handleReady}>
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
            <Suspense fallback={null}>
              <GlobeWorld
                targetRef={targetRef}
                activeIndex={activeIndex}
                reducedMotion={reduced}
                hooksRef={hooksRef}
                labelRef={labelRef}
                directRef={directRef}
                valueRef={valueRef}
                snapRef={snapRef}
                onReady={handleReady}
              />
            </Suspense>
          </Canvas>
          </SceneErrorBoundary>
        </div>

        {/* Loading veil: hides the canvas until textures, shaders and the
            camera are fully initialised; faded out by the entrance timeline. */}
        <div
          ref={veilRef}
          aria-hidden="true"
          style={{
            ...fullSize,
            zIndex: 2,
            pointerEvents: "none",
            background: BACKGROUND,
          }}
        />

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
          className="onepole-hero-copy"
          style={{
            position: "absolute",
            zIndex: 3,
            top: "var(--hero-top)",
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
          {/* Intro wrapper: starts vertically centred in the viewport (pure
              CSS, so the first paint is already centred) and glides to its
              resting position once the scene is ready. Kept separate from
              copyRef, whose y is scrubbed by scroll. */}
          <div
            ref={introRef}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: "translate3d(0, calc(50svh - var(--hero-top) - 50%), 0)",
              willChange: "transform",
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
        </div>



        {/* Skip the 3D journey and go straight to the unipole types. */}
        <button
          type="button"
          className="onepole-skip"
          aria-label="Skip 3D experience"
          title="Skip 3D experience"
          onClick={() => skipRef.current?.()}
          onMouseEnter={() => setSkipHover(true)}
          onMouseLeave={() => setSkipHover(false)}
          onFocus={() => setSkipHover(true)}
          onBlur={() => setSkipHover(false)}
          style={{
            position: "absolute",
            zIndex: 5,
            right: "clamp(36px, 4.5vw, 96px)",
            bottom: "clamp(18px, 2.2vw, 30px)",
            width: "clamp(46px, 3.6vw, 52px)",
            height: "clamp(46px, 3.6vw, 52px)",
            padding: 0,
            border: 0,
            borderRadius: "50%",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          {/* Outer span: idle float. Inner span: glass disc (hover lift). The
              hover glow is a static shadow on its own layer, faded by opacity. */}
          <span
            ref={skipFloatRef}
            style={{ display: "block", width: "100%", height: "100%", willChange: "transform" }}
          >
            <span
              ref={skipIconRef}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                color: "#ffffff",
                background: "transparent",
                willChange: "transform",
              }}
            >
              <span
                ref={skipGlowRef}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: -1,
                  borderRadius: "50%",
                  boxShadow: "none",
                  opacity: 0,
                  pointerEvents: "none",
                  willChange: "opacity",
                }}
              />
              <svg
                className="onepole-skip-arrows"
                width="34"
                height="56"
                viewBox="0 0 22 36"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon className="onepole-skip-chevron" points="1,1 11,6.4 21,1 21,5 11,10.4 1,5" />
                <polygon className="onepole-skip-chevron" points="1,12 11,17.4 21,12 21,16 11,21.4 1,16" />
                <polygon className="onepole-skip-chevron" points="1,23 11,28.4 21,23 21,27 11,32.4 1,27" />
              </svg>
            </span>
          </span>
        </button>

        {/* Small-screen adjustments without separate CSS */}
        <style>{`
          /* Resting position of the hero copy: balanced between the header
             and the globe horizon (portrait scenes sit lower, see PORTRAIT_SHIFT). */
          .onepole-hero-copy {
            --hero-top: clamp(120px, 23vh, 240px);
          }
          @media (orientation: portrait) and (max-width: 767px) {
            .onepole-hero-copy {
              --hero-top: clamp(120px, 26vh, 260px);
            }
          }
          .onepole-skip-arrows {
            color: #ffffff;
            filter: drop-shadow(0 0 1.5px rgba(5, 10, 30, 0.7)) drop-shadow(0 0 6px rgba(255, 190, 110, 0.95)) drop-shadow(0 0 16px rgba(255, 160, 70, 0.6));

            overflow: visible;
          }
          .onepole-skip-chevron {
            opacity: 0.15;
            transform-box: fill-box;
            animation: onepole-skip-flow 1.5s ease-in-out infinite;
          }
          .onepole-skip-chevron:nth-child(2) {
            animation-delay: 0.22s;
          }
          .onepole-skip-chevron:nth-child(3) {
            animation-delay: 0.44s;
          }
          @keyframes onepole-skip-flow {
            0% {
              opacity: 0.45;
              transform: translateY(-3px);
            }
            35% {
              opacity: 1;
              transform: translateY(0);
            }
            100% {
              opacity: 0.45;
              transform: translateY(4px);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .onepole-skip-chevron {
              animation: none;
              opacity: 0.9;
            }
          }
          .onepole-skip:focus-visible {
            outline: 2px solid #ffffff;
            outline-offset: 4px;
          }
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
