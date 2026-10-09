"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  type Texture,
  TextureLoader,
  SRGBColorSpace,
  Vector3,
  Vector4,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { HeroLocation } from "./geo";
import { createCreativeTexture } from "./cityCreatives";

/*
 * Reusable, procedurally-built unipole in model units (≈1 unit tall):
 * Foundation → base plate + anchor bolts + gussets → tapered pole with flange
 * → rear mounting head → horizontal beam + cantilever brackets → rear frame
 * with cross bracing → front signage panel, plus maintenance platform,
 * railing, ladder, light arms, floodlights, electrical box and aviation light.
 *
 * All static parts are merged per material into a handful of shared
 * geometries, so each instance costs only a few draw calls.
 */

const BOARD = { width: 1.0, height: 0.38, bottom: 0.77, z: 0.085, depth: 0.024 };
const BOARD_CENTER_Y = BOARD.bottom + BOARD.height / 2;
const FACE_Z = BOARD.z + BOARD.depth / 2 + 0.0015;
const PLATFORM_Y = BOARD.bottom - 0.02;
const BOARD_TOP = BOARD.bottom + BOARD.height;
const FRAME_Z = BOARD.z - BOARD.depth / 2 - 0.012;

/*
 * Top-mounted floodlights: arms clamp to the rear frame, run over the top of
 * the board and hold each fixture forward of the face, aimed down at it.
 */
const LIGHT_XS = [-0.375, -0.125, 0.125, 0.375];
const FIXTURE_Y = BOARD_TOP + 0.075;
const FIXTURE_Z = FACE_Z + 0.16;
const AIM_Y = BOARD_TOP - 0.14;

type PartMaterial = "steel" | "charcoal" | "concrete" | "grating";

const unitBox = new BoxGeometry(1, 1, 1);
const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const yAxis = new Vector3(0, 1, 0);

