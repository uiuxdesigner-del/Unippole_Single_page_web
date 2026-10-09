"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  type Group,
  Matrix4,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  EARTH_RADIUS,
  type HeroLocation,
  UNIPOLE_SCALE,
  boardYaw,
  latLonToVector,
  surfaceFrame,
} from "./geo";
import { HeroUnipole } from "./HeroUnipole";

/*
 * Level of detail per city, driven by camera distance to the anchor:
 *   far    (> 2.0)  glowing beacon only
 *   mid    (< 2.0)  detailed unipole model shown (grows in)
 *   near   (< 0.85) street-light network (active city only)
 * Geometry and materials are shared, so keeping every site mounted is cheap;
 * visibility and scale are switched per frame through refs.
 */
const LOD = { modelIn: 2.0, detailIn: 0.85 };

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Curvature drop so local ground detail hugs the sphere. */
const sag = (x: number, z: number) => -(x * x + z * z) / (2 * EARTH_RADIUS);

const BEACON_VERTEX = /* glsl */ `
  varying float vAlong;
  void main() {
    vAlong = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BEACON_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlong;
  void main() {
    float a = pow(1.0 - vAlong, 2.2) * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const beaconGeometry = new CylinderGeometry(0.003, 0.009, 0.45, 12, 1, true);
beaconGeometry.translate(0, 0.225, 0);
const ringGeometry = new RingGeometry(0.022, 0.03, 48);
ringGeometry.rotateX(-Math.PI / 2);

function Beacon({ color, opacityRef }: { color: string; opacityRef: React.RefObject<number> }) {
  const ring = useRef<Group>(null);
  const beam = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BEACON_VERTEX,
        fragmentShader: BEACON_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: { uColor: { value: new Color(color).multiplyScalar(1.6) }, uOpacity: { value: 1 } },
      }),
    [color]
  );
  const ringMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BEACON_VERTEX,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uOpacity;
          void main() { gl_FragColor = vec4(uColor * uOpacity, uOpacity); }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 1 } },
      }),
    [color]
  );

  const live = useRef<{ beam: ShaderMaterial; ring: ShaderMaterial } | null>(null);

  useEffect(() => {
    live.current = { beam, ring: ringMaterial };
    return () => {
      live.current = null;
      beam.dispose();
      ringMaterial.dispose();
    };
  }, [beam, ringMaterial]);

  useFrame(({ clock }) => {
    const m = live.current;
    if (!m) return;
    const o = opacityRef.current ?? 0;
    m.beam.uniforms.uOpacity.value = o * 0.9;
    const t = (clock.elapsedTime * 0.45) % 1;
    m.ring.uniforms.uOpacity.value = o * (1 - t) * 0.8;
    ring.current?.scale.setScalar(1 + t * 2.4);
  });

  return (
    <group>
      <mesh geometry={beaconGeometry} material={beam} />
      <group ref={ring} position={[0, 0.002, 0]}>
        <mesh geometry={ringGeometry} material={ringMaterial} />
      </group>
    </group>
  );
}

/** Street-light network along meandering roads around the city centre. */
function CityDetail({ seed }: { seed: number }) {
  const lights = useMemo(() => {
    const random = seeded(seed);
    const points: number[] = [];
    const colors: number[] = [];
    const warm = new Color("#ffc27a");
    const white = new Color("#fff1dc");
    const c = new Color();
    const push = (x: number, z: number, intensity: number) => {
      points.push(x, sag(x, z) + 0.0006, z);
      c.copy(random() > 0.8 ? white : warm).multiplyScalar(intensity);
      colors.push(c.r, c.g, c.b);
    };

    // Meandering arterial roads (random walks outward from the centre).
    const spokes = 9;
    for (let s = 0; s < spokes; s++) {
      let angle = (s / spokes) * Math.PI * 2 + random() * 0.5;
      let x = 0;
      let z = 0;
      const reach = 0.035 + random() * 0.045;
      for (let d = 0; d < reach; d += 0.0016) {
        angle += (random() - 0.5) * 0.18;
        x += Math.cos(angle) * 0.0016;
        z += Math.sin(angle) * 0.0016;
        if (random() > 0.45) push(x, z, 1.1 - (d / reach) * 0.8);
        // Occasional side street.
        if (random() > 0.985) {
          const branch = angle + (random() > 0.5 ? 1.3 : -1.3);
          for (let b = 1; b < 10; b++) push(x + Math.cos(branch) * b * 0.0018, z + Math.sin(branch) * b * 0.0018, 0.7);
        }
      }
    }
    // Dense urban core, Gaussian-like falloff.
    for (let i = 0; i < 1100; i++) {
      const r = Math.abs(random() + random() + random() - 1.5) * 0.045;
      const a = random() * Math.PI * 2;
      push(Math.cos(a) * r, Math.sin(a) * r, 0.35 + random() * 0.7);
    }

    const lightGeometry = new BufferGeometry();
    lightGeometry.setAttribute("position", new Float32BufferAttribute(points, 3));
    lightGeometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

    return lightGeometry;
  }, [seed]);

  useEffect(() => () => lights.dispose(), [lights]);

  return (
    <group>
      <points geometry={lights}>
        <pointsMaterial
          size={1.6}
          sizeAttenuation={false}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

export function CitySite({
  city,
  index,
  active,
  reducedMotion,
}: {
  city: HeroLocation;
  index: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const modelGroup = useRef<Group>(null);
  const detailGroup = useRef<Group>(null);
  const beaconOpacity = useRef(0);
  const frames = useRef(0);

  const { position, quaternion } = useMemo(() => {
    const frame = surfaceFrame(city.lat, city.lon);
    // Local axes: X = east, Y = up (surface normal), Z = south.
    const basis = new Matrix4().makeBasis(frame.east, frame.up, frame.north.clone().negate());
    const q = new Quaternion().setFromRotationMatrix(basis);
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), boardYaw(index)));
    return { position: latLonToVector(city.lat, city.lon, EARTH_RADIUS), quaternion: q };
  }, [city, index]);

  // LOD is applied through refs only: no React state, no mid-scroll mounting.
  // Everything renders (at near-zero scale) for the first frames so shaders
  // and textures are compiled up front instead of hitching during scroll.
  useFrame(({ camera }, delta) => {
    const distance = camera.position.distanceTo(position);
    const warming = frames.current < 3;
    frames.current += 1;

    const beaconTarget = (active ? 1 : 0.55) * Math.min(1, Math.max(0, (distance - 0.9) / 1.2));
    beaconOpacity.current = reducedMotion
      ? beaconTarget
      : beaconOpacity.current + (beaconTarget - beaconOpacity.current) * (1 - Math.exp(-4 * delta));

    const model = modelGroup.current;
    if (model) {
      const far = Math.min(1, Math.max(0, (LOD.modelIn + 0.2 - distance) / 0.8));
      // Inactive neighbours right beside the camera shrink away smoothly so
      // they never fill the foreground of another city's shot.
      const nearClear = active ? 1 : MathUtils.smoothstep(distance, 0.2, 0.5);
      const grow = far * nearClear;
      model.visible = warming || grow > 0;
      model.scale.setScalar(UNIPOLE_SCALE * Math.max(grow, 0.0001));
    }

    const detail = detailGroup.current;
    if (detail) detail.visible = warming || (active && distance < LOD.detailIn);
  });

  return (
    <group position={position} quaternion={quaternion}>
      <Beacon color={city.color} opacityRef={beaconOpacity} />
      <group ref={modelGroup} scale={0.0001}>
        <HeroUnipole city={city} active={active} reducedMotion={reducedMotion} />
      </group>
      <group ref={detailGroup}>
        <CityDetail seed={index * 7919 + 17} />
      </group>
    </group>
  );
}