function buildGeometries() {
  const parts: Record<PartMaterial, BufferGeometry[]> = { steel: [], charcoal: [], concrete: [], grating: [] };

  const add = (
    material: PartMaterial,
    geometry: BufferGeometry,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    quaternion: Quaternion = new Quaternion()
  ) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(tmpMatrix.compose(new Vector3(...position), quaternion, new Vector3(...scale)));
    parts[material].push(g);
  };

  const box = (material: PartMaterial, size: [number, number, number], position: [number, number, number]) =>
    add(material, unitBox, position, size);

  // Square-section member between two points.
  const member = (material: PartMaterial, from: [number, number, number], to: [number, number, number], t: number) => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const dir = b.clone().sub(a);
    const length = dir.length();
    tmpQuat.setFromUnitVectors(yAxis, dir.normalize());
    const mid = a.add(b).multiplyScalar(0.5);
    add(material, unitBox, [mid.x, mid.y, mid.z], [t, length, t], tmpQuat.clone());
  };

  // Foundation and base.
  box("concrete", [0.17, 0.05, 0.17], [0, 0.0, 0]);
  box("steel", [0.11, 0.012, 0.11], [0, 0.031, 0]);
  const bolt = new CylinderGeometry(0.0045, 0.0045, 0.03, 8);
  const nut = new CylinderGeometry(0.008, 0.008, 0.007, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 0.044;
    const z = Math.sin(a) * 0.044;
    add("steel", bolt, [x, 0.04, z]);
    add("charcoal", nut, [x, 0.04, z]);
  }
  const gussetShape = new Shape();
  gussetShape.moveTo(0, 0);
  gussetShape.lineTo(0.034, 0);
  gussetShape.lineTo(0, 0.075);
  gussetShape.closePath();
  const gusset = new ExtrudeGeometry(gussetShape, { depth: 0.004, bevelEnabled: false });
  gusset.translate(0.028, 0, -0.002);
  for (let i = 0; i < 4; i++) {
    add("steel", gusset, [0, 0.037, 0], [1, 1, 1], new Quaternion().setFromAxisAngle(yAxis, (i * Math.PI) / 2 + Math.PI / 4));
  }

  // Tapered pole with a mid flange joint.
  add("steel", new CylinderGeometry(0.022, 0.033, 0.72, 28), [0, 0.037 + 0.36, 0]);
  add("charcoal", new CylinderGeometry(0.036, 0.036, 0.012, 28), [0, 0.32, 0]);
  add("charcoal", new CylinderGeometry(0.03, 0.03, 0.01, 28), [0, 0.6, 0]);

  // Rear mounting head and main horizontal support beam.
  box("charcoal", [0.075, 0.06, 0.075], [0, 0.765, 0]);
  box("charcoal", [BOARD.width * 0.92, 0.032, 0.036], [0, 0.79, 0.022]);

  // Cantilever brackets from the pole to the beam ends.
  member("charcoal", [0, 0.6, 0.0], [-0.34, 0.785, 0.02], 0.018);
  member("charcoal", [0, 0.6, 0.0], [0.34, 0.785, 0.02], 0.018);
  member("charcoal", [0, 0.66, 0.0], [-0.17, 0.785, 0.02], 0.014);
  member("charcoal", [0, 0.66, 0.0], [0.17, 0.785, 0.02], 0.014);

  // Rear billboard frame with verticals, rails and X cross bracing.
  const frameZ = FRAME_Z;
  const xs = [-0.48, -0.24, 0, 0.24, 0.48];
  const ys = [BOARD.bottom + 0.012, BOARD_CENTER_Y, BOARD.bottom + BOARD.height - 0.012];
  for (const x of xs) box("charcoal", [0.016, BOARD.height, 0.022], [x, BOARD_CENTER_Y, frameZ]);
  for (const y of ys) box("charcoal", [BOARD.width, 0.014, 0.02], [0, y, frameZ]);
  for (let i = 0; i < xs.length - 1; i++) {
    member("steel", [xs[i], ys[0], frameZ - 0.006], [xs[i + 1], ys[2], frameZ - 0.006], 0.006);
    member("steel", [xs[i + 1], ys[0], frameZ - 0.006], [xs[i], ys[2], frameZ - 0.006], 0.006);
  }
  // Standoffs joining the beam to the frame.
  for (const x of [-0.36, 0, 0.36]) member("charcoal", [x, 0.79, 0.022], [x, BOARD.bottom + 0.012, frameZ], 0.012);

  // Signage panel body (face is a separate textured mesh) and trim.
  box("charcoal", [BOARD.width, BOARD.height, BOARD.depth], [0, BOARD_CENTER_Y, BOARD.z]);
  const trimZ = FACE_Z + 0.002;
  box("steel", [BOARD.width + 0.012, 0.012, 0.01], [0, BOARD.bottom, trimZ]);
  box("steel", [BOARD.width + 0.012, 0.012, 0.01], [0, BOARD.bottom + BOARD.height, trimZ]);
  box("steel", [0.012, BOARD.height, 0.01], [-BOARD.width / 2, BOARD_CENTER_Y, trimZ]);
  box("steel", [0.012, BOARD.height, 0.01], [BOARD.width / 2, BOARD_CENTER_Y, trimZ]);

  // Maintenance platform with grating, toe board and railing.
  const platformDepth = 0.075;
  const platformZ = FACE_Z + platformDepth / 2;
  box("grating", [BOARD.width + 0.04, 0.008, platformDepth], [0, PLATFORM_Y, platformZ]);
  box("charcoal", [BOARD.width + 0.04, 0.014, 0.004], [0, PLATFORM_Y + 0.007, FACE_Z + platformDepth]);
  for (let x = -0.5; x <= 0.501; x += 0.125) {
    member("steel", [x, PLATFORM_Y, FACE_Z + platformDepth], [x, PLATFORM_Y + 0.06, FACE_Z + platformDepth], 0.005);
    member("charcoal", [x, PLATFORM_Y - 0.002, FACE_Z], [x, PLATFORM_Y - 0.002, FACE_Z + platformDepth], 0.007);
  }
  box("steel", [BOARD.width + 0.04, 0.005, 0.005], [0, PLATFORM_Y + 0.06, FACE_Z + platformDepth]);
  box("steel", [BOARD.width + 0.04, 0.004, 0.004], [0, PLATFORM_Y + 0.032, FACE_Z + platformDepth]);

  // Top light arms: clamp plate on the rear frame, riser, outrigger and brace.
  for (const x of LIGHT_XS) {
    box("charcoal", [0.03, 0.04, 0.01], [x, BOARD_TOP - 0.008, frameZ - 0.012]);
    member("charcoal", [x, BOARD_TOP - 0.02, frameZ - 0.012], [x, BOARD_TOP + 0.05, frameZ - 0.012], 0.008);
    member("charcoal", [x, BOARD_TOP + 0.05, frameZ - 0.016], [x, FIXTURE_Y + 0.02, FIXTURE_Z - 0.02], 0.008);
    member("steel", [x, BOARD_TOP + 0.004, FACE_Z + 0.004], [x, BOARD_TOP + 0.058, FACE_Z + 0.075], 0.005);
    // Cable conduit along the arm.
    member("steel", [x + 0.008, BOARD_TOP + 0.054, frameZ - 0.01], [x + 0.008, FIXTURE_Y + 0.024, FIXTURE_Z - 0.03], 0.0025);
  }

  // Ladder up the rear of the pole.
  const ladderZ = -0.048;
  member("steel", [-0.016, 0.06, ladderZ], [-0.016, PLATFORM_Y, ladderZ], 0.004);
  member("steel", [0.016, 0.06, ladderZ], [0.016, PLATFORM_Y, ladderZ], 0.004);
  for (let y = 0.09; y < PLATFORM_Y; y += 0.04) box("steel", [0.032, 0.003, 0.003], [0, y, ladderZ]);
  for (let y = 0.15; y < PLATFORM_Y; y += 0.15) member("steel", [0, y, -0.025], [0, y, ladderZ], 0.003);

  // Electrical cabinet and conduit.
  box("charcoal", [0.045, 0.07, 0.026], [-0.05, 0.11, 0]);
  box("steel", [0.047, 0.006, 0.028], [-0.05, 0.148, 0]);
  member("steel", [-0.034, 0.14, 0.012], [-0.022, PLATFORM_Y - 0.02, 0.012], 0.004);

  const merged = {} as Record<PartMaterial, BufferGeometry>;
  (Object.keys(parts) as PartMaterial[]).forEach((key) => {
    merged[key] = mergeGeometries(parts[key], false)!;
    merged[key].computeBoundingSphere();
    parts[key].forEach((g) => g.dispose());
  });
  return merged;
}

let sharedGeometries: Record<PartMaterial, BufferGeometry> | null = null;
let sharedMaterials: Record<PartMaterial, MeshStandardMaterial> | null = null;

function getShared() {
  if (!sharedGeometries) sharedGeometries = buildGeometries();
  if (!sharedMaterials) {
    sharedMaterials = {
      // Galvanized steel: light grey, metallic, moderately rough.
      steel: new MeshStandardMaterial({ color: "#c3c8cf", metalness: 0.88, roughness: 0.36 }),
      // Powder-coated charcoal — never pure black so it reads against the night.
      charcoal: new MeshStandardMaterial({ color: "#3a3f47", metalness: 0.55, roughness: 0.48 }),
      concrete: new MeshStandardMaterial({ color: "#8d8a84", metalness: 0, roughness: 0.95 }),
      grating: new MeshStandardMaterial({ color: "#5b6069", metalness: 0.7, roughness: 0.55 }),
    };
  }
  return { geometries: sharedGeometries, materials: sharedMaterials };
}

/* Fixture (local +Z = lens direction): powder-coated housing, glass lens,
   U-yoke with pivot, rear cooling fins. Merged once and shared. */
function buildFixture() {
  const housing: BufferGeometry[] = [];
  const add = (geometry: BufferGeometry, position: [number, number, number]) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.translate(...position);
    housing.push(g);
  };
  add(new BoxGeometry(0.056, 0.026, 0.036), [0, 0, 0]);
  add(new BoxGeometry(0.06, 0.03, 0.004), [0, 0, 0.018]); // bezel
  for (let i = 0; i < 5; i++) add(new BoxGeometry(0.003, 0.022, 0.012), [-0.02 + i * 0.01, 0, -0.024]);
  add(new BoxGeometry(0.004, 0.012, 0.03), [-0.032, -0.006, -0.002]); // yoke sides
  add(new BoxGeometry(0.004, 0.012, 0.03), [0.032, -0.006, -0.002]);
  add(new BoxGeometry(0.068, 0.004, 0.012), [0, -0.014, -0.012]); // yoke bridge
  const merged = mergeGeometries(housing, false)!;
  housing.forEach((g) => g.dispose());
  return merged;
}
const fixtureBody = buildFixture();
const fixturePivot = new CylinderGeometry(0.0045, 0.0045, 0.072, 10).rotateZ(Math.PI / 2);
const fixtureLens = new BoxGeometry(0.048, 0.02, 0.0015);
const aviationGeometry = new SphereGeometry(0.008, 12, 8);

const aimVector = new Vector3(0, AIM_Y - FIXTURE_Y, FACE_Z - FIXTURE_Z);
const beamLength = aimVector.length();
const beamGeometry = new ConeGeometry(0.15, beamLength, 28, 1, true);
beamGeometry.rotateX(-Math.PI / 2);
beamGeometry.translate(0, 0, beamLength / 2);
const fixtureTilt = Math.atan2(-aimVector.y, aimVector.z);

/* Board wash: soft warm pools under each fixture, brightest near the top edge. */
const WASH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const WASH_FRAGMENT = /* glsl */ `
  uniform vec4 uLightsX;
  uniform float uAimV;
  uniform float uStrength;
  uniform vec3 uColor;
  varying vec2 vUv;
  float pool(float x) {
    vec2 d = vec2((vUv.x - x) / 0.17, (vUv.y - uAimV) / 0.62);
    return exp(-dot(d, d));
  }
  void main() {
    float light = pool(uLightsX.x) + pool(uLightsX.y) + pool(uLightsX.z) + pool(uLightsX.w);
    light *= mix(0.55, 1.0, smoothstep(0.0, 1.0, vUv.y));
    float a = clamp(light, 0.0, 1.2) * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }
`;
const toU = (x: number) => x / BOARD.width + 0.5;
const WASH_LIGHTS_X = new Vector4(...(LIGHT_XS.map(toU) as [number, number, number, number]));
const WASH_AIM_V = (AIM_Y - BOARD.bottom) / BOARD.height;

const BEAM_VERTEX = /* glsl */ `
  varying float vAlong;
  varying float vFacing;
  void main() {
    vAlong = uv.y;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vFacing = abs(dot(n, normalize(cameraPosition - world.xyz)));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const BEAM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlong;
  varying float vFacing;
  void main() {
    float a = pow(vAlong, 1.6) * pow(vFacing, 1.4) * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function useCreative(city: HeroLocation) {
  return useMemo<Texture>(() => {
    if (!city.artwork) return createCreativeTexture(city);
    const texture = new TextureLoader().load(city.artwork);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [city]);
}

export function HeroUnipole({
  city,
  active,
  reducedMotion,
}: {
  city: HeroLocation;
  active: boolean;
  reducedMotion: boolean;
}) {
  const { geometries, materials } = getShared();
  const creative = useCreative(city);
  const level = useRef(active ? 1 : 0.55);
  const aviation = useRef<MeshBasicMaterial>(null);

  const faceMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        map: creative,
        emissiveMap: creative,
        emissive: new Color("#ffffff"),
        emissiveIntensity: 0.5,
        roughness: 0.55,
        metalness: 0,
      }),
    [creative]
  );
  const lensMaterial = useMemo(() => new MeshBasicMaterial({ color: "#fff1d6", toneMapped: false }), []);
  const washMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: WASH_VERTEX,
        fragmentShader: WASH_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uLightsX: { value: WASH_LIGHTS_X },
          uAimV: { value: WASH_AIM_V },
          uStrength: { value: 0.2 },
          uColor: { value: new Color("#fff0d8") },
        },
      }),
    []
  );
  const beamMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BEAM_VERTEX,
        fragmentShader: BEAM_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: { uColor: { value: new Color("#ffe9c9") }, uOpacity: { value: 0.06 } },
      }),
    []
  );

  // Per-frame updates go through a ref so render-time values stay immutable.
  const live = useRef<{
    face: MeshStandardMaterial;
    lens: MeshBasicMaterial;
    beam: ShaderMaterial;
    wash: ShaderMaterial;
  } | null>(null);

  useEffect(() => {
    live.current = { face: faceMaterial, lens: lensMaterial, beam: beamMaterial, wash: washMaterial };
    return () => {
      live.current = null;
      faceMaterial.dispose();
      lensMaterial.dispose();
      beamMaterial.dispose();
      washMaterial.dispose();
    };
  }, [faceMaterial, lensMaterial, beamMaterial, washMaterial]);

  useFrame(({ clock }, delta) => {
    const target = active ? 1 : 0.55;
    level.current = reducedMotion ? target : level.current + (target - level.current) * (1 - Math.exp(-4 * delta));
    const l = level.current;
    const m = live.current;
    if (!m) return;
    // Restrained: a printed face lit from above, not a glowing screen.
    m.face.emissiveIntensity = 0.22 + 0.4 * l;
    m.wash.uniforms.uStrength.value = 0.15 + 0.42 * l;
    m.beam.uniforms.uOpacity.value = 0.02 + 0.05 * l;
    m.lens.color.setRGB(1, 0.95, 0.86).multiplyScalar(0.9 + 1.1 * l);
    if (aviation.current) {
      const blink = reducedMotion ? 1 : Math.sin(clock.elapsedTime * 3.2) > 0.2 ? 1 : 0.15;
      aviation.current.color.setRGB(3 * blink, 0.15 * blink, 0.1 * blink);
    }
  });

  return (
    <group>
      <mesh geometry={geometries.steel} material={materials.steel} />
      <mesh geometry={geometries.charcoal} material={materials.charcoal} />
      <mesh geometry={geometries.concrete} material={materials.concrete} />
      <mesh geometry={geometries.grating} material={materials.grating} />

      {/* Front signage face (printed, satin) with the floodlight wash over it. */}
      <mesh position={[0, BOARD_CENTER_Y, FACE_Z]} material={faceMaterial}>
        <planeGeometry args={[BOARD.width - 0.012, BOARD.height - 0.012]} />
      </mesh>
      <mesh position={[0, BOARD_CENTER_Y, FACE_Z + 0.0008]} material={washMaterial}>
        <planeGeometry args={[BOARD.width - 0.012, BOARD.height - 0.012]} />
      </mesh>

      {/* Top-mounted floodlights aimed down onto the board face. */}
      {LIGHT_XS.map((x) => (
        <group key={x} position={[x, FIXTURE_Y, FIXTURE_Z]}>
          <mesh geometry={fixturePivot} material={materials.steel} position={[0, 0.006, 0]} />
          <group rotation={[fixtureTilt, 0, 0]}>
            <mesh geometry={fixtureBody} material={materials.charcoal} />
            <mesh geometry={fixtureLens} material={lensMaterial} position={[0, 0, 0.0205]} />
            <mesh geometry={beamGeometry} material={beamMaterial} position={[0, 0, 0.021]} />
          </group>
        </group>
      ))}

      {/* Aviation warning light. */}
      <mesh geometry={aviationGeometry} position={[0, BOARD.bottom + BOARD.height + 0.012, BOARD.z - 0.02]}>
        <meshBasicMaterial ref={aviation} toneMapped={false} />
      </mesh>
    </group>
  );
}
