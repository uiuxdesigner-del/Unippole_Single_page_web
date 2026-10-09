"use client";

// @refresh reset
// Development edits remount this scene; production rendering is unaffected.

import {
  Suspense,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  Preload,
  RoundedBox,
  Sky,
  Stars,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";

type Vec3 = [number, number, number];

type PremiumReferenceBuildingProps = {
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
  isNight?: boolean;
};

/* ========================================================================== */
/* PERFORMANCE                                                                */
/* ========================================================================== */

const DPR_MAX = 1.0;
// Real-time city-wide shadow maps multiply draw calls heavily. Keep them off
// by default; the lighting/material contrast still gives depth without the
// large GPU spike that was making the train look like it was being "pushed".
const ENABLE_REALTIME_SHADOWS = false;
const SHADOW_SIZE = 512;

/* ========================================================================== */
/* CAMERA CONTROL SETTINGS                                                    */
/* ========================================================================== */

// Reference-matched initial view:
// camera starts from the near/negative end of the road, stays centred on the
// road's slight Y rotation, and looks toward its far/positive end.
// Position and target are both lifted together versus the previous file.
// Their RELATIVE vector is unchanged, so the default composition stays the
// same while giving the camera extra safe clearance for a larger bottom tilt.
const SHOWCASE_CAMERA_POSITION: Vec3 = [-110, 48, 3.1];
const SHOWCASE_CAMERA_TARGET: Vec3 = [60, 6, 17.6];
// Lower FOV = zoom in. Recommended: 32 close, 38 current, 45 wide.
const SHOWCASE_CAMERA_FOV = 38;

/* USER ADJUSTMENTS ---------------------------------------------------------
 * Train speed is in scene units/second, NOT seconds per trip.
 * 20 = slower, 32 = current, 40 = faster.
 * The pause starts only after the WHOLE train exits the viewport.
 * It then restarts at the SAME far bridge end. Travel from that end/fog to
 * visible track is additional time; this is not a visible-arrival interval.
 * A pause of 0 is supported. No scroll-wheel/trackpad zoom is enabled.
 */
const TRAIN_SPEED_UNITS_PER_SECOND = 32;
const TRAIN_PAUSE_SECONDS = 5;

// ROAD TRAFFIC CONTROLS ------------------------------------------------------
// Lightweight instanced vehicles: six live lanes, both directions.
// Increase VEHICLES_PER_LANE for denser traffic; keep <= 8 for mobile safety.
const ROAD_TRAFFIC_VEHICLES_PER_LANE = 6;
const ROAD_TRAFFIC_SPEED_MULTIPLIER = 1;
// Regular traffic loops in this hidden-to-hidden hero corridor instead of the
// complete endless road. This keeps realistic traffic density near the camera.
const ROAD_TRAFFIC_ROUTE_MIN_X = -430;
const ROAD_TRAFFIC_ROUTE_MAX_X = 560;
// Lanes 0 and 5 are dedicated to the larger Roadshow vehicles. Keeping normal
// cars out of these two lanes guarantees that a car cannot pass through a
// Roadshow truck while both systems animate independently.
const ROADSHOW_RESERVED_LANES = new Set<number>([0, 5]);
const ROAD_TRAFFIC_MIN_BUMPER_GAP = 2.6;
const ROAD_TRAFFIC_HEADWAY_SECONDS = 0.38;
// Cap animation catch-up after a dropped frame. Motion slows briefly instead
// of visibly jumping forward, which reads much smoother under GPU pressure.
const MOTION_MAX_DELTA = 1 / 30;

// LED ROADSHOW VEHICLE CONTROLS ---------------------------------------------
// Multiple full-3D Adinn-style LED roadshow trucks are mixed into live traffic.
// Their lane, initial position, speed and LED content are seeded once so the
// arrivals look random without causing React re-renders or per-frame RNG work.
// 3-4 is recommended for this already-dense city; 5 is the practical desktop max.
const ROADSHOW_VEHICLE_COUNT = 3;
const ROADSHOW_TRAFFIC_SPEED_MULTIPLIER = 0.82;
const ROADSHOW_LED_SCREEN_BRIGHTNESS = 0.82;
// Keep the Roadshow trucks inside a useful hero-route instead of sending them
// across the complete extended visual road. This guarantees the real Adinn-style
// vehicles are actually visible while still spawning outside the camera view.
const ROADSHOW_ROUTE_MIN_X = -340;
const ROADSHOW_ROUTE_MAX_X = 500;
// Two vehicles are visible from the start; the others enter shortly after.
// Repeat gaps remain seeded/random-looking without per-frame RNG work.
const ROADSHOW_FIRST_ARRIVAL_MAX_SECONDS = 4;
const ROADSHOW_REPEAT_DELAY_MIN_SECONDS = 5;
const ROADSHOW_REPEAT_DELAY_MAX_SECONDS = 12;

// CAMERA TILT CONTROLS -------------------------------------------------------
// Polar angle is measured from straight above.
// TOP: lower this number for a stronger top-down view.
// BOTTOM: increase this number to let the camera orbit lower.
// Recommended BOTTOM range with the raised orbit target: 86deg-91deg.
// 90.8deg gives a near-road low architectural view while the raised target
// keeps the camera above the road surface. Avoid > 92deg.
const CAMERA_TILT_TOP_DEG = 68;
const CAMERA_TILT_BOTTOM_DEG = 90.8;
const CAMERA_SIDE_ORBIT_DEG = 10;

const SHOWCASE_CONTROL_SETTINGS = {
  minPolarAngle: THREE.MathUtils.degToRad(CAMERA_TILT_TOP_DEG),
  maxPolarAngle: THREE.MathUtils.degToRad(CAMERA_TILT_BOTTOM_DEG),
  // Maximum left/right orbit away from the ORIGINAL hero direction.
  maxYawFromInitialDegrees: CAMERA_SIDE_ORBIT_DEG,
  // Pan is intentionally locked. This prevents dragging the whole camera
  // below/through the city and removes the camera-vs-clamp feedback jitter.
  enablePan: false,
  maxPanX: 0,
  maxPanY: 0,
  maxPanZ: 0,
  rotateSpeed: 0.22,
  panSpeed: 0,
  dampingFactor: 0.08,
} as const;

// Compact billboard-light controls. The visible housings use a shallow
// downward angle so the user can actually read the fixtures from the hero
// camera; the real SpotLight beam still aims onto the advertising face.
const BOARD_LIGHT_RISE = 0.12;
const BOARD_LIGHT_AIM_OFFSET_Y = 0.35;
const BOARD_LIGHT_OUTPUT_DAY = 3.6;
const BOARD_LIGHT_OUTPUT_NIGHT = 95;
// Candela-scale output for inverse-square falloff at 7–10 scene units.
const NIGHT_STREETLIGHT_SPOT_INTENSITY = 430;
const NIGHT_STREETLIGHT_POOL_OPACITY = 0.18;

/* UNIPOLE BOARD VIDEO --------------------------------------------------------
 * Put the supplied MP4 at public/videos/adinn-unipole-loop.mp4.
 * If the video cannot load, the board automatically falls back to the existing
 * generated Adinn artwork, so the section never renders a blank billboard.
 */
const ADINN_BOARD_VIDEO_PATH = "/videos/adinn-unipole-loop.mp4";
const ADINN_BOARD_VIDEO_EMISSIVE_INTENSITY = 0.22;

/* ========================================================================== */
/* SHARED GEOMETRY                                                            */
/* ========================================================================== */

const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);
const PLANT = new THREE.IcosahedronGeometry(1, 1);
const SMALL_PLANT = new THREE.IcosahedronGeometry(1, 0);
const TRUNK = new THREE.CylinderGeometry(0.08, 0.11, 1, 7);
const FAN = new THREE.CircleGeometry(1, 18);

/* ========================================================================== */
/* TEXTURE HELPERS                                                            */
/* ========================================================================== */

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}


/* ========================================================================== */
/* REALISTIC DAY SKY - SUN + LIGHTWEIGHT MOVING CLOUDS                        */
/* ========================================================================== */

// DAY SKY IS VISUAL ONLY.
// Important: the visible sun below does NOT drive or modify the city lighting.
// The original city key light remains unchanged so adding the sun cannot wash
// out the unipole, buildings, road or vehicles.
const DAY_SKY_DISTANCE = 1250;
const SKY_SCATTER_SUN_POSITION: Vec3 = [55, 72, 42];
const VISUAL_SUN_POSITION: Vec3 = [650, 60, 120];
// Sky tuning: 0.7 = slower clouds, 1 = current, 1.4 = faster.
const CLOUD_WIND_SPEED_MULTIPLIER = 0.55;
const CLOUD_OPACITY_MULTIPLIER = 1.0;
const MOON_POSITION: Vec3 = [820, 112, 128];

function createSunGlowTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) * 0.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const nx = (x - half) / half;
      const ny = (y - half) / half;
      const radius = Math.sqrt(nx * nx + ny * ny);
      const core = THREE.MathUtils.clamp(1 - radius, 0, 1);
      const alpha = Math.pow(core, 1.75);

      data[i] = 255;
      data[i + 1] = 247;
      data[i + 2] = 218;
      data[i + 3] = Math.round(alpha * 255);
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createCloudTexture(seed: number) {
  const width = 256;
  const height = 128;
  const data = new Uint8Array(width * height * 4);
  const random = seeded(seed);
  const blobs = Array.from({ length: 10 }, (_, index) => ({
    x: 0.12 + random() * 0.76,
    y: 0.37 + (random() - 0.5) * 0.27 + (index % 3) * 0.015,
    rx: 0.10 + random() * 0.17,
    ry: 0.09 + random() * 0.15,
    strength: 0.72 + random() * 0.34,
  }));

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const i = (y * width + x) * 4;
      let density = 0;

      for (const blob of blobs) {
        const dx = (u - blob.x) / blob.rx;
        const dy = (v - blob.y) / blob.ry;
        const falloff = Math.exp(-(dx * dx + dy * dy) * 1.55) * blob.strength;
        density = Math.max(density, falloff);
      }

      // Break up the silhouette a little without using animated noise or
      // expensive volumetric rendering. The clouds stay soft, not cartoonish.
      const breakup =
        0.035 * Math.sin(u * 31 + seed * 0.17) +
        0.025 * Math.sin(v * 27 + u * 13 + seed * 0.11);
      const alpha = THREE.MathUtils.clamp((density + breakup - 0.08) * 1.22, 0, 1);
      const shade = Math.round(238 + 17 * THREE.MathUtils.clamp(1 - v, 0, 1));

      data[i] = shade;
      data[i + 1] = shade + 3 > 255 ? 255 : shade + 3;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 220);
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const SUN_GLOW_TEXTURE = createSunGlowTexture();
const CLOUD_TEXTURES = [
  createCloudTexture(301),
  createCloudTexture(607),
  createCloudTexture(911),
] as const;

// Clouds are deliberately kept inside the default camera vertical FOV.
// Earlier positions sat almost exactly on/above the top clipping angle, which
// is why the clouds existed in 3D but were not actually visible to the user.
const CLOUD_LAYOUT = [
  { position: [430, 54, -105] as Vec3, scale: [150, 42] as [number, number], opacity: 0.50, speed: 0.34, texture: 0 },
  { position: [535, 64, 24] as Vec3, scale: [190, 50] as [number, number], opacity: 0.44, speed: 0.28, texture: 1 },
  { position: [640, 58, 125] as Vec3, scale: [142, 39] as [number, number], opacity: 0.42, speed: 0.39, texture: 2 },
  { position: [745, 67, -46] as Vec3, scale: [215, 56] as [number, number], opacity: 0.47, speed: 0.31, texture: 0 },
  { position: [855, 56, 86] as Vec3, scale: [175, 46] as [number, number], opacity: 0.40, speed: 0.36, texture: 2 },
  { position: [965, 69, -118] as Vec3, scale: [205, 52] as [number, number], opacity: 0.38, speed: 0.26, texture: 1 },
  { position: [1075, 57, 12] as Vec3, scale: [230, 58] as [number, number], opacity: 0.42, speed: 0.33, texture: 0 },
] as const;

function MovingCloudLayer({ isNight = false }: { isNight?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(Math.max(delta, 0), 0.05);

    for (let index = 0; index < group.children.length; index += 1) {
      const cloud = group.children[index];
      const config = CLOUD_LAYOUT[index];
      if (!config) continue;

      cloud.position.z += config.speed * CLOUD_WIND_SPEED_MULTIPLIER * dt;
      if (cloud.position.z > 190) cloud.position.z = -180;
    }
  });

  return (
    <group ref={groupRef} name="MovingCloudLayer">
      {CLOUD_LAYOUT.map((cloud, index) => (
        <sprite
          key={`sky-cloud-${index}`}
          position={cloud.position}
          scale={[cloud.scale[0], cloud.scale[1], 1]}
          renderOrder={-20}
        >
          <spriteMaterial
            map={CLOUD_TEXTURES[cloud.texture]}
            color={isNight ? "#7e8c9d" : "#f7fbff"}
            transparent
            opacity={cloud.opacity * CLOUD_OPACITY_MULTIPLIER * (isNight ? 0.30 : 1)}
            depthWrite={false}
            depthTest
            fog={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

function RealisticDaySky() {
  return (
    <>
      <Sky
        distance={DAY_SKY_DISTANCE}
        sunPosition={SKY_SCATTER_SUN_POSITION}
        turbidity={2.15}
        rayleigh={2.0}
        mieCoefficient={0.0022}
        mieDirectionalG={0.68}
      />

      {/* Visual sun only. It is intentionally NOT connected to any directional
          light, Environment or exposure value, so it cannot brighten/wash out
          the city or create a fake light flare across the unipole module. */}
      <sprite position={VISUAL_SUN_POSITION} scale={[11, 11, 1]} renderOrder={-30}>
        <spriteMaterial
          map={SUN_GLOW_TEXTURE}
          color="#fff6cf"
          transparent
          opacity={0.96}
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </sprite>
      <sprite position={VISUAL_SUN_POSITION} scale={[27, 27, 1]} renderOrder={-31}>
        <spriteMaterial
          map={SUN_GLOW_TEXTURE}
          color="#ffe6a8"
          transparent
          opacity={0.10}
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </sprite>

      <MovingCloudLayer />
    </>
  );
}

function RealisticNightSky() {
  return (
    <>
      <Stars
        radius={900}
        depth={220}
        count={850}
        factor={3.2}
        saturation={0.08}
        fade
        speed={0.08}
      />

      {/* Lightweight moon disc/halo: visible but restrained, with no bloom. */}
      <sprite position={MOON_POSITION} scale={[13, 13, 1]} renderOrder={-30}>
        <spriteMaterial
          map={SUN_GLOW_TEXTURE}
          color="#eef5ff"
          transparent
          opacity={0.95}
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite position={MOON_POSITION} scale={[46, 46, 1]} renderOrder={-31}>
        <spriteMaterial
          map={SUN_GLOW_TEXTURE}
          color="#9fc6ff"
          transparent
          opacity={0.10}
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <MovingCloudLayer isNight />
    </>
  );
}

function makeTexture(
  width: number,
  height: number,
  data: Uint8Array,
  repeat: [number, number] = [1, 1],
  colorTexture = true,
) {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createStoneMaps(seed: number) {
  const size = 512;
  const random = seeded(seed);
  const color = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);

  const panelW = 82;
  const panelH = 62;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const px = x % panelW;
      const py = y % panelH;
      const grout = px <= 2 || py <= 2;
      const innerEdge = px <= 5 || py <= 5;
      const row = Math.floor(y / panelH);
      const col = Math.floor(x / panelW);
      const panelShift = ((row * 13 + col * 7 + seed) % 13) - 6;
      const grain = (random() - 0.5) * 8.5;
      const vein =
        Math.sin(x * 0.035 + y * 0.083 + seed * 0.01) * 2.3 +
        Math.sin(x * 0.12 - y * 0.041) * 1.1;
      const stain = Math.max(0, Math.sin(x * 0.012 + seed) * 0.5 + 0.5) * (y / size) * -3.5;
      const base = 211 + panelShift + grain + vein + stain;
      const shade = grout ? -48 : innerEdge ? -5 : 0;
      const value = THREE.MathUtils.clamp(base + shade, 145, 232);

      color[i] = value;
      color[i + 1] = THREE.MathUtils.clamp(value - 4, 0, 255);
      color[i + 2] = THREE.MathUtils.clamp(value - 9, 0, 255);
      color[i + 3] = 255;

      const bumpValue = grout ? 38 : innerEdge ? 112 : THREE.MathUtils.clamp(173 + grain * 1.3, 145, 202);
      bump[i] = bumpValue;
      bump[i + 1] = bumpValue;
      bump[i + 2] = bumpValue;
      bump[i + 3] = 255;

      const roughValue = grout
        ? 238
        : THREE.MathUtils.clamp(177 + panelShift * 1.3 + grain * 1.1, 145, 215);
      roughness[i] = roughValue;
      roughness[i + 1] = roughValue;
      roughness[i + 2] = roughValue;
      roughness[i + 3] = 255;
    }
  }

  return {
    color: makeTexture(size, size, color, [2.2, 4.4], true),
    bump: makeTexture(size, size, bump, [2.2, 4.4], false),
    roughness: makeTexture(size, size, roughness, [2.2, 4.4], false),
  };
}

function createGlassMaps(seed: number, tone: "blue" | "dark") {
  const width = 512;
  const height = 1024;
  const random = seeded(seed);

  const color = new Uint8Array(width * height * 4);
  const roughness = new Uint8Array(width * height * 4);
  const bump = new Uint8Array(width * height * 4);
  const emissive = new Uint8Array(width * height * 4);

  const cols = 8;
  const rows = 18;
  const cellW = width / cols;
  const cellH = height / rows;

  const reflectionBands = Array.from({ length: 8 }, () => ({
    center: 0.03 + random() * 0.94,
    width: 0.018 + random() * 0.075,
    strength: 12 + random() * 48,
  }));

  const panelTint = Array.from({ length: cols * rows }, () => (random() - 0.5) * 15);
  const panelRoughness = Array.from({ length: cols * rows }, () => 40 + random() * 46);
  const panelLit = Array.from({ length: cols * rows }, () => random() > 0.86);

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);

    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const i = (y * width + x) * 4;

      const col = Math.min(cols - 1, Math.floor(x / cellW));
      const row = Math.min(rows - 1, Math.floor(y / cellH));
      const panel = row * cols + col;
      const localX = x - col * cellW;
      const localY = y - row * cellH;
      const edge = localX < 2.2 || localY < 2.2 || localX > cellW - 2.2 || localY > cellH - 2.2;

      let reflection = 0;
      for (const band of reflectionBands) {
        reflection += Math.exp(-Math.pow((u - band.center) / band.width, 2)) * band.strength;
      }

      const horizon = Math.exp(-Math.pow((v - 0.63) / 0.09, 2)) * 24;
      const sky = Math.pow(1 - v, 0.62) * 37;
      const cloud =
        Math.max(0, Math.sin(u * 14.5 + v * 5.3 + seed * 0.01) * 0.5 + 0.5) *
        Math.max(0, Math.sin(v * 13.8 + 1.4)) *
        8;
      const verticalShade = Math.sin(u * Math.PI * 4.2 + 0.5) * 3.2;
      const fine = (random() - 0.5) * 2.2;

      const base = tone === "blue" ? [47, 104, 142] : [30, 61, 78];
      const tint = panelTint[panel];
      const frameShade = edge ? 0.38 : 1;

      color[i] = THREE.MathUtils.clamp(
        (base[0] + tint + reflection * 0.38 + sky * 0.25 + horizon * 0.35 + verticalShade + fine) * frameShade,
        0,
        255,
      );
      color[i + 1] = THREE.MathUtils.clamp(
        (base[1] + tint + reflection * 0.68 + sky * 0.62 + horizon + cloud + verticalShade + fine) * frameShade,
        0,
        255,
      );
      color[i + 2] = THREE.MathUtils.clamp(
        (base[2] + tint + reflection + sky + horizon * 1.25 + cloud + verticalShade + fine) * frameShade,
        0,
        255,
      );
      color[i + 3] = 255;

      const rough = edge ? 180 : THREE.MathUtils.clamp(panelRoughness[panel] + (random() - 0.5) * 8, 28, 98);
      roughness[i] = rough;
      roughness[i + 1] = rough;
      roughness[i + 2] = rough;
      roughness[i + 3] = 255;

      const bumpValue = edge ? 85 : 145 + Math.round((random() - 0.5) * 6);
      bump[i] = bumpValue;
      bump[i + 1] = bumpValue;
      bump[i + 2] = bumpValue;
      bump[i + 3] = 255;

      const lit = panelLit[panel] && !edge;
      const warmFalloff = Math.exp(-Math.pow((localY / cellH - 0.5) / 0.54, 2));
      emissive[i] = lit ? Math.round(235 * warmFalloff) : 0;
      emissive[i + 1] = lit ? Math.round(170 * warmFalloff) : 0;
      emissive[i + 2] = lit ? Math.round(88 * warmFalloff) : 0;
      emissive[i + 3] = 255;
    }
  }

  return {
    color: makeTexture(width, height, color, [1, 1], true),
    roughness: makeTexture(width, height, roughness, [1, 1], false),
    bump: makeTexture(width, height, bump, [1, 1], false),
    emissive: makeTexture(width, height, emissive, [1, 1], true),
  };
}

function createMetalTexture(seed: number) {
  const size = 256;
  const random = seeded(seed);
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const brushing = Math.sin(y * 3.2) * 3.5 + Math.sin(y * 0.35) * 2 + (random() - 0.5) * 5.5;
      const value = THREE.MathUtils.clamp(108 + brushing, 82, 138);
      data[i] = value;
      data[i + 1] = value + 4;
      data[i + 2] = value + 7;
      data[i + 3] = 255;
    }
  }

  return makeTexture(size, size, data, [2, 16], true);
}

const STONE_MAPS = createStoneMaps(1401);
const GLASS_BLUE_MAPS = createGlassMaps(2201, "blue");
const GLASS_DARK_MAPS = createGlassMaps(2209, "dark");
const METAL_MAP = createMetalTexture(1501);

/* ========================================================================== */
/* MATERIALS                                                                  */
/* ========================================================================== */

const STONE = new THREE.MeshStandardMaterial({
  color: "#d3cec5",
  map: STONE_MAPS.color,
  bumpMap: STONE_MAPS.bump,
  bumpScale: 0.024,
  roughnessMap: STONE_MAPS.roughness,
  roughness: 0.82,
  metalness: 0.01,
  envMapIntensity: 0.75,
});

const STONE_LIGHT = new THREE.MeshStandardMaterial({
  color: "#e0dcd5",
  map: STONE_MAPS.color,
  bumpMap: STONE_MAPS.bump,
  bumpScale: 0.02,
  roughnessMap: STONE_MAPS.roughness,
  roughness: 0.77,
  metalness: 0.01,
  envMapIntensity: 0.82,
});

const STONE_DARK = new THREE.MeshStandardMaterial({
  color: "#91928e",
  map: STONE_MAPS.color,
  bumpMap: STONE_MAPS.bump,
  bumpScale: 0.018,
  roughnessMap: STONE_MAPS.roughness,
  roughness: 0.79,
  metalness: 0.02,
});

const DARK_METAL = new THREE.MeshStandardMaterial({
  color: "#222f35",
  map: METAL_MAP,
  roughness: 0.2,
  metalness: 0.78,
  envMapIntensity: 1.7,
});

const MID_METAL = new THREE.MeshStandardMaterial({
  color: "#66757c",
  map: METAL_MAP,
  roughness: 0.23,
  metalness: 0.66,
  envMapIntensity: 1.48,
});

const ROOF_METAL = new THREE.MeshStandardMaterial({
  color: "#2b373d",
  map: METAL_MAP,
  roughness: 0.29,
  metalness: 0.62,
  envMapIntensity: 1.45,
});

const INTERIOR = new THREE.MeshStandardMaterial({
  color: "#17242b",
  roughness: 0.58,
  metalness: 0.01,
});

const INTERIOR_FLOOR = new THREE.MeshStandardMaterial({
  color: "#39454a",
  roughness: 0.62,
  metalness: 0.04,
});

const WARM_WINDOW_DAY = new THREE.MeshStandardMaterial({
  color: "#c99d69",
  emissive: new THREE.Color("#744822"),
  emissiveIntensity: 0.08,
  roughness: 0.55,
});

const WARM_WINDOW_NIGHT = new THREE.MeshStandardMaterial({
  color: "#ffe2ad",
  emissive: new THREE.Color("#ffb45d"),
  emissiveIntensity: 1.45,
  roughness: 0.48,
  toneMapped: false,
});

const PLANTER = new THREE.MeshStandardMaterial({
  color: "#817d75",
  roughness: 0.9,
});

const LEAF = new THREE.MeshStandardMaterial({
  color: "#3f6339",
  roughness: 0.96,
});

const LEAF_LIGHT = new THREE.MeshStandardMaterial({
  color: "#5f7f4f",
  roughness: 0.96,
});

const TRUNK_MAT = new THREE.MeshStandardMaterial({
  color: "#5d4936",
  roughness: 0.96,
});

const GRASS = new THREE.MeshStandardMaterial({
  color: "#55764a",
  roughness: 0.98,
});

const AC_BODY = new THREE.MeshStandardMaterial({
  color: "#bfc3c1",
  roughness: 0.56,
  metalness: 0.2,
});

const AC_FAN = new THREE.MeshStandardMaterial({
  color: "#394247",
  roughness: 0.38,
  metalness: 0.5,
});

function createGlassMaterial(
  maps: ReturnType<typeof createGlassMaps>,
  isNight: boolean,
  color: string,
  nightColor: string,
) {
  // Opaque standard glass is intentional here. The old clear-coated physical
  // material was expensive across many towers and the few transparent layers
  // could shimmer when the camera moved. This still reads as reflective blue
  // architectural glass, but keeps depth sorting and GPU cost predictable.
  return new THREE.MeshStandardMaterial({
    color: isNight ? nightColor : color,
    map: maps.color,
    roughnessMap: maps.roughness,
    bumpMap: maps.bump,
    bumpScale: 0.0024,
    emissiveMap: isNight ? maps.emissive : undefined,
    emissive: new THREE.Color(isNight ? "#9b7049" : "#000000"),
    emissiveIntensity: isNight ? 0.5 : 0,
    roughness: isNight ? 0.28 : 0.2,
    metalness: 0.18,
    envMapIntensity: isNight ? 1.22 : 1.35,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.FrontSide,
  });
}

const GLASS_BLUE_DAY = createGlassMaterial(GLASS_BLUE_MAPS, false, "#9ec9df", "#4b7184");
const GLASS_BLUE_NIGHT = createGlassMaterial(GLASS_BLUE_MAPS, true, "#9ec9df", "#577583");
const GLASS_DARK_DAY = createGlassMaterial(GLASS_DARK_MAPS, false, "#789ead", "#375361");
const GLASS_DARK_NIGHT = createGlassMaterial(GLASS_DARK_MAPS, true, "#789ead", "#3d5662");

const BALCONY_GLASS_DAY = new THREE.MeshStandardMaterial({
  color: "#7295a2",
  roughness: 0.3,
  metalness: 0.18,
  envMapIntensity: 1.15,
  transparent: false,
  depthWrite: true,
  side: THREE.FrontSide,
});

const BALCONY_GLASS_NIGHT = new THREE.MeshStandardMaterial({
  color: "#4b6976",
  roughness: 0.34,
  metalness: 0.16,
  envMapIntensity: 1.0,
  transparent: false,
  depthWrite: true,
  side: THREE.FrontSide,
});

const ENTRY_GLASS_DAY = new THREE.MeshStandardMaterial({
  color: "#789aa8",
  roughness: 0.28,
  metalness: 0.16,
  envMapIntensity: 1.2,
  transparent: false,
  depthWrite: true,
  side: THREE.FrontSide,
});

const ENTRY_GLASS_NIGHT = new THREE.MeshStandardMaterial({
  color: "#667b80",
  emissive: new THREE.Color("#b47738"),
  emissiveIntensity: 0.7,
  roughness: 0.32,
  metalness: 0.12,
  envMapIntensity: 0.86,
  transparent: false,
  depthWrite: true,
  side: THREE.FrontSide,
});

const PAVING = new THREE.MeshStandardMaterial({
  color: "#aaa69e",
  map: STONE_MAPS.color,
  bumpMap: STONE_MAPS.bump,
  bumpScale: 0.009,
  roughnessMap: STONE_MAPS.roughness,
  roughness: 0.9,
  metalness: 0,
});

const DOOR_HANDLE = new THREE.MeshStandardMaterial({
  color: "#b8bec0",
  roughness: 0.2,
  metalness: 0.82,
  envMapIntensity: 1.5,
});

/* ========================================================================== */
/* MATRIX / INSTANCING                                                        */
/* ========================================================================== */

function matrix(
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
  scale: Vec3 = [1, 1, 1],
) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
}

function smoothstep01(x: number, edge0: number, edge1: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function InstanceBatch({
  matrices,
  geometry = BOX,
  material,
  castShadow = false,
  receiveShadow = false,
}: {
  matrices: THREE.Matrix4[];
  geometry?: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    matrices.forEach((item, index) => mesh.setMatrixAt(index, item));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
  }, [matrices]);

  if (matrices.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, matrices.length]}
      geometry={geometry}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      dispose={null}
    />
  );
}

/* ========================================================================== */
/* GLASS CURTAIN WALL                                                         */
/* ========================================================================== */

function GlassFacadePlane({
  position,
  rotation = [0, 0, 0],
  size,
  material,
}: {
  position: Vec3;
  rotation?: Vec3;
  size: [number, number];
  material: THREE.Material;
}) {
  return (
    <mesh
      geometry={PLANE}
      material={material}
      position={position}
      rotation={rotation}
      scale={[size[0], size[1], 1]}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

function InteriorGlowPanels({
  position,
  width,
  height,
  depth,
  floors,
  columns,
  isNight,
}: {
  position: Vec3;
  width: number;
  height: number;
  depth: number;
  floors: number;
  columns: number;
  isNight: boolean;
}) {
  const panels = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const bottom = position[1] - height / 2;
    const floorH = height / floors;
    const colW = width / columns;

    for (let f = 0; f < floors; f += 1) {
      for (let c = 0; c < columns; c += 1) {
        if (((f * 7 + c * 11 + 3) % 13) > 8) {
          out.push(
            matrix(
              [
                position[0] - width / 2 + colW * (c + 0.5),
                bottom + floorH * (f + 0.53),
                position[2] + depth / 2 - 0.035,
              ],
              [0, 0, 0],
              [colW * 0.76, floorH * 0.57, 0.025],
            ),
          );
        }
      }
    }
    return out;
  }, [columns, depth, floors, height, position, width]);

  return (
    <InstanceBatch
      matrices={panels}
      material={isNight ? WARM_WINDOW_NIGHT : WARM_WINDOW_DAY}
    />
  );
}

function CurtainWallTower({
  position,
  width,
  height,
  depth,
  floors,
  columns,
  isNight,
  tone = "blue",
  stoneSide = false,
}: {
  position: Vec3;
  width: number;
  height: number;
  depth: number;
  floors: number;
  columns: number;
  isNight: boolean;
  tone?: "blue" | "dark";
  stoneSide?: boolean;
}) {
  const glass = tone === "blue"
    ? isNight
      ? GLASS_BLUE_NIGHT
      : GLASS_BLUE_DAY
    : isNight
      ? GLASS_DARK_NIGHT
      : GLASS_DARK_DAY;

  const frontZ = position[2] + depth / 2 + 0.022;
  const backZ = position[2] - depth / 2 - 0.022;
  const rightX = position[0] + width / 2 + 0.022;
  const leftX = position[0] - width / 2 - 0.022;

  const mullions = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let c = 1; c < columns; c += 1) {
      const x = position[0] - width / 2 + (c / columns) * width;
      out.push(
        matrix([x, position[1], frontZ + 0.02], [0, 0, 0], [0.045, height * 0.976, 0.045]),
        matrix([x, position[1], backZ - 0.02], [0, 0, 0], [0.045, height * 0.976, 0.045]),
      );
    }

    const sideCount = Math.max(3, Math.round(depth / 1.45));
    for (let c = 1; c < sideCount; c += 1) {
      const z = position[2] - depth / 2 + (c / sideCount) * depth;
      out.push(
        matrix([rightX + 0.02, position[1], z], [0, 0, 0], [0.045, height * 0.976, 0.045]),
        matrix([leftX - 0.02, position[1], z], [0, 0, 0], [0.045, height * 0.976, 0.045]),
      );
    }
    return out;
  }, [backZ, columns, depth, frontZ, height, leftX, position, rightX, width]);

  const floorBands = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const bottom = position[1] - height / 2;

    for (let f = 1; f < floors; f += 1) {
      const y = bottom + (f / floors) * height;
      out.push(
        matrix([position[0], y, frontZ + 0.018], [0, 0, 0], [width * 0.985, 0.07, 0.045]),
        matrix([position[0], y, backZ - 0.018], [0, 0, 0], [width * 0.985, 0.07, 0.045]),
        matrix([rightX + 0.018, y, position[2]], [0, 0, 0], [0.045, 0.07, depth * 0.985]),
        matrix([leftX - 0.018, y, position[2]], [0, 0, 0], [0.045, 0.07, depth * 0.985]),
      );
    }
    return out;
  }, [backZ, depth, floors, frontZ, height, leftX, position, rightX, width]);

  const slabs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const bottom = position[1] - height / 2;
    for (let f = 1; f < floors; f += 1) {
      const y = bottom + (f / floors) * height - 0.04;
      out.push(matrix([position[0], y, position[2]], [0, 0, 0], [width * 0.91, 0.075, depth * 0.9]));
    }
    return out;
  }, [depth, floors, height, position, width]);

  return (
    <group dispose={null}>
      <mesh
        geometry={BOX}
        material={INTERIOR}
        position={position}
        scale={[width * 0.94, height * 0.97, depth * 0.94]}
      />

      <GlassFacadePlane position={[position[0], position[1], frontZ]} size={[width, height]} material={glass} />
      <GlassFacadePlane position={[position[0], position[1], backZ]} rotation={[0, Math.PI, 0]} size={[width, height]} material={glass} />
      <GlassFacadePlane position={[rightX, position[1], position[2]]} rotation={[0, Math.PI / 2, 0]} size={[depth, height]} material={glass} />
      <GlassFacadePlane position={[leftX, position[1], position[2]]} rotation={[0, -Math.PI / 2, 0]} size={[depth, height]} material={glass} />

      <InteriorGlowPanels
        position={position}
        width={width}
        height={height}
        depth={depth}
        floors={floors}
        columns={columns}
        isNight={isNight}
      />

      <InstanceBatch matrices={slabs} material={INTERIOR_FLOOR} />
      <InstanceBatch matrices={mullions} material={DARK_METAL} />
      <InstanceBatch matrices={floorBands} material={DARK_METAL} />

      {stoneSide && (
        <>
          <mesh
            geometry={BOX}
            material={STONE_LIGHT}
            position={[leftX - 0.22, position[1], position[2] - 0.34]}
            scale={[0.46, height * 1.012, depth * 0.77]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={BOX}
            material={STONE_LIGHT}
            position={[rightX + 0.22, position[1], position[2] - 0.34]}
            scale={[0.46, height * 1.012, depth * 0.77]}
            castShadow
            receiveShadow
          />
        </>
      )}
    </group>
  );
}

/* ========================================================================== */
/* LANDSCAPE                                                                  */
/* ========================================================================== */

function PlanterRow({
  position,
  width,
  count,
  scale = 1,
}: {
  position: Vec3;
  width: number;
  count: number;
  scale?: number;
}) {
  const shrubs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i += 1) {
      const x = position[0] - width / 2 + ((i + 0.5) / count) * width;
      const s = (0.34 + (i % 3) * 0.055) * scale;
      out.push(matrix([x, position[1] + 0.5 * scale, position[2]], [0, i * 0.64, 0], [s, s * 0.88, s]));
    }
    return out;
  }, [count, position, scale, width]);

  return (
    <group>
      <mesh
        geometry={BOX}
        material={PLANTER}
        position={position}
        scale={[width, 0.62 * scale, 1.35 * scale]}
        castShadow
        receiveShadow
      />
      <InstanceBatch matrices={shrubs} geometry={PLANT} material={LEAF} />
    </group>
  );
}

function RoofGarden({
  position,
  width,
  depth,
}: {
  position: Vec3;
  width: number;
  depth: number;
}) {
  const plants = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 7; i += 1) {
      const x = position[0] - width * 0.38 + (i / 6) * width * 0.76;
      const z = position[2] + (i % 2 === 0 ? -depth * 0.18 : depth * 0.13);
      const s = 0.28 + (i % 3) * 0.045;
      out.push(matrix([x, position[1] + 0.43, z], [0, i * 0.7, 0], [s, s * 1.15, s]));
    }
    return out;
  }, [depth, position, width]);

  return (
    <group>
      <mesh geometry={BOX} material={PLANTER} position={position} scale={[width, 0.38, depth]} />
      <mesh geometry={BOX} material={GRASS} position={[position[0], position[1] + 0.22, position[2]]} scale={[width * 0.88, 0.08, depth * 0.82]} />
      <InstanceBatch matrices={plants} geometry={SMALL_PLANT} material={LEAF_LIGHT} />
    </group>
  );
}

/* ========================================================================== */
/* REALISTIC ARCHITECTURAL ENTRANCE                                           */
/* ========================================================================== */

function RealisticEntrance({
  centerX,
  frontZ,
  width,
  canopyWidth,
  isNight,
  rampSide = "right",
}: {
  centerX: number;
  frontZ: number;
  width: number;
  canopyWidth: number;
  isNight: boolean;
  rampSide?: "left" | "right";
}) {
  const glass = isNight ? ENTRY_GLASS_NIGHT : ENTRY_GLASS_DAY;
  const doorWidth = width / 4;
  const canopyFront = frontZ + 1.55;
  const rampDirection = rampSide === "right" ? 1 : -1;

  const handles = useMemo(
    () =>
      [-0.42, 0.42].map((offset) =>
        matrix(
          [centerX + offset, 1.72, frontZ + 0.105],
          [0, 0, 0],
          [0.035, 0.56, 0.035],
        ),
      ),
    [centerX, frontZ],
  );

  const bollards = useMemo(
    () =>
      [-canopyWidth * 0.42, -canopyWidth * 0.27, canopyWidth * 0.27, canopyWidth * 0.42].map((x) =>
        matrix(
          [centerX + x, 0.48, frontZ + 2.52],
          [0, 0, 0],
          [0.09, 0.82, 0.09],
        ),
      ),
    [canopyWidth, centerX, frontZ],
  );

  return (
    <group dispose={null}>
      {/* Recessed lobby volume gives the entrance believable depth. */}
      <mesh
        geometry={BOX}
        material={INTERIOR}
        position={[centerX, 2.05, frontZ - 0.62]}
        scale={[width + 1.5, 3.95, 1.22]}
        castShadow
      />

      {/* Portal surround. */}
      <mesh geometry={BOX} material={STONE_LIGHT} position={[centerX - width / 2 - 0.18, 2.1, frontZ]} scale={[0.34, 4.18, 0.38]} castShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[centerX + width / 2 + 0.18, 2.1, frontZ]} scale={[0.34, 4.18, 0.38]} castShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[centerX, 4.08, frontZ]} scale={[width + 0.7, 0.32, 0.38]} castShadow />

      {/* Four realistic glass door leaves. */}
      {[-1.5, -0.5, 0.5, 1.5].map((slot) => (
        <GlassFacadePlane
          key={slot}
          position={[centerX + slot * doorWidth, 1.85, frontZ + 0.09]}
          size={[doorWidth * 0.86, 3.05]}
          material={glass}
        />
      ))}

      {/* Door jambs and centre meeting rails. */}
      {[-2, -1, 0, 1, 2].map((slot) => (
        <mesh
          key={slot}
          geometry={BOX}
          material={DARK_METAL}
          position={[centerX + slot * doorWidth, 1.85, frontZ + 0.12]}
          scale={[0.055, 3.15, 0.07]}
        />
      ))}

      {/* Transom glazing above the doors. */}
      <GlassFacadePlane
        position={[centerX, 3.67, frontZ + 0.09]}
        size={[width * 0.96, 0.62]}
        material={glass}
      />
      <mesh geometry={BOX} material={DARK_METAL} position={[centerX, 3.34, frontZ + 0.12]} scale={[width * 0.98, 0.055, 0.07]} />

      {/* Stainless pull handles. */}
      <InstanceBatch matrices={handles} material={DOOR_HANDLE} />

      {/* Threshold and durable entrance mat. */}
      <mesh geometry={BOX} material={MID_METAL} position={[centerX, 0.28, frontZ + 0.16]} scale={[width * 0.96, 0.08, 0.34]} />
      <mesh geometry={BOX} material={INTERIOR} position={[centerX, 0.22, frontZ + 0.82]} scale={[width * 0.68, 0.045, 0.72]} />

      {/* Deep weather canopy with believable support columns. */}
      <mesh
        geometry={BOX}
        material={DARK_METAL}
        position={[centerX, 4.62, canopyFront]}
        scale={[canopyWidth, 0.28, 3.15]}
        castShadow
      />
      <mesh
        geometry={BOX}
        material={isNight ? WARM_WINDOW_NIGHT : WARM_WINDOW_DAY}
        position={[centerX, 4.43, canopyFront + 0.05]}
        scale={[canopyWidth * 0.82, 0.035, 2.35]}
      />
      {[-canopyWidth * 0.43, canopyWidth * 0.43].map((x) => (
        <mesh
          key={x}
          geometry={BOX}
          material={DARK_METAL}
          position={[centerX + x, 2.35, frontZ + 2.18]}
          scale={[0.17, 4.45, 0.17]}
          castShadow
        />
      ))}

      {/* Steps are shallow and proportional to a commercial entrance. */}
      {[0, 1, 2].map((step) => (
        <mesh
          key={step}
          geometry={BOX}
          material={PAVING}
          position={[centerX, 0.10 + step * 0.09, frontZ + 1.18 + step * 0.38]}
          scale={[canopyWidth * (0.94 - step * 0.025), 0.18, 0.76]}
          receiveShadow
        />
      ))}

      {/* Accessible side ramp, so the entrance reads like a real building. */}
      <mesh
        geometry={BOX}
        material={PAVING}
        position={[
          centerX + rampDirection * (canopyWidth * 0.62),
          0.17,
          frontZ + 1.92,
        ]}
        rotation={[rampDirection * -0.02, 0, 0]}
        scale={[2.2, 0.16, 4.5]}
        receiveShadow
      />
      {[-0.9, 0.9].map((zOffset) => (
        <mesh
          key={zOffset}
          geometry={BOX}
          material={MID_METAL}
          position={[
            centerX + rampDirection * (canopyWidth * 0.62 + 1.02),
            0.67,
            frontZ + 1.92 + zOffset,
          ]}
          scale={[0.055, 0.95, 0.055]}
        />
      ))}
      <mesh
        geometry={BOX}
        material={MID_METAL}
        position={[
          centerX + rampDirection * (canopyWidth * 0.62 + 1.02),
          1.12,
          frontZ + 1.92,
        ]}
        scale={[0.055, 0.055, 2.2]}
      />

      {/* Forecourt paving and vehicle-safe bollards. */}
      <mesh geometry={BOX} material={PAVING} position={[centerX, 0.055, frontZ + 3.0]} scale={[canopyWidth + 4.4, 0.11, 3.9]} receiveShadow />
      <InstanceBatch matrices={bollards} material={DARK_METAL} />
    </group>
  );
}

/* ========================================================================== */
/* CENTRAL BALCONIES                                                          */
/* ========================================================================== */

function CentralBalconyStack({ isNight }: { isNight: boolean }) {
  const balconyGlass = isNight ? BALCONY_GLASS_NIGHT : BALCONY_GLASS_DAY;

  const slabs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 9; f += 1) {
      const y = 6.2 + f * 2.55;
      out.push(matrix([0.08, y, 4.06], [0, 0, 0], [5.28, 0.17, 1.55]));
    }
    return out;
  }, []);

  const rails = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 9; f += 1) {
      const y = 6.82 + f * 2.55;
      out.push(matrix([0.08, y, 4.8], [0, 0, 0], [4.88, 0.86, 0.045]));
    }
    return out;
  }, []);

  const posts = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 9; f += 1) {
      const y = 6.82 + f * 2.55;
      out.push(
        matrix([-2.36, y, 4.78], [0, 0, 0], [0.055, 0.86, 0.055]),
        matrix([2.52, y, 4.78], [0, 0, 0], [0.055, 0.86, 0.055]),
      );
    }
    return out;
  }, []);

  const planterMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 9; f += 3) {
      const y = 6.52 + f * 2.55;
      out.push(
        matrix([-1.4, y, 4.35], [0, 0, 0], [0.8, 0.3, 0.4]),
        matrix([1.55, y, 4.35], [0, 0, 0], [0.8, 0.3, 0.4]),
      );
    }
    return out;
  }, []);

  const plantMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 9; f += 3) {
      const y = 6.82 + f * 2.55;
      out.push(
        matrix([-1.4, y, 4.35], [0, f * 0.3, 0], [0.28, 0.34, 0.28]),
        matrix([1.55, y, 4.35], [0, f * 0.5, 0], [0.28, 0.34, 0.28]),
      );
    }
    return out;
  }, []);

  return (
    <group dispose={null}>
      <mesh geometry={BOX} material={INTERIOR} position={[0.08, 15.9, 3.13]} scale={[5.45, 24.2, 0.72]} />
      <InstanceBatch matrices={slabs} material={STONE_LIGHT} castShadow receiveShadow />
      <InstanceBatch matrices={rails} material={balconyGlass} />
      <InstanceBatch matrices={posts} material={MID_METAL} />
      <InstanceBatch matrices={planterMatrices} material={PLANTER} />
      <InstanceBatch matrices={plantMatrices} geometry={SMALL_PLANT} material={LEAF_LIGHT} />

      <mesh geometry={BOX} material={DARK_METAL} position={[0.08, 15.8, 4.97]} scale={[0.5, 23.6, 0.28]} castShadow />
      {[-0.3, 0.3].map((x) => (
        <mesh
          key={x}
          geometry={BOX}
          material={MID_METAL}
          position={[0.08 + x, 15.8, 5.12]}
          scale={[0.055, 23.0, 0.055]}
        />
      ))}
    </group>
  );
}

/* ========================================================================== */
/* GROUND / ENTRANCE                                                          */
/* ========================================================================== */

function GroundPodium({ isNight }: { isNight: boolean }) {
  const lobbyGlass = isNight ? GLASS_DARK_NIGHT : GLASS_DARK_DAY;

  return (
    <group>
      <mesh geometry={BOX} material={STONE} position={[0, 0.12, 0]} scale={[19.2, 0.24, 13.4]} receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 2.28, 0]} scale={[17.1, 4.32, 10.9]} castShadow receiveShadow />

      {/* ground-floor facade glass */}
      <GlassFacadePlane position={[0, 2.25, 5.48]} size={[14.9, 3.7]} material={lobbyGlass} />
      <GlassFacadePlane position={[8.58, 2.25, 0]} rotation={[0, Math.PI / 2, 0]} size={[9.7, 3.7]} material={lobbyGlass} />

      {/* ground mullions */}
      {[-5.6, -3.8, -2.0, 0, 2.0, 3.8, 5.6].map((x) => (
        <mesh key={x} geometry={BOX} material={DARK_METAL} position={[x, 2.25, 5.53]} scale={[0.07, 3.75, 0.07]} />
      ))}

      {/* lobby ceiling and warm interior */}
      <mesh geometry={BOX} material={INTERIOR_FLOOR} position={[-2.35, 3.95, 3.85]} scale={[6.2, 0.14, 2.5]} />
      <mesh geometry={BOX} material={isNight ? WARM_WINDOW_NIGHT : WARM_WINDOW_DAY} position={[-2.35, 2.3, 5.36]} scale={[5.6, 2.5, 0.04]} />

      <RealisticEntrance
        centerX={-2.4}
        frontZ={5.62}
        width={4.35}
        canopyWidth={7.2}
        isNight={isNight}
        rampSide="right"
      />

      <PlanterRow position={[-6.85, 0.36, 6.1]} width={3.25} count={5} />
      <PlanterRow position={[5.5, 0.36, 6.1]} width={4.7} count={7} />
    </group>
  );
}

/* ========================================================================== */
/* ROOFTOP                                                                    */
/* ========================================================================== */

function Rooftop({ isNight }: { isNight: boolean }) {
  const glass = isNight ? GLASS_DARK_NIGHT : GLASS_DARK_DAY;

  const louvers = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 11; i += 1) {
      out.push(matrix([-4.45 + i * 0.69, 34.55, 2.44], [0, 0, 0], [0.07, 2.0, 0.08]));
    }
    return out;
  }, []);

  return (
    <group>
      <mesh geometry={BOX} material={ROOF_METAL} position={[-0.15, 32.68, -0.15]} scale={[14.7, 0.44, 11.2]} castShadow />

      <mesh geometry={BOX} material={STONE_LIGHT} position={[-1.25, 34.25, -0.82]} scale={[8.1, 2.95, 5.85]} castShadow receiveShadow />
      <GlassFacadePlane position={[-1.25, 34.25, 2.14]} size={[7.2, 2.15]} material={glass} />
      <InstanceBatch matrices={louvers} material={DARK_METAL} />

      {/* rooftop mechanical plant */}
      <mesh geometry={BOX} material={STONE_DARK} position={[3.5, 34.55, -2.35]} scale={[1.7, 2.35, 1.8]} castShadow />
      <mesh geometry={BOX} material={DARK_METAL} position={[1.38, 34.85, -2.4]} scale={[0.85, 2.95, 1.3]} castShadow />
      <mesh geometry={BOX} material={MID_METAL} position={[4.75, 34.05, -1.0]} scale={[1.15, 1.5, 1.25]} castShadow />

      {/* AC fan face */}
      <mesh geometry={FAN} material={AC_FAN} position={[5.34, 34.05, -1.0]} rotation={[0, Math.PI / 2, 0]} scale={[0.35, 0.35, 1]} />

      <RoofGarden position={[3.12, 32.95, 2.0]} width={4.9} depth={2.95} />
      <RoofGarden position={[-5.05, 29.6, 1.62]} width={2.9} depth={2.05} />
    </group>
  );
}

/* ========================================================================== */
/* BUILDING                                                                   */
/* ========================================================================== */

export function PremiumReferenceBuilding({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isNight = false,
}: PremiumReferenceBuildingProps) {
  const upperGlass = isNight ? GLASS_BLUE_NIGHT : GLASS_BLUE_DAY;

  const rightStoneFrame = useMemo(
    () => [
      matrix([1.55, 18.05, 4.62], [0, 0, 0], [0.54, 21.8, 0.82]),
      matrix([8.2, 18.05, 4.62], [0, 0, 0], [0.54, 21.8, 0.82]),
      matrix([4.87, 7.3, 4.62], [0, 0, 0], [7.18, 0.55, 0.82]),
      matrix([4.87, 18.2, 4.62], [0, 0, 0], [7.18, 0.55, 0.82]),
      matrix([4.87, 28.75, 4.62], [0, 0, 0], [7.18, 0.55, 0.82]),
    ],
    [],
  );

  const facadeStoneJointLines = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let y = 9.5; y <= 27; y += 3.0) {
      out.push(matrix([4.9, y, 5.04], [0, 0, 0], [6.8, 0.035, 0.035]));
    }
    return out;
  }, []);

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      <GroundPodium isNight={isNight} />

      {/* left tower */}
      <CurtainWallTower
        position={[-5.15, 16.25, -0.65]}
        width={5.45}
        height={24.7}
        depth={8.1}
        floors={9}
        columns={5}
        isNight={isNight}
        tone="blue"
      />

      {/* central full-height stone spine */}
      <mesh
        geometry={BOX}
        material={STONE_LIGHT}
        position={[-1.62, 17.75, -2.72]}
        scale={[2.42, 30.0, 3.52]}
        castShadow
        receiveShadow
      />

      <CentralBalconyStack isNight={isNight} />

      {/* right tower */}
      <CurtainWallTower
        position={[4.9, 18.0, -0.2]}
        width={6.85}
        height={28.4}
        depth={9.2}
        floors={10}
        columns={6}
        isNight={isNight}
        tone="blue"
        stoneSide
      />

      {/* deep architectural stone surround */}
      <InstanceBatch matrices={rightStoneFrame} material={STONE_LIGHT} castShadow receiveShadow />
      <InstanceBatch matrices={facadeStoneJointLines} material={STONE_DARK} />

      {/* stepped upper terrace */}
      <mesh geometry={BOX} material={STONE_LIGHT} position={[3.35, 29.55, 0.72]} scale={[6.5, 1.08, 7.7]} castShadow receiveShadow />
      <mesh geometry={BOX} material={INTERIOR} position={[3.35, 30.35, 0.72]} scale={[5.55, 2.0, 6.8]} />
      <GlassFacadePlane position={[3.35, 30.35, 4.16]} size={[5.85, 2.25]} material={upperGlass} />
      <GlassFacadePlane position={[6.32, 30.35, 0.72]} rotation={[0, Math.PI / 2, 0]} size={[6.9, 2.25]} material={upperGlass} />
      <mesh geometry={BOX} material={DARK_METAL} position={[3.35, 31.5, 4.2]} scale={[6.15, 0.18, 0.14]} castShadow />

      <Rooftop isNight={isNight} />
    </group>
  );
}

/* ========================================================================== */
/* WIDE BUILDING TWO - SHORTER / BROADER PREMIUM OFFICE                      */
/* ========================================================================== */

export function PremiumWideBuildingTwo({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isNight = false,
}: PremiumReferenceBuildingProps) {
  const lobbyGlass = isNight ? GLASS_DARK_NIGHT : GLASS_DARK_DAY;

  const podiumMullions = useMemo(
    () =>
      [-8.0, -6.0, -4.0, -2.0, 0, 2.0, 4.0, 6.0, 8.0].map((x) =>
        matrix([x, 2.05, 5.76], [0, 0, 0], [0.065, 3.25, 0.065]),
      ),
    [],
  );

  const crownLouvers = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 9; i += 1) {
      out.push(matrix([-2.65 + i * 0.66, 26.05, 2.28], [0, 0, 0], [0.06, 1.55, 0.08]));
    }
    return out;
  }, []);

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      {/* Broad low podium */}
      <mesh geometry={BOX} material={STONE} position={[0, 0.12, 0]} scale={[25.2, 0.24, 14.4]} receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 2.08, 0]} scale={[22.8, 3.9, 11.45]} castShadow receiveShadow />

      {/* Full-width premium lobby */}
      <GlassFacadePlane position={[0, 2.05, 5.78]} size={[19.1, 3.22]} material={lobbyGlass} />
      <InstanceBatch matrices={podiumMullions} material={DARK_METAL} />
      <mesh geometry={BOX} material={INTERIOR_FLOOR} position={[0, 3.65, 4.18]} scale={[18.7, 0.13, 2.45]} />
      <mesh geometry={BOX} material={isNight ? WARM_WINDOW_NIGHT : WARM_WINDOW_DAY} position={[0, 2.0, 5.64]} scale={[17.7, 2.35, 0.035]} />

      <RealisticEntrance
        centerX={-4.35}
        frontZ={5.86}
        width={4.75}
        canopyWidth={7.6}
        isNight={isNight}
        rampSide="right"
      />

      {/* Left wing - wider and shorter */}
      <CurtainWallTower
        position={[-7.05, 12.55, -0.55]}
        width={6.8}
        height={17.25}
        depth={8.5}
        floors={6}
        columns={5}
        isNight={isNight}
        tone="blue"
        stoneSide
      />

      {/* Center feature volume */}
      <CurtainWallTower
        position={[0, 14.75, -0.78]}
        width={7.7}
        height={21.55}
        depth={8.95}
        floors={7}
        columns={6}
        isNight={isNight}
        tone="dark"
      />

      {/* Right wing */}
      <CurtainWallTower
        position={[7.05, 12.72, -0.42]}
        width={6.8}
        height={17.55}
        depth={8.3}
        floors={6}
        columns={5}
        isNight={isNight}
        tone="blue"
        stoneSide
      />

      {/* Architectural stone blades */}
      <mesh geometry={BOX} material={STONE_LIGHT} position={[-3.78, 13.3, 4.03]} scale={[0.54, 18.1, 0.7]} castShadow receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[3.78, 13.3, 4.03]} scale={[0.54, 18.1, 0.7]} castShadow receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 21.9, 4.03]} scale={[8.15, 0.58, 0.7]} castShadow receiveShadow />

      {/* Side terrace decks */}
      <mesh geometry={BOX} material={STONE_LIGHT} position={[-7.05, 21.38, 0.25]} scale={[6.95, 0.42, 8.1]} castShadow receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[7.05, 21.55, 0.3]} scale={[6.95, 0.42, 7.9]} castShadow receiveShadow />
      <RoofGarden position={[-7.05, 21.67, 0.3]} width={5.5} depth={5.7} />
      <RoofGarden position={[7.05, 21.84, 0.34]} width={5.5} depth={5.5} />

      {/* Center crown */}
      <mesh geometry={BOX} material={ROOF_METAL} position={[0, 25.14, -0.55]} scale={[9.1, 0.4, 9.45]} castShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 26.0, -0.72]} scale={[6.4, 1.55, 5.35]} castShadow receiveShadow />
      <GlassFacadePlane position={[0, 26.0, 1.99]} size={[5.55, 1.22]} material={lobbyGlass} />
      <InstanceBatch matrices={crownLouvers} material={DARK_METAL} />

      {/* Roof services */}
      <mesh geometry={BOX} material={STONE_DARK} position={[3.85, 25.88, -2.85]} scale={[1.65, 1.62, 1.55]} castShadow />
      <mesh geometry={BOX} material={MID_METAL} position={[5.1, 25.65, -1.45]} scale={[1.1, 1.15, 1.1]} castShadow />
      <mesh geometry={FAN} material={AC_FAN} position={[5.66, 25.65, -1.45]} rotation={[0, Math.PI / 2, 0]} scale={[0.3, 0.3, 1]} />

      <PlanterRow position={[-8.9, 0.36, 6.22]} width={3.2} count={5} />
      <PlanterRow position={[7.6, 0.36, 6.22]} width={5.0} count={7} />
    </group>
  );
}

/* ========================================================================== */
/* WIDE BUILDING THREE - SHORTER / BROADER RESIDENTIAL-CORPORATE             */
/* ========================================================================== */

export function PremiumWideBuildingThree({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isNight = false,
}: PremiumReferenceBuildingProps) {
  const balconyGlass = isNight ? BALCONY_GLASS_NIGHT : BALCONY_GLASS_DAY;
  const lobbyGlass = isNight ? GLASS_DARK_NIGHT : GLASS_DARK_DAY;

  const balconySlabs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 7; f += 1) {
      out.push(matrix([0, 6.0 + f * 2.55, 4.35], [0, 0, 0], [6.35, 0.16, 1.62]));
    }
    return out;
  }, []);

  const balconyRails = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 7; f += 1) {
      out.push(matrix([0, 6.6 + f * 2.55, 5.12], [0, 0, 0], [5.95, 0.84, 0.045]));
    }
    return out;
  }, []);

  const balconyPosts = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 7; f += 1) {
      const y = 6.6 + f * 2.55;
      out.push(
        matrix([-2.88, y, 5.1], [0, 0, 0], [0.055, 0.84, 0.055]),
        matrix([2.88, y, 5.1], [0, 0, 0], [0.055, 0.84, 0.055]),
      );
    }
    return out;
  }, []);

  const facadeFrame = useMemo(
    () => [
      matrix([-10.35, 13.7, 4.55], [0, 0, 0], [0.58, 20.5, 0.8]),
      matrix([10.35, 13.7, 4.55], [0, 0, 0], [0.58, 20.5, 0.8]),
      matrix([0, 23.65, 4.55], [0, 0, 0], [21.25, 0.62, 0.8]),
      matrix([-6.6, 13.75, 4.55], [0, 0, 0], [0.44, 19.6, 0.68]),
      matrix([6.6, 13.75, 4.55], [0, 0, 0], [0.44, 19.6, 0.68]),
    ],
    [],
  );

  const terracePlants = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 8; i += 1) {
      const x = -8.0 + i * 2.25;
      out.push(matrix([x, 24.35, 1.1 + (i % 2) * 0.9], [0, i * 0.65, 0], [0.3, 0.4, 0.3]));
    }
    return out;
  }, []);

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      {/* Wide base and lobby */}
      <mesh geometry={BOX} material={STONE} position={[0, 0.12, 0]} scale={[26.0, 0.24, 14.2]} receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 2.02, 0]} scale={[23.6, 3.75, 11.35]} castShadow receiveShadow />
      <GlassFacadePlane position={[0, 2.02, 5.74]} size={[20.0, 3.08]} material={lobbyGlass} />

      {[-8.2, -6.15, -4.1, -2.05, 0, 2.05, 4.1, 6.15, 8.2].map((x) => (
        <mesh key={x} geometry={BOX} material={DARK_METAL} position={[x, 2.02, 5.78]} scale={[0.065, 3.14, 0.065]} />
      ))}

      <RealisticEntrance
        centerX={0}
        frontZ={5.82}
        width={5.2}
        canopyWidth={8.0}
        isNight={isNight}
        rampSide="left"
      />

      {/* Left broad glass wing */}
      <CurtainWallTower
        position={[-7.2, 13.55, -0.42]}
        width={7.75}
        height={19.25}
        depth={8.55}
        floors={7}
        columns={6}
        isNight={isNight}
        tone="blue"
        stoneSide
      />

      {/* Right broad glass wing */}
      <CurtainWallTower
        position={[7.2, 13.55, -0.42]}
        width={7.75}
        height={19.25}
        depth={8.55}
        floors={7}
        columns={6}
        isNight={isNight}
        tone="blue"
        stoneSide
      />

      {/* Deep central recessed balcony / atrium */}
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 13.55, -2.92]} scale={[5.15, 20.15, 3.15]} castShadow receiveShadow />
      <mesh geometry={BOX} material={INTERIOR} position={[0, 13.65, 3.3]} scale={[6.55, 19.5, 0.7]} />
      <InstanceBatch matrices={balconySlabs} material={STONE_LIGHT} castShadow receiveShadow />
      <InstanceBatch matrices={balconyRails} material={balconyGlass} />
      <InstanceBatch matrices={balconyPosts} material={MID_METAL} />

      {/* Central vertical fin package */}
      <mesh geometry={BOX} material={DARK_METAL} position={[0, 14.1, 5.25]} scale={[0.58, 19.2, 0.3]} castShadow />
      {[-0.34, 0.34].map((x) => (
        <mesh key={x} geometry={BOX} material={MID_METAL} position={[x, 14.1, 5.42]} scale={[0.055, 18.65, 0.06]} />
      ))}

      {/* Full facade stone surround makes the building broader and more architectural */}
      <InstanceBatch matrices={facadeFrame} material={STONE_LIGHT} castShadow receiveShadow />

      {/* Long roof terrace */}
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 24.15, 0]} scale={[21.3, 0.48, 9.3]} castShadow receiveShadow />
      <mesh geometry={BOX} material={GRASS} position={[0, 24.42, 0.1]} scale={[17.8, 0.09, 6.45]} />
      <InstanceBatch matrices={terracePlants} geometry={PLANT} material={LEAF_LIGHT} />

      {/* Low rooftop penthouse instead of a tall crown */}
      <mesh geometry={BOX} material={STONE_LIGHT} position={[-3.0, 25.45, -0.6]} scale={[8.2, 1.75, 5.2]} castShadow receiveShadow />
      <GlassFacadePlane position={[-3.0, 25.45, 2.03]} size={[7.3, 1.35]} material={lobbyGlass} />
      <mesh geometry={BOX} material={ROOF_METAL} position={[-3.0, 26.42, -0.6]} scale={[9.1, 0.3, 5.8]} castShadow />

      <mesh geometry={BOX} material={STONE_DARK} position={[5.55, 25.35, -2.35]} scale={[1.65, 1.65, 1.55]} castShadow />
      <mesh geometry={BOX} material={MID_METAL} position={[7.0, 25.0, -1.15]} scale={[1.1, 1.05, 1.1]} castShadow />
      <mesh geometry={FAN} material={AC_FAN} position={[7.56, 25.0, -1.15]} rotation={[0, Math.PI / 2, 0]} scale={[0.3, 0.3, 1]} />

      <PlanterRow position={[-8.9, 0.36, 6.15]} width={4.0} count={6} />
      <PlanterRow position={[8.2, 0.36, 6.15]} width={4.7} count={7} />
    </group>
  );
}

/* ========================================================================== */
/* ADDITIONAL DISTINCT BUILDINGS - UNIQUE SILHOUETTES, NOT CLONES             */
/* ========================================================================== */

function PremiumSteppedGlassTower({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isNight = false,
}: PremiumReferenceBuildingProps) {
  const lobbyGlass = isNight ? GLASS_DARK_NIGHT : GLASS_DARK_DAY;

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      <mesh geometry={BOX} material={STONE} position={[0, 0.12, 0]} scale={[20.5, 0.24, 12.8]} receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 2.0, 0]} scale={[18.6, 3.7, 10.4]} castShadow receiveShadow />
      <GlassFacadePlane position={[0, 2.0, 5.25]} size={[15.7, 2.95]} material={lobbyGlass} />
      <RealisticEntrance centerX={-3.2} frontZ={5.32} width={4.4} canopyWidth={6.8} isNight={isNight} rampSide="right" />

      {/* Three offset volumes produce a stepped skyline. */}
      <CurtainWallTower position={[-4.2, 10.1, -0.55]} width={7.4} height={15.1} depth={7.8} floors={5} columns={5} isNight={isNight} tone="blue" stoneSide />
      <CurtainWallTower position={[1.25, 14.0, -0.85]} width={8.0} height={22.9} depth={8.4} floors={8} columns={6} isNight={isNight} tone="dark" />
      <CurtainWallTower position={[4.5, 20.1, -1.15]} width={5.2} height={28.8} depth={7.2} floors={10} columns={4} isNight={isNight} tone="blue" />

      <mesh geometry={BOX} material={STONE_LIGHT} position={[-4.2, 17.75, -0.2]} scale={[8.15, 0.42, 8.35]} castShadow />
      <RoofGarden position={[-4.2, 18.08, -0.1]} width={6.3} depth={5.6} />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[1.25, 25.58, -0.65]} scale={[8.7, 0.44, 8.85]} castShadow />
      <RoofGarden position={[1.25, 25.9, -0.55]} width={6.5} depth={5.8} />
      <mesh geometry={BOX} material={DARK_METAL} position={[4.5, 34.72, -1.1]} scale={[5.85, 0.32, 7.7]} castShadow />
      <mesh geometry={BOX} material={STONE_DARK} position={[4.5, 35.6, -1.45]} scale={[2.4, 1.4, 2.7]} castShadow />
    </group>
  );
}

function PremiumVerticalFinTower({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isNight = false,
}: PremiumReferenceBuildingProps) {
  const entryGlass = isNight ? ENTRY_GLASS_NIGHT : ENTRY_GLASS_DAY;

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      <mesh geometry={BOX} material={STONE} position={[0, 0.12, 0]} scale={[17.8, 0.24, 12.2]} receiveShadow />
      <mesh geometry={BOX} material={STONE_DARK} position={[0, 2.1, -0.25]} scale={[15.8, 4.0, 9.9]} castShadow receiveShadow />
      <GlassFacadePlane position={[0, 2.08, 4.77]} size={[12.9, 3.25]} material={entryGlass} />
      <RealisticEntrance centerX={2.8} frontZ={4.84} width={4.1} canopyWidth={6.2} isNight={isNight} rampSide="left" />

      {/* A narrow dark tower with unequal white fins and a floating crown. */}
      <CurtainWallTower position={[0, 18.2, -0.8]} width={10.1} height={29.0} depth={8.3} floors={11} columns={7} isNight={isNight} tone="dark" />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[-5.35, 17.4, -1.05]} scale={[0.72, 28.4, 8.7]} castShadow receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[5.45, 14.8, -1.05]} scale={[0.9, 23.1, 8.7]} castShadow receiveShadow />
      <mesh geometry={BOX} material={MID_METAL} position={[-3.0, 18.2, 3.55]} scale={[0.22, 28.1, 0.34]} castShadow />
      <mesh geometry={BOX} material={MID_METAL} position={[3.0, 18.2, 3.55]} scale={[0.22, 28.1, 0.34]} castShadow />

      <mesh geometry={BOX} material={STONE_LIGHT} position={[-1.2, 33.3, -0.75]} scale={[13.8, 0.64, 9.2]} castShadow />
      <mesh geometry={BOX} material={ROOF_METAL} position={[1.65, 34.1, -0.8]} scale={[8.3, 1.1, 6.4]} castShadow />
      <mesh geometry={BOX} material={DARK_METAL} position={[0, 35.1, 3.0]} scale={[12.4, 0.3, 0.42]} castShadow />
      <RoofGarden position={[-1.2, 33.72, -0.55]} width={8.0} depth={5.6} />
    </group>
  );
}

function PremiumTerracedOfficeTower({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isNight = false,
}: PremiumReferenceBuildingProps) {
  const balconyGlass = isNight ? BALCONY_GLASS_NIGHT : BALCONY_GLASS_DAY;
  const lobbyGlass = isNight ? GLASS_BLUE_NIGHT : GLASS_BLUE_DAY;

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      <mesh geometry={BOX} material={STONE} position={[0, 0.12, 0]} scale={[23.5, 0.24, 13.2]} receiveShadow />
      <mesh geometry={BOX} material={STONE_LIGHT} position={[0, 2.0, 0]} scale={[21.2, 3.7, 10.7]} castShadow receiveShadow />
      <GlassFacadePlane position={[0, 2.0, 5.42]} size={[18.4, 3.0]} material={lobbyGlass} />
      <RealisticEntrance centerX={0} frontZ={5.5} width={4.8} canopyWidth={7.5} isNight={isNight} rampSide="right" />

      {/* Broad low wing, offset tower and open terraces make this profile unique. */}
      <CurtainWallTower position={[-3.4, 11.4, -0.45]} width={13.4} height={17.6} depth={8.4} floors={6} columns={9} isNight={isNight} tone="blue" />
      <CurtainWallTower position={[6.3, 16.5, -1.0]} width={6.1} height={27.8} depth={7.8} floors={9} columns={5} isNight={isNight} tone="dark" stoneSide />

      {[7.0, 10.0, 13.0, 16.0, 19.0].map((y, index) => (
        <group key={`terrace-${y}`}>
          <mesh geometry={BOX} material={STONE_LIGHT} position={[-5.1 + (index % 2) * 0.7, y, 4.1]} scale={[9.8 - index * 0.55, 0.18, 1.5]} castShadow receiveShadow />
          <mesh geometry={PLANE} material={balconyGlass} position={[-5.1 + (index % 2) * 0.7, y + 0.62, 4.87]} scale={[9.2 - index * 0.55, 0.82, 1]} />
        </group>
      ))}

      <mesh geometry={BOX} material={STONE_LIGHT} position={[-3.4, 20.45, -0.3]} scale={[14.2, 0.46, 8.9]} castShadow />
      <RoofGarden position={[-3.4, 20.78, -0.2]} width={10.6} depth={6.0} />
      <mesh geometry={BOX} material={ROOF_METAL} position={[6.3, 30.7, -1.0]} scale={[6.8, 0.36, 8.35]} castShadow />
      <mesh geometry={BOX} material={STONE_DARK} position={[6.3, 31.6, -1.2]} scale={[2.5, 1.4, 2.8]} castShadow />
      <PlanterRow position={[-8.0, 0.36, 5.95]} width={4.2} count={6} />
      <PlanterRow position={[7.6, 0.36, 5.95]} width={3.8} count={5} />
    </group>
  );
}



/* ========================================================================== */
/* PHOTOREAL URBAN ROAD - ROAD ONLY, NO VEHICLES                              */
/* ========================================================================== */


// Longer road so the visible end naturally becomes much smaller in perspective.
// The curve is pushed far away and made broader/gentler, so there is no abrupt
// cut near the hero composition.
const ROAD_LENGTH = 2400;
const ROAD_CENTER_Z = 22;
const ROAD_MIN_Z = 11.25;
const ROAD_MAX_Z = 32.75;
const ROAD_HALF_WIDTH = (ROAD_MAX_Z - ROAD_MIN_Z) / 2;
const HIGHWAY_MEDIAN_WIDTH = 5.8;
const HIGHWAY_MEDIAN_HALF = HIGHWAY_MEDIAN_WIDTH / 2;
const HIGHWAY_MEDIAN_MIN_Z = ROAD_CENTER_Z - HIGHWAY_MEDIAN_HALF;
const HIGHWAY_MEDIAN_MAX_Z = ROAD_CENTER_Z + HIGHWAY_MEDIAN_HALF;
const ROAD_STRAIGHT_HALF = ROAD_LENGTH / 2;
const ROAD_CURVE_RADIUS = 110;
const ROAD_CURVE_INNER_RADIUS = ROAD_CURVE_RADIUS - ROAD_HALF_WIDTH;
const ROAD_CURVE_OUTER_RADIUS = ROAD_CURVE_RADIUS + ROAD_HALF_WIDTH;
const ROAD_CURVE_CENTER_Z = ROAD_CENTER_Z + ROAD_CURVE_RADIUS;
const ROAD_SAFE_END_MARGIN = 10;
const ROAD_GROUND_LENGTH = ROAD_LENGTH + ROAD_CURVE_RADIUS * 2 + 1200;

// Scene/composition tuning: move the complete road + building composition
// farther LEFT and BACK so the empty rear ground reduces and the hero elements
// sit in a cleaner perspective frame.
const SHOWCASE_SCENE_OFFSET: Vec3 = [-28, 0, -12];
// Everything beside the transport corridor uses THIS SAME frame. Rotating
// just the road used to carry it underneath the distant unrotated buildings.
const ROAD_LAYOUT_YAW = -0.085;
const SHOWCASE_TARGET: Vec3 = [-12, 9, 15];

// Move only the buildings farther away from the road.
// More negative Z = more setback from the road.
const BUILDING_SET_OFFSET: Vec3 = [0, 0, -8.5];

// Setback for the mirrored building row on the opposite side of the road.
const BUILDING_SET_OFFSET_NORTH: Vec3 = [0, 0, 50];

const ROAD_POLE_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 14);
const ROAD_MANHOLE = new THREE.CircleGeometry(1, 28);

function ArcStrip({
  center,
  innerRadius,
  outerRadius,
  thetaStart,
  thetaLength,
  y,
  material,
  castShadow = false,
  receiveShadow = true,
}: {
  center: Vec3;
  innerRadius: number;
  outerRadius: number;
  thetaStart: number;
  thetaLength: number;
  y: number;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[center[0], y, center[2]]}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <ringGeometry args={[innerRadius, outerRadius, 128, 1, thetaStart, thetaLength]} />
    </mesh>
  );
}

function createPhotorealAsphaltMaps(seed: number) {
  const width = 1024;
  const height = 512;
  const random = seeded(seed);
  const color = new Uint8Array(width * height * 4);
  const bump = new Uint8Array(width * height * 4);
  const roughness = new Uint8Array(width * height * 4);

  const patches = Array.from({ length: 22 }, () => ({
    x: random(),
    y: random(),
    sx: 0.045 + random() * 0.08,
    sy: 0.02 + random() * 0.05,
    strength: 4 + random() * 10,
  }));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const u = x / width;
      const v = y / height;

      const fine = (random() - 0.5) * 11;
      const aggregate =
        Math.sin(x * 0.21) * 2.0 +
        Math.cos(y * 0.27) * 1.7 +
        Math.sin(x * 1.72 + y * 1.13) * 1.15;

      const longWear =
        Math.exp(-Math.pow((v - 0.18) / 0.055, 2)) * -5.0 +
        Math.exp(-Math.pow((v - 0.33) / 0.055, 2)) * -4.0 +
        Math.exp(-Math.pow((v - 0.68) / 0.055, 2)) * -4.2 +
        Math.exp(-Math.pow((v - 0.83) / 0.055, 2)) * -5.2;

      let patchTone = 0;
      for (const patch of patches) {
        const dx = (u - patch.x) / patch.sx;
        const dy = (v - patch.y) / patch.sy;
        const d = dx * dx + dy * dy;
        if (d < 1) {
          patchTone -= (1 - d) * patch.strength;
        }
      }

      const fadedBand = Math.sin(u * Math.PI * 7.5 + seed * 0.01) * 0.8;
      const base = 67 + fine + aggregate + longWear + patchTone + fadedBand;
      const value = THREE.MathUtils.clamp(base, 34, 104);

      color[i] = value;
      color[i + 1] = THREE.MathUtils.clamp(value + 1, 0, 255);
      color[i + 2] = THREE.MathUtils.clamp(value + 2, 0, 255);
      color[i + 3] = 255;

      const bumpValue = THREE.MathUtils.clamp(
        145 + fine * 1.4 + aggregate * 2.1 + patchTone * 0.7,
        82,
        205,
      );
      bump[i] = bumpValue;
      bump[i + 1] = bumpValue;
      bump[i + 2] = bumpValue;
      bump[i + 3] = 255;

      const roughValue = THREE.MathUtils.clamp(
        214 + fine * 0.55 - patchTone * 0.8 + longWear * 0.5,
        175,
        246,
      );
      roughness[i] = roughValue;
      roughness[i + 1] = roughValue;
      roughness[i + 2] = roughValue;
      roughness[i + 3] = 255;
    }
  }

  return {
    color: makeTexture(width, height, color, [4.2, 1.0], true),
    bump: makeTexture(width, height, bump, [4.2, 1.0], false),
    roughness: makeTexture(width, height, roughness, [4.2, 1.0], false),
  };
}

function createRoadConcreteMaps(seed: number) {
  const size = 512;
  const random = seeded(seed);
  const color = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);

  const slabW = 128;
  const slabH = 92;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const px = x % slabW;
      const py = y % slabH;
      const joint = px < 2 || py < 2;
      const edge = px < 5 || py < 5;
      const grain = (random() - 0.5) * 9;
      const stain = Math.sin(x * 0.018 + y * 0.027 + seed) * 2.2;
      const slabShift = ((Math.floor(x / slabW) * 5 + Math.floor(y / slabH) * 3 + seed) % 7) - 3;
      const base = joint ? 96 : 161 + slabShift + grain + stain - (edge ? 3 : 0);
      const value = THREE.MathUtils.clamp(base, 88, 182);

      color[i] = value;
      color[i + 1] = THREE.MathUtils.clamp(value - 1, 0, 255);
      color[i + 2] = THREE.MathUtils.clamp(value - 3, 0, 255);
      color[i + 3] = 255;

      const bv = joint ? 54 : THREE.MathUtils.clamp(166 + grain * 1.3, 128, 194);
      bump[i] = bv;
      bump[i + 1] = bv;
      bump[i + 2] = bv;
      bump[i + 3] = 255;

      const rv = joint ? 240 : THREE.MathUtils.clamp(217 + grain * 0.7, 194, 238);
      roughness[i] = rv;
      roughness[i + 1] = rv;
      roughness[i + 2] = rv;
      roughness[i + 3] = 255;
    }
  }

  return {
    color: makeTexture(size, size, color, [7.2, 1.5], true),
    bump: makeTexture(size, size, bump, [7.2, 1.5], false),
    roughness: makeTexture(size, size, roughness, [7.2, 1.5], false),
  };
}

function createRoadPaintMaps(seed: number) {
  const size = 128;
  const random = seeded(seed);
  const color = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const wear = (random() - 0.5) * 18 + Math.sin(x * 0.31 + y * 0.18) * 4;
      const value = THREE.MathUtils.clamp(226 + wear, 185, 245);
      color[i] = value;
      color[i + 1] = THREE.MathUtils.clamp(value - 2, 0, 255);
      color[i + 2] = THREE.MathUtils.clamp(value - 8, 0, 255);
      color[i + 3] = 255;

      const r = THREE.MathUtils.clamp(224 + wear * 0.35, 205, 242);
      roughness[i] = r;
      roughness[i + 1] = r;
      roughness[i + 2] = r;
      roughness[i + 3] = 255;
    }
  }

  return {
    color: makeTexture(size, size, color, [4, 1], true),
    roughness: makeTexture(size, size, roughness, [4, 1], false),
  };
}

const PHOTO_ASPHALT_MAPS = createPhotorealAsphaltMaps(7281);
const ROAD_CONCRETE_MAPS = createRoadConcreteMaps(7319);
const ROAD_PAINT_MAPS = createRoadPaintMaps(7391);

const PHOTO_ASPHALT = new THREE.MeshStandardMaterial({
  color: "#a4aaad",
  map: PHOTO_ASPHALT_MAPS.color,
  bumpMap: PHOTO_ASPHALT_MAPS.bump,
  bumpScale: 0.018,
  roughnessMap: PHOTO_ASPHALT_MAPS.roughness,
  roughness: 0.84,
  metalness: 0,
  envMapIntensity: 0.52,
});

const ROAD_PATCH = new THREE.MeshStandardMaterial({
  color: "#34383a",
  roughness: 0.84,
  metalness: 0,
  envMapIntensity: 0.25,
});

const ROAD_TIRE_WEAR = new THREE.MeshStandardMaterial({
  color: "#2f3335",
  roughness: 0.78,
  metalness: 0,
  envMapIntensity: 0.22,
});

const ROAD_CONCRETE = new THREE.MeshStandardMaterial({
  color: "#d4d1c9",
  map: ROAD_CONCRETE_MAPS.color,
  bumpMap: ROAD_CONCRETE_MAPS.bump,
  bumpScale: 0.012,
  roughnessMap: ROAD_CONCRETE_MAPS.roughness,
  roughness: 0.93,
  metalness: 0,
  envMapIntensity: 0.45,
});

const ROAD_CURB = new THREE.MeshStandardMaterial({
  color: "#9f9e98",
  map: ROAD_CONCRETE_MAPS.color,
  bumpMap: ROAD_CONCRETE_MAPS.bump,
  bumpScale: 0.01,
  roughness: 0.9,
  metalness: 0,
});

const ROAD_PAINT = new THREE.MeshStandardMaterial({
  color: "#f1eee4",
  map: ROAD_PAINT_MAPS.color,
  roughnessMap: ROAD_PAINT_MAPS.roughness,
  roughness: 0.82,
  metalness: 0,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});

const ROAD_DRAIN = new THREE.MeshStandardMaterial({
  color: "#31373a",
  roughness: 0.48,
  metalness: 0.58,
  envMapIntensity: 0.82,
});

const ROAD_MANHOLE_MAT = new THREE.MeshStandardMaterial({
  color: "#383d40",
  roughness: 0.56,
  metalness: 0.48,
  envMapIntensity: 0.7,
});

const ROAD_TACTILE = new THREE.MeshStandardMaterial({
  color: "#a58f60",
  roughness: 0.92,
  metalness: 0,
});

const ROAD_LIGHT_METAL = new THREE.MeshStandardMaterial({
  color: "#5f676a",
  roughness: 0.3,
  metalness: 0.68,
  envMapIntensity: 1.15,
});

const ROAD_LIGHT_HEAD_DAY = new THREE.MeshPhysicalMaterial({
  color: "#d7dde0",
  roughness: 0.2,
  metalness: 0.02,
  clearcoat: 0.7,
  clearcoatRoughness: 0.12,
  envMapIntensity: 1.1,
});

const ROAD_LIGHT_HEAD_NIGHT = new THREE.MeshStandardMaterial({
  color: "#fff9ee",
  emissive: new THREE.Color("#ffe8bd"),
  emissiveIntensity: 2.8,
  roughness: 0.2,
  metalness: 0.03,
  toneMapped: false,
});

const MEDIAN_SOIL = new THREE.MeshStandardMaterial({
  color: "#5d5f53",
  roughness: 0.98,
  metalness: 0,
});

const MEDIAN_GREEN = new THREE.MeshStandardMaterial({
  color: "#526b43",
  roughness: 0.96,
  metalness: 0,
});

const UNIPOLE_STEEL = new THREE.MeshStandardMaterial({
  color: "#6f767a",
  roughness: 0.38,
  metalness: 0.72,
  envMapIntensity: 1.1,
});

const UNIPOLE_PANEL_FRONT = new THREE.MeshStandardMaterial({
  color: "#f4f4f1",
  roughness: 0.82,
  metalness: 0.02,
});

const UNIPOLE_PANEL_BACK = new THREE.MeshStandardMaterial({
  color: "#53575a",
  roughness: 0.68,
  metalness: 0.24,
});

// Unipole position along the road.
// More negative = closer/forward toward the initial camera.
// More positive = farther/backward along the road.
// Move the existing structure 54 road-local units farther down the median.
// Change only this value to fine-tune its distance; positive moves away.
const UNIPOLE_FORWARD_X = -6;

/* ========================================================================== */
/* LIVE ROAD TRAFFIC - SHARED GEOMETRY / MATERIALS                            */
/* ========================================================================== */

// Proper road-vehicle wheel set. Torus tyres read as tyres instead of
// flat cylinders, while a separate metallic rim + hub give believable depth.
// All three are shared by every vehicle and rendered as instanced meshes.
const TRAFFIC_TIRE_GEOMETRY = new THREE.TorusGeometry(0.72, 0.28, 10, 20);
const TRAFFIC_RIM_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 18);
TRAFFIC_RIM_GEOMETRY.rotateX(Math.PI / 2);
const TRAFFIC_HUB_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 14);
TRAFFIC_HUB_GEOMETRY.rotateX(Math.PI / 2);

// A shared tapered cabin makes cars read as real vehicles instead of stacked
// boxes. The positive-X top-front corners are pulled rearward to create a
// windshield rake; negative-direction vehicles simply rotate the same geometry.
const TRAFFIC_CABIN_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
{
  const position = TRAFFIC_CABIN_GEOMETRY.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    if (x > 0.45 && y > 0.45) position.setX(i, 0.27);
  }
  position.needsUpdate = true;
  TRAFFIC_CABIN_GEOMETRY.computeVertexNormals();
}

// Shared chamfered lower body. This keeps the instanced traffic lightweight
// while removing the perfectly rectangular toy-car silhouette.
const TRAFFIC_LOWER_BODY_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
{
  const position = TRAFFIC_LOWER_BODY_GEOMETRY.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (y > 0.45) {
      position.setX(i, x * 0.93);
      position.setZ(i, z * 0.96);
    }
    if (Math.abs(x) > 0.45 && y < -0.45) {
      position.setX(i, Math.sign(x) * 0.47);
    }
  }
  position.needsUpdate = true;
  TRAFFIC_LOWER_BODY_GEOMETRY.computeVertexNormals();
}

function createTrafficTireBumpMap() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const longitudinalGroove = x % 16 < 2 || x % 16 > 13;
      const treadBlock = ((x + Math.floor(y / 5) * 4) % 12) < 6;
      const value = longitudinalGroove ? 62 : treadBlock ? 176 : 130;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  return makeTexture(size, size, data, [5, 2], false);
}

const TRAFFIC_TIRE_BUMP = createTrafficTireBumpMap();

const TRAFFIC_BODY_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.42,
  metalness: 0.22,
  envMapIntensity: 0.72,
});
const TRAFFIC_GLASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#263f4d",
  roughness: 0.2,
  metalness: 0.24,
  envMapIntensity: 0.9,
});
const TRAFFIC_TIRE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#111315",
  roughness: 0.9,
  metalness: 0.02,
  bumpMap: TRAFFIC_TIRE_BUMP,
  bumpScale: 0.045,
});
const TRAFFIC_RIM_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#a8afb4",
  roughness: 0.28,
  metalness: 0.8,
  envMapIntensity: 1.1,
});
const TRAFFIC_HUB_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#596166",
  roughness: 0.34,
  metalness: 0.72,
  envMapIntensity: 0.9,
});
const TRAFFIC_CARGO_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#b8b9b5",
  roughness: 0.7,
  metalness: 0.08,
});
const TRAFFIC_HEADLIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#f7f2d7",
  emissive: new THREE.Color("#fff0b8"),
  emissiveIntensity: 0.32,
  roughness: 0.3,
});
const TRAFFIC_HEADLIGHT_NIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#fffdf4",
  emissive: new THREE.Color("#fff3c7"),
  emissiveIntensity: 3.2,
  roughness: 0.2,
  toneMapped: false,
});
const TRAFFIC_TAILLIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#a32020",
  emissive: new THREE.Color("#7d1010"),
  emissiveIntensity: 0.32,
  roughness: 0.4,
});
const TRAFFIC_TAILLIGHT_NIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ff3e35",
  emissive: new THREE.Color("#ff1f18"),
  emissiveIntensity: 2.2,
  roughness: 0.3,
  toneMapped: false,
});
const TRAFFIC_TRIM_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#20262a",
  roughness: 0.42,
  metalness: 0.46,
  envMapIntensity: 0.72,
});
const TRAFFIC_BUMPER_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#555d62",
  roughness: 0.34,
  metalness: 0.66,
  envMapIntensity: 0.88,
});
const TRAFFIC_GRILLE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#171c20",
  roughness: 0.38,
  metalness: 0.7,
  envMapIntensity: 0.72,
});
const TRAFFIC_PLATE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#f0eee2",
  roughness: 0.48,
  metalness: 0.06,
});


/* ========================================================================== */
/* 3D LED ROADSHOW TRUCK - SHARED MATERIALS                                   */
/* ========================================================================== */

// Lightweight procedural LED wall texture. It reads as a genuine LED matrix
// up close, but costs far less than decoding a second video for moving traffic.
function createRoadshowLedTexture() {
  const width = 256;
  const height = 128;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const u = x / (width - 1);
      const v = y / (height - 1);
      const cellX = x % 8;
      const cellY = y % 8;
      const led = cellX >= 2 && cellX <= 5 && cellY >= 2 && cellY <= 5;

      const cyan = Math.max(0, Math.sin((u * 2.4 + v * 0.45) * Math.PI));
      const violet = Math.max(0, Math.sin((u * 1.4 - v * 1.2 + 0.25) * Math.PI));
      const red = Math.max(0, Math.sin((u * 0.8 + v * 1.9 + 0.4) * Math.PI));
      const dim = led ? 1 : 0.055;

      data[i] = Math.round((24 + 150 * violet + 58 * red) * dim);
      data[i + 1] = Math.round((32 + 130 * cyan + 42 * violet) * dim);
      data[i + 2] = Math.round((42 + 178 * cyan + 120 * violet) * dim);
      data[i + 3] = 255;
    }
  }

  const texture = makeTexture(width, height, data, [1, 1], true);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const ROADSHOW_LED_TEXTURE = createRoadshowLedTexture();

const ROADSHOW_BODY_MATERIAL = new THREE.MeshStandardMaterial({
  // Slightly lifted black so the body keeps readable real-world reflections
  // in daylight instead of collapsing into a flat black silhouette.
  color: "#15191c",
  roughness: 0.24,
  metalness: 0.38,
  envMapIntensity: 1.28,
});
const ROADSHOW_TRIM_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#252a2e",
  roughness: 0.3,
  metalness: 0.68,
  envMapIntensity: 1.08,
});
const ROADSHOW_GLASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#1b3440",
  roughness: 0.08,
  metalness: 0.08,
  envMapIntensity: 1.5,
});
const ROADSHOW_PAINT_HIGHLIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#30363a",
  roughness: 0.2,
  metalness: 0.44,
  envMapIntensity: 1.38,
});
const ROADSHOW_CHROME_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#bfc7cb",
  roughness: 0.16,
  metalness: 0.9,
  envMapIntensity: 1.65,
});
const ROADSHOW_RUBBER_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#111315",
  roughness: 0.86,
  metalness: 0.02,
});
const ROADSHOW_LAMP_GLASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#f3f7f7",
  emissive: new THREE.Color("#e9f6ff"),
  emissiveIntensity: 0.28,
  roughness: 0.12,
  metalness: 0.08,
  envMapIntensity: 1.25,
});
const ROADSHOW_SCREEN_FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#07090a",
  roughness: 0.38,
  metalness: 0.58,
});
const ROADSHOW_LED_SCREEN_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: ROADSHOW_LED_TEXTURE,
  emissiveMap: ROADSHOW_LED_TEXTURE,
  emissive: new THREE.Color("#8bbcff"),
  emissiveIntensity: ROADSHOW_LED_SCREEN_BRIGHTNESS,
  roughness: 0.28,
  metalness: 0.03,
  envMapIntensity: 0.5,
});
ROADSHOW_LED_SCREEN_MATERIAL.toneMapped = false;

const ROADSHOW_GRILLE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#1a1e21",
  roughness: 0.48,
  metalness: 0.72,
});
const ROADSHOW_INDICATOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ff9a26",
  emissive: new THREE.Color("#d95b06"),
  emissiveIntensity: 0.72,
  roughness: 0.28,
});
const ROADSHOW_SIDE_MARKER_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#f7e8c5",
  emissive: new THREE.Color("#ffd48a"),
  emissiveIntensity: 0.52,
  roughness: 0.32,
});
const ROADSHOW_LAMP_GLASS_NIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  emissive: new THREE.Color("#eaf7ff"),
  emissiveIntensity: 3.6,
  roughness: 0.1,
  metalness: 0.04,
  toneMapped: false,
});
const ROADSHOW_INDICATOR_NIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ffac34",
  emissive: new THREE.Color("#ff7a00"),
  emissiveIntensity: 2.1,
  roughness: 0.24,
  toneMapped: false,
});
const ROADSHOW_SIDE_MARKER_NIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#fff4d6",
  emissive: new THREE.Color("#ffd18a"),
  emissiveIntensity: 1.8,
  roughness: 0.26,
  toneMapped: false,
});

/* ========================================================================== */
/* METRO VIADUCT + TRAIN - SHARED CURVE                                       */
/* ========================================================================== */

// Single shared path source for bridge, rails, catenary and train.
// Keep the metro on the LEFT roadside corridor, not on the highway median,
// so the unipole can stay correctly centred on the median without collision.
const METRO_CORRIDOR_Z = 7.0;
const METRO_RAIL_TOP_Y = 10.9;
const METRO_DECK_THICKNESS = 1.15;
const METRO_DECK_TOP_Y = METRO_RAIL_TOP_Y - 0.28;
const METRO_DECK_BOTTOM_Y = METRO_DECK_TOP_Y - METRO_DECK_THICKNESS;
const METRO_DECK_WIDTH = 5.4;
const METRO_RAIL_GAUGE_HALF = 0.72;
const METRO_SEGMENT_COUNT = 108;
const METRO_PIER_COUNT = 23;
const METRO_SLEEPER_SPACING = 1.25;
const METRO_CATENARY_Y = METRO_RAIL_TOP_Y + 4.65;
const METRO_MAST_SPACING = 23;

// Extend beyond both visible road ends so the bridge/train never visibly
// terminate or teleport in the camera frame.
const METRO_CURVE = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-1460, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 2.15),
    new THREE.Vector3(-1280, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.85),
    new THREE.Vector3(-1120, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.65),
    new THREE.Vector3(-980, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 2.0),
    new THREE.Vector3(-860, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.6),
    new THREE.Vector3(-740, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.4),
    new THREE.Vector3(-650, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.8),
    new THREE.Vector3(-560, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.1),
    new THREE.Vector3(-470, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.5),
    new THREE.Vector3(-390, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 0.8),
    new THREE.Vector3(-300, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z - 0.4),
    new THREE.Vector3(-210, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 0.7),
    new THREE.Vector3(-120, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.2),
    new THREE.Vector3(-30, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z - 0.6),
    new THREE.Vector3(60, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 0.35),
    new THREE.Vector3(150, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 0.95),
    new THREE.Vector3(240, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z - 0.35),
    new THREE.Vector3(330, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 0.45),
    new THREE.Vector3(420, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 0.95),
    new THREE.Vector3(510, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.25),
    new THREE.Vector3(600, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.45),
    new THREE.Vector3(690, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.7),
    new THREE.Vector3(790, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.85),
    new THREE.Vector3(900, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 1.95),
    new THREE.Vector3(1020, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 2.05),
    new THREE.Vector3(1180, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 2.1),
    new THREE.Vector3(1340, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 2.18),
    new THREE.Vector3(1500, METRO_RAIL_TOP_Y, METRO_CORRIDOR_Z + 2.22),
  ],
  false,
  "catmullrom",
  0.22,
);

// Resolve this long curve densely ONCE. The default 200-sample arc-length
// table produced noticeable speed changes at segment boundaries.
METRO_CURVE.arcLengthDivisions = 4096;
METRO_CURVE.updateArcLengths();

const METRO_CONTACT_WIRE_CURVE = new THREE.CatmullRomCurve3(
  METRO_CURVE.getPoints(128).map((p) => new THREE.Vector3(p.x, METRO_CATENARY_Y, p.z)),
  false,
  "catmullrom",
  0.2,
);
const METRO_MESSENGER_WIRE_CURVE = new THREE.CatmullRomCurve3(
  METRO_CURVE.getPoints(128).map((p) => new THREE.Vector3(p.x, METRO_CATENARY_Y + 0.58, p.z)),
  false,
  "catmullrom",
  0.2,
);
const METRO_CONTACT_WIRE_GEOMETRY = new THREE.TubeGeometry(METRO_CONTACT_WIRE_CURVE, 220, 0.025, 5, false);
const METRO_MESSENGER_WIRE_GEOMETRY = new THREE.TubeGeometry(METRO_MESSENGER_WIRE_CURVE, 220, 0.018, 5, false);

// Returns the midpoint/orientation/length of one curve slice, in the same
// convention used by `matrix()`: rotation.y = angle aligns local +X with the
// travel direction, so local +Z is automatically the "across track" axis.
function metroFrame(t0: number, t1: number) {
  const p0 = METRO_CURVE.getPointAt(t0);
  const p1 = METRO_CURVE.getPointAt(t1);
  const mid = p0.clone().lerp(p1, 0.5);
  const dx = p1.x - p0.x;
  const dz = p1.z - p0.z;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(-dz, dx);
  return { mid, angle, length };
}

const TRAIN_MODEL_PATH = "/models/metro_train_low.glb";
// Existing GLB is modelled in real-world units with its pivot at the body
// centre (bottom of wheels sits 1.43 below origin); this offsets it so the
// group's own origin sits at the wheel/rail contact line.
const TRAIN_SCALE = 1;
// Existing GLB's long axis is local X. Flip to Math.PI only if the imported
// asset itself is authored backwards.
const TRAIN_YAW_OFFSET = 0;
// Speed and the offscreen waiting time are set in USER ADJUSTMENTS at the top.
// Movement remains constant-distance and always far bridge end -> near end.
const TRAIN_START_U = 0.91;
const TRAIN_END_U = 0.07;
const TRAIN_RAIL_CONTACT_OFFSET = -0.015;
const TRAIN_PATH_SAMPLES = 4096;

type TrainPathTable = { points: Float32Array; length: number };

function createTrainPathTable(): TrainPathTable {
  const points = new Float32Array((TRAIN_PATH_SAMPLES + 1) * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i <= TRAIN_PATH_SAMPLES; i += 1) {
    METRO_CURVE.getPointAt(i / TRAIN_PATH_SAMPLES, p);
    points[i * 3] = p.x;
    points[i * 3 + 1] = p.y;
    points[i * 3 + 2] = p.z;
  }
  return { points, length: METRO_CURVE.getLength() };
}

function sampleTrainPath(table: TrainPathTable, u: number, out: THREE.Vector3) {
  const scaled = THREE.MathUtils.clamp(u, 0, 1) * TRAIN_PATH_SAMPLES;
  const index = Math.min(TRAIN_PATH_SAMPLES - 1, Math.floor(scaled));
  const mix = scaled - index;
  const a = index * 3;
  const b = a + 3;
  out.set(
    THREE.MathUtils.lerp(table.points[a], table.points[b], mix),
    THREE.MathUtils.lerp(table.points[a + 1], table.points[b + 1], mix),
    THREE.MathUtils.lerp(table.points[a + 2], table.points[b + 2], mix),
  );
}

const STREETLIGHT_POLE_GEOMETRY = new THREE.CylinderGeometry(0.05, 0.105, 1, 12);
const STREETLIGHT_ARM_GEOMETRY = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.32, 0.06),
    new THREE.Vector3(0, 0.56, 0.55),
    new THREE.Vector3(0, 0.63, 1.45),
    new THREE.Vector3(0, 0.56, 2.25),
    new THREE.Vector3(0, 0.47, 2.72),
  ]),
  14,
  0.048,
  7,
  false,
);
const UNIPOLE_MAST_GEOMETRY = new THREE.CylinderGeometry(0.72, 1, 1, 20);
const METRO_CATENARY_POLE_GEOMETRY = new THREE.CylinderGeometry(0.055, 0.08, 1, 10);
const METRO_WIRE_MATERIAL = new THREE.MeshStandardMaterial({ color: "#3f4548", metalness: 0.82, roughness: 0.3 });

function AsphaltSurface() {
  const repairPatches = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const random = seeded(7711);
    const usableLength = ROAD_LENGTH - 2 * ROAD_SAFE_END_MARGIN;

    for (let i = 0; i < 18; i += 1) {
      const t = (i + 0.5) / 18;
      const x =
        -ROAD_STRAIGHT_HALF +
        ROAD_SAFE_END_MARGIN +
        usableLength * t +
        (random() - 0.5) * 8;
      const z = ROAD_MIN_Z + 1.2 + random() * (ROAD_MAX_Z - ROAD_MIN_Z - 2.4);
      const length = 5.5 + random() * 11;
      const width = 0.55 + random() * 0.9;

      out.push(
        matrix([x, 0.037, z], [0, 0, 0], [length, 0.01, width]),
      );
    }

    return out;
  }, []);

  const wheelWear = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const laneCenters = [12.6, 15.2, 17.8, 26.2, 28.8, 31.4];
    const segmentCount = 5;
    const gap = 7;
    const segmentLength = (ROAD_LENGTH - gap * (segmentCount - 1)) / segmentCount;
    const firstCenter =
      -ROAD_STRAIGHT_HALF + segmentLength / 2;

    for (const z of laneCenters) {
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const x = firstCenter + segment * (segmentLength + gap);
        out.push(
          matrix([x, 0.039, z - 0.48], [0, 0, 0], [segmentLength, 0.008, 0.18]),
          matrix([x, 0.039, z + 0.48], [0, 0, 0], [segmentLength, 0.008, 0.18]),
        );
      }
    }

    return out;
  }, []);

  return (
    <group dispose={null}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, ROAD_CENTER_Z]}
        receiveShadow
      >
        <planeGeometry args={[ROAD_LENGTH, ROAD_MAX_Z - ROAD_MIN_Z]} />
        <primitive object={PHOTO_ASPHALT} attach="material" />
      </mesh>

      <ArcStrip
        center={[-ROAD_STRAIGHT_HALF, 0.025, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_INNER_RADIUS}
        outerRadius={ROAD_CURVE_OUTER_RADIUS}
        thetaStart={Math.PI}
        thetaLength={Math.PI / 2}
        y={0.025}
        material={PHOTO_ASPHALT}
      />

      <ArcStrip
        center={[ROAD_STRAIGHT_HALF, 0.025, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_INNER_RADIUS}
        outerRadius={ROAD_CURVE_OUTER_RADIUS}
        thetaStart={Math.PI * 1.5}
        thetaLength={Math.PI / 2}
        y={0.025}
        material={PHOTO_ASPHALT}
      />

      <InstanceBatch matrices={repairPatches} material={ROAD_PATCH} />
      <InstanceBatch matrices={wheelWear} material={ROAD_TIRE_WEAR} />
    </group>
  );
}

function RealRoadLaneMarkings() {
  const dashes = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const separators = [13.9, 16.5, 27.5, 30.1];

    for (const z of separators) {
      for (
        let x = -ROAD_STRAIGHT_HALF + ROAD_SAFE_END_MARGIN;
        x <= ROAD_STRAIGHT_HALF - ROAD_SAFE_END_MARGIN;
        x += 10.5
      ) {
        out.push(matrix([x, 0.055, z], [0, 0, 0], [4.1, 0.012, 0.095]));
      }
    }
    return out;
  }, []);

  const solid = useMemo(
    () => [
      matrix([0, 0.054, 11.65], [0, 0, 0], [ROAD_LENGTH, 0.012, 0.085]),
      matrix([0, 0.054, HIGHWAY_MEDIAN_MIN_Z - 0.1], [0, 0, 0], [ROAD_LENGTH, 0.012, 0.085]),
      matrix([0, 0.054, HIGHWAY_MEDIAN_MAX_Z + 0.1], [0, 0, 0], [ROAD_LENGTH, 0.012, 0.085]),
      matrix([0, 0.054, 32.35], [0, 0, 0], [ROAD_LENGTH, 0.012, 0.085]),
    ],
    [],
  );

  const arcDashSegments = useMemo(() => {
    const out: ReactElement[] = [];
    const radii = [ROAD_CURVE_RADIUS - 8.1, ROAD_CURVE_RADIUS - 5.5, ROAD_CURVE_RADIUS + 5.5, ROAD_CURVE_RADIUS + 8.1];
    const starts = [Math.PI, Math.PI * 1.5];

    starts.forEach((thetaBase, sideIndex) => {
      const centerX = sideIndex === 0 ? -ROAD_STRAIGHT_HALF : ROAD_STRAIGHT_HALF;
      radii.forEach((r, ridx) => {
        let theta = 0.04;
        while (theta < Math.PI / 2 - 0.03) {
          const dashAngle = 4.1 / r;
          out.push(
            <ArcStrip
              key={`arc-dash-${sideIndex}-${ridx}-${theta.toFixed(3)}`}
              center={[centerX, 0.055, ROAD_CURVE_CENTER_Z]}
              innerRadius={r - 0.047}
              outerRadius={r + 0.047}
              thetaStart={thetaBase + theta}
              thetaLength={dashAngle}
              y={0.055}
              material={ROAD_PAINT}
            />,
          );
          theta += dashAngle + 0.16;
        }
      });
    });
    return out;
  }, []);

  return (
    <group>
      <InstanceBatch matrices={dashes} material={ROAD_PAINT} />
      <InstanceBatch matrices={solid} material={ROAD_PAINT} />

      <ArcStrip
        center={[-ROAD_STRAIGHT_HALF, 0.054, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_OUTER_RADIUS - 0.085}
        outerRadius={ROAD_CURVE_OUTER_RADIUS}
        thetaStart={Math.PI}
        thetaLength={Math.PI / 2}
        y={0.054}
        material={ROAD_PAINT}
      />
      <ArcStrip
        center={[-ROAD_STRAIGHT_HALF, 0.054, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF - 0.085}
        outerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF}
        thetaStart={Math.PI}
        thetaLength={Math.PI / 2}
        y={0.054}
        material={ROAD_PAINT}
      />
      <ArcStrip
        center={[-ROAD_STRAIGHT_HALF, 0.054, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF}
        outerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF + 0.085}
        thetaStart={Math.PI}
        thetaLength={Math.PI / 2}
        y={0.054}
        material={ROAD_PAINT}
      />
      <ArcStrip
        center={[-ROAD_STRAIGHT_HALF, 0.054, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_INNER_RADIUS}
        outerRadius={ROAD_CURVE_INNER_RADIUS + 0.085}
        thetaStart={Math.PI}
        thetaLength={Math.PI / 2}
        y={0.054}
        material={ROAD_PAINT}
      />

      <ArcStrip
        center={[ROAD_STRAIGHT_HALF, 0.054, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_OUTER_RADIUS - 0.085}
        outerRadius={ROAD_CURVE_OUTER_RADIUS}
        thetaStart={Math.PI * 1.5}
        thetaLength={Math.PI / 2}
        y={0.054}
        material={ROAD_PAINT}
      />
      <ArcStrip
        center={[ROAD_STRAIGHT_HALF, 0.054, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF - 0.085}
        outerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF}
        thetaStart={Math.PI * 1.5}
        thetaLength={Math.PI / 2}
        y={0.054}
        material={ROAD_PAINT}
      />
      <ArcStrip
        center={[ROAD_STRAIGHT_HALF, 0.054, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF}
        outerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF + 0.085}
        thetaStart={Math.PI * 1.5}
        thetaLength={Math.PI / 2}
        y={0.054}
        material={ROAD_PAINT}
      />
      <ArcStrip
        center={[ROAD_STRAIGHT_HALF, 0.054, ROAD_CURVE_CENTER_Z]}
        innerRadius={ROAD_CURVE_INNER_RADIUS}
        outerRadius={ROAD_CURVE_INNER_RADIUS + 0.085}
        thetaStart={Math.PI * 1.5}
        thetaLength={Math.PI / 2}
        y={0.054}
        material={ROAD_PAINT}
      />

      {arcDashSegments}
    </group>
  );
}

function RoadEdgeAndDrainage() {
  const drainGrates = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (
      let x = -ROAD_STRAIGHT_HALF + ROAD_SAFE_END_MARGIN;
      x <= ROAD_STRAIGHT_HALF - ROAD_SAFE_END_MARGIN;
      x += 11.5
    ) {
      out.push(
        matrix([x, 0.105, 11.22], [0, 0, 0], [1.35, 0.035, 0.22]),
        matrix([x + 4.7, 0.105, 32.78], [0, 0, 0], [1.35, 0.035, 0.22]),
      );
    }
    return out;
  }, []);

  return (
    <group>
      {/* straight gutters */}
      <mesh geometry={BOX} material={ROAD_PATCH} position={[0, 0.045, 11.08]} scale={[ROAD_LENGTH, 0.04, 0.42]} receiveShadow />
      <mesh geometry={BOX} material={ROAD_PATCH} position={[0, 0.045, 32.92]} scale={[ROAD_LENGTH, 0.04, 0.42]} receiveShadow />

      {/* curved gutters */}
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.045, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_OUTER_RADIUS + 0.02} outerRadius={ROAD_CURVE_OUTER_RADIUS + 0.44} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.045} material={ROAD_PATCH} />
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.045, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_INNER_RADIUS - 0.44} outerRadius={ROAD_CURVE_INNER_RADIUS - 0.02} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.045} material={ROAD_PATCH} />
      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.045, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_OUTER_RADIUS + 0.02} outerRadius={ROAD_CURVE_OUTER_RADIUS + 0.44} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.045} material={ROAD_PATCH} />
      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.045, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_INNER_RADIUS - 0.44} outerRadius={ROAD_CURVE_INNER_RADIUS - 0.02} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.045} material={ROAD_PATCH} />

      {/* curbs */}
      <mesh geometry={BOX} material={ROAD_CURB} position={[0, 0.18, 10.78]} scale={[ROAD_LENGTH, 0.3, 0.34]} castShadow receiveShadow />
      <mesh geometry={BOX} material={ROAD_CURB} position={[0, 0.18, 33.22]} scale={[ROAD_LENGTH, 0.3, 0.34]} castShadow receiveShadow />
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.18, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_OUTER_RADIUS} outerRadius={ROAD_CURVE_OUTER_RADIUS + 0.34} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.18} material={ROAD_CURB} castShadow />
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.18, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_INNER_RADIUS - 0.34} outerRadius={ROAD_CURVE_INNER_RADIUS} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.18} material={ROAD_CURB} castShadow />
      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.18, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_OUTER_RADIUS} outerRadius={ROAD_CURVE_OUTER_RADIUS + 0.34} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.18} material={ROAD_CURB} castShadow />
      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.18, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_INNER_RADIUS - 0.34} outerRadius={ROAD_CURVE_INNER_RADIUS} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.18} material={ROAD_CURB} castShadow />

      <InstanceBatch matrices={drainGrates} material={ROAD_DRAIN} />
    </group>
  );
}

function RoadSidewalks() {
  return (
    <group>
      {/* straight sidewalks */}
      <mesh geometry={BOX} material={ROAD_CONCRETE} position={[0, 0.13, 8.45]} scale={[ROAD_LENGTH, 0.22, 4.3]} receiveShadow />
      <mesh geometry={BOX} material={ROAD_TACTILE} position={[0, 0.255, 9.62]} scale={[ROAD_LENGTH, 0.035, 0.28]} receiveShadow />
      <mesh geometry={BOX} material={ROAD_CONCRETE} position={[0, 0.165, 10.05]} scale={[9.2, 0.12, 1.65]} receiveShadow />
      <mesh geometry={BOX} material={ROAD_CONCRETE} position={[0, 0.13, 35.6]} scale={[ROAD_LENGTH, 0.22, 4.5]} receiveShadow />

      {/* curved sidewalks */}
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.13, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_OUTER_RADIUS + 0.34} outerRadius={ROAD_CURVE_OUTER_RADIUS + 4.64} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.13} material={ROAD_CONCRETE} />
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.255, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_OUTER_RADIUS + 1.18} outerRadius={ROAD_CURVE_OUTER_RADIUS + 1.46} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.255} material={ROAD_TACTILE} />
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.13, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_INNER_RADIUS - 4.84} outerRadius={ROAD_CURVE_INNER_RADIUS - 0.34} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.13} material={ROAD_CONCRETE} />

      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.13, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_OUTER_RADIUS + 0.34} outerRadius={ROAD_CURVE_OUTER_RADIUS + 4.64} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.13} material={ROAD_CONCRETE} />
      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.255, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_OUTER_RADIUS + 1.18} outerRadius={ROAD_CURVE_OUTER_RADIUS + 1.46} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.255} material={ROAD_TACTILE} />
      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.13, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_INNER_RADIUS - 4.84} outerRadius={ROAD_CURVE_INNER_RADIUS - 0.34} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.13} material={ROAD_CONCRETE} />
    </group>
  );
}

function RoadMedianReal() {
  const shrubs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const random = seeded(7603);
    for (
      let x = -ROAD_STRAIGHT_HALF + 7;
      x <= ROAD_STRAIGHT_HALF - 7;
      x += 7.2
    ) {
      const s = 0.18 + random() * 0.12;
      if (Math.abs(x - UNIPOLE_FORWARD_X) < 4.0) continue;
      const row = Math.round((x + ROAD_STRAIGHT_HALF) / 7.2) % 2 === 0 ? -1 : 1;
      const z = ROAD_CENTER_Z + row * (1.05 + random() * 0.48);
      out.push(matrix([x + (random() - 0.5) * 0.7, 0.45, z], [0, random() * Math.PI, 0], [s * 1.5, s * 0.8, s]));
    }

    const makeArcShrubs = (centerX: number, start: number, end: number) => {
      for (let a = start; a <= end; a += 0.12) {
        const s = 0.16 + random() * 0.1;
        const r = ROAD_CURVE_RADIUS + (random() - 0.5) * 2.3;
        const x = centerX + Math.cos(a) * r;
        const z = ROAD_CURVE_CENTER_Z + Math.sin(a) * r;
        out.push(matrix([x, 0.45, z], [0, random() * Math.PI, 0], [s * 1.4, s * 0.8, s]));
      }
    };

    makeArcShrubs(-ROAD_STRAIGHT_HALF, Math.PI + 0.08, Math.PI * 1.5 - 0.08);
    makeArcShrubs(ROAD_STRAIGHT_HALF, Math.PI * 1.5 + 0.08, Math.PI * 2 - 0.08);

    return out;
  }, []);

  return (
    <group>
      {/* Broad divided-highway median with concrete shoulders, soil and grass. */}
      <mesh geometry={BOX} material={ROAD_CONCRETE} position={[0, 0.13, ROAD_CENTER_Z]} scale={[ROAD_LENGTH, 0.24, HIGHWAY_MEDIAN_WIDTH + 0.7]} receiveShadow />
      <mesh geometry={BOX} material={MEDIAN_SOIL} position={[0, 0.265, ROAD_CENTER_Z]} scale={[ROAD_LENGTH, 0.17, HIGHWAY_MEDIAN_WIDTH]} receiveShadow />
      <mesh geometry={BOX} material={MEDIAN_GREEN} position={[0, 0.365, ROAD_CENTER_Z]} scale={[ROAD_LENGTH, 0.055, HIGHWAY_MEDIAN_WIDTH - 0.55]} receiveShadow />
      <mesh geometry={BOX} material={ROAD_CURB} position={[0, 0.27, HIGHWAY_MEDIAN_MIN_Z]} scale={[ROAD_LENGTH, 0.38, 0.22]} castShadow receiveShadow />
      <mesh geometry={BOX} material={ROAD_CURB} position={[0, 0.27, HIGHWAY_MEDIAN_MAX_Z]} scale={[ROAD_LENGTH, 0.38, 0.22]} castShadow receiveShadow />

      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.13, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF - 0.35} outerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF + 0.35} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.13} material={ROAD_CONCRETE} />
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.265, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF} outerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.265} material={MEDIAN_SOIL} />
      <ArcStrip center={[-ROAD_STRAIGHT_HALF, 0.365, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF + 0.27} outerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF - 0.27} thetaStart={Math.PI} thetaLength={Math.PI / 2} y={0.365} material={MEDIAN_GREEN} />

      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.13, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF - 0.35} outerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF + 0.35} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.13} material={ROAD_CONCRETE} />
      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.265, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF} outerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.265} material={MEDIAN_SOIL} />
      <ArcStrip center={[ROAD_STRAIGHT_HALF, 0.365, ROAD_CURVE_CENTER_Z]} innerRadius={ROAD_CURVE_RADIUS - HIGHWAY_MEDIAN_HALF + 0.27} outerRadius={ROAD_CURVE_RADIUS + HIGHWAY_MEDIAN_HALF - 0.27} thetaStart={Math.PI * 1.5} thetaLength={Math.PI / 2} y={0.365} material={MEDIAN_GREEN} />

      <InstanceBatch matrices={shrubs} geometry={SMALL_PLANT} material={MEDIAN_GREEN} />
    </group>
  );
}

function HighwayCrashBarriers() {
  const posts = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const lines = [10.52, HIGHWAY_MEDIAN_MIN_Z - 0.18, HIGHWAY_MEDIAN_MAX_Z + 0.18, 33.48];

    for (let x = -ROAD_STRAIGHT_HALF + 4; x <= ROAD_STRAIGHT_HALF - 4; x += 7.5) {
      lines.forEach((z) => {
        out.push(matrix([x, 0.5, z], [0, 0, 0], [0.09, 0.88, 0.09]));
      });
    }

    return out;
  }, []);

  const barrierLines = [10.52, HIGHWAY_MEDIAN_MIN_Z - 0.18, HIGHWAY_MEDIAN_MAX_Z + 0.18, 33.48];

  return (
    <group dispose={null}>
      <InstanceBatch matrices={posts} material={ROAD_LIGHT_METAL} castShadow />
      {barrierLines.map((z) => (
        <group key={`barrier-${z}`}>
          <mesh geometry={BOX} material={ROAD_LIGHT_METAL} position={[0, 0.62, z]} scale={[ROAD_LENGTH, 0.11, 0.12]} castShadow />
          <mesh geometry={BOX} material={ROAD_LIGHT_METAL} position={[0, 0.38, z]} scale={[ROAD_LENGTH, 0.08, 0.09]} castShadow />
        </group>
      ))}
    </group>
  );
}

function useAdinnBoardTexture() {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const createdTextures: THREE.CanvasTexture[] = [];

    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 768;

    const context = canvas.getContext("2d");
    if (!context) return;

    const render = (logo: HTMLImageElement | null) => {
      const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      background.addColorStop(0, "#f8f8f5");
      background.addColorStop(0.55, "#ffffff");
      background.addColorStop(1, "#ececea");

      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "#d71920";
      context.fillRect(0, 0, 22, canvas.height);

      const logoWidth = 300;
      const logoHeight = logoWidth * (47 / 125);
      const logoX = 96;
      const logoY = 78;

      if (logo) {
        context.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      } else {
        context.fillStyle = "#111111";
        context.font = "800 60px Arial";
        context.textAlign = "left";
        context.fillText("ADINN", logoX, logoY + logoHeight * 0.72);
      }

      context.fillStyle = "#6a6a6a";
      context.font = "600 28px Arial";
      context.textAlign = "left";
      context.fillText("UNIPOLE ADVERTISING", logoX, logoY + logoHeight + 44);

      context.fillStyle = "#171717";
      context.font = "800 92px Arial";
      context.fillText("STAND TALL.", 96, 400);
      context.fillText("STAY MEMORABLE.", 96, 496);

      context.strokeStyle = "#d71920";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(98, 534);
      context.lineTo(760, 534);
      context.stroke();

      context.fillStyle = "#3a3a3a";
      context.font = "600 40px Arial";
      context.fillText("Guiding Journeys.", 96, 602);
      context.fillText("Defining Destinations.", 96, 654);

      const rightX = canvas.width - 96;
      context.textAlign = "right";
      context.fillStyle = "#d71920";
      context.font = "700 36px Arial";
      context.fillText("FROM GROUND TO SKY", rightX, 190);

      context.fillStyle = "#282828";
      context.font = "600 30px Arial";
      context.fillText("STANDARD UNIPOLE", rightX, 258);
      context.fillText("LED UNIPOLE", rightX, 306);
      context.fillText("SPECIAL SIGNAGE", rightX, 354);

      context.strokeStyle = "#d71920";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(canvas.width - 480, 396);
      context.lineTo(rightX, 396);
      context.stroke();

      context.fillStyle = "#6a6a6a";
      context.font = "600 24px Arial";
      context.fillText("ENGINEERED • FABRICATED • INSTALLED", rightX, 464);

      context.fillStyle = "#171717";
      context.font = "700 22px Arial";
      context.fillText("ADINN ADVERTISING SERVICES LTD.", rightX, canvas.height - 108);
      context.textAlign = "left";

      const nextTexture = new THREE.CanvasTexture(canvas);
      nextTexture.colorSpace = THREE.SRGBColorSpace;
      nextTexture.anisotropy = 8;
      nextTexture.needsUpdate = true;
      createdTextures.push(nextTexture);

      if (!cancelled) setTexture(nextTexture);
    };

    render(null);

    const logoImage = new window.Image();
    logoImage.onload = () => {
      if (!cancelled) render(logoImage);
    };
    logoImage.src = "/AdinnLogo.svg";

    return () => {
      cancelled = true;
      createdTextures.forEach((created) => created.dispose());
    };
  }, []);

  return texture;
}

function SteelMaterial({
  color = "#878d92",
  roughness = 0.36,
}: {
  color?: string;
  roughness?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={0.9}
      roughness={roughness}
      envMapIntensity={0.9}
    />
  );
}

function BoxMember({
  position,
  size,
  rotation = [0, 0, 0],
  color = "#73797e",
}: {
  position: Vec3;
  size: Vec3;
  rotation?: Vec3;
  color?: string;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <SteelMaterial color={color} />
    </mesh>
  );
}

function BeamBetween({
  start,
  end,
  radius = 0.06,
  color = "#696f74",
}: {
  start: Vec3;
  end: Vec3;
  radius?: number;
  color?: string;
}) {
  const transform = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const length = direction.length();
    const midpoint = a.clone().add(b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );

    return { length, midpoint, quaternion };
  }, [end, start]);

  return (
    <mesh
      position={transform.midpoint}
      quaternion={transform.quaternion}
      castShadow
    >
      <cylinderGeometry
        args={[radius, radius, transform.length, 18]}
      />
      <SteelMaterial color={color} roughness={0.34} />
    </mesh>
  );
}

function AnchorBolt({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.68, 18]} />
        <meshStandardMaterial
          color="#33383d"
          metalness={0.9}
          roughness={0.36}
        />
      </mesh>

      {/* Washer */}
      <mesh position={[0, 0.205, 0]} castShadow>
        <cylinderGeometry args={[0.115, 0.115, 0.025, 16]} />
        <meshStandardMaterial
          color="#2c3034"
          metalness={0.88}
          roughness={0.4}
        />
      </mesh>

      {/* Nut */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.08, 6]} />
        <meshStandardMaterial
          color="#24282c"
          metalness={0.88}
          roughness={0.38}
        />
      </mesh>
    </group>
  );
}

function LadderSafetyHoop({ y }: { y: number }) {
  const segments = 5;
  const radius = 0.34;

  const points = useMemo<Vec3[]>(
    () =>
      Array.from({ length: segments + 1 }, (_, index) => {
        const angle = (Math.PI * index) / segments;
        return [
          Math.sin(angle) * radius,
          y,
          -Math.cos(angle) * radius - 0.1,
        ] as Vec3;
      }),
    [y],
  );

  return (
    <>
      {points.slice(0, -1).map((point, index) => (
        <BeamBetween
          key={index}
          start={point}
          end={points[index + 1]}
          radius={0.022}
          color="#3a3f43"
        />
      ))}
    </>
  );
}

function Ladder() {
  /* Trimmed to end just below the rear mounting head instead of
     extending past the (now shorter) pole top. */
  const rungs = Array.from({ length: 18 }, (_, index) => index);
  const hoopHeights = [-3.4, -1.8, -0.2, 1.4];

  return (
    <group name="Ladder" position={[0, 5.15, -0.64]}>
      <BoxMember
        position={[-0.23, -0.6, 0]}
        size={[0.055, 7.0, 0.055]}
        color="#42474b"
      />
      <BoxMember
        position={[0.23, -0.6, 0]}
        size={[0.055, 7.0, 0.055]}
        color="#42474b"
      />

      {rungs.map((index) => (
        <BoxMember
          key={index}
          position={[0, -4.0 + index * 0.4, 0]}
          size={[0.5, 0.045, 0.055]}
          color="#3a3f43"
        />
      ))}

      {/* Safety cage hoops */}
      {hoopHeights.map((y) => (
        <LadderSafetyHoop key={y} y={y} />
      ))}
    </group>
  );
}

function ElectricalDetails() {
  return (
    <group name="ElectricalDetails">
      {/* Conduit run along the pole face, ending at the mounting head */}
      <BeamBetween
        start={[0.62, 0.9, 0.2]}
        end={[0.55, 7.8, 0.1]}
        radius={0.032}
        color="#262a2d"
      />

      {/* Base junction box */}
      <mesh position={[0.66, 0.95, 0.3]} castShadow>
        <boxGeometry args={[0.24, 0.32, 0.13]} />
        <meshStandardMaterial
          color="#23282b"
          metalness={0.68}
          roughness={0.46}
        />
      </mesh>
      <mesh position={[0.66, 0.95, 0.37]}>
        <boxGeometry args={[0.18, 0.24, 0.02]} />
        <meshStandardMaterial
          color="#3a4044"
          metalness={0.55}
          roughness={0.5}
        />
      </mesh>

      {/* Upper junction box near the mounting head */}
      <mesh position={[0.55, 7.85, 0.16]} castShadow>
        <boxGeometry args={[0.2, 0.26, 0.11]} />
        <meshStandardMaterial
          color="#23282b"
          metalness={0.68}
          roughness={0.46}
        />
      </mesh>
    </group>
  );
}

/*
 * Vertical layout notes (local to PoleAndBase / poleRef, which itself sits
 * at outer-model position.y = 0.66):
 *
 * The pole intentionally ends well below the rear frame's resting bottom
 * edge (outer y ~= 9.33). A dedicated mounting head, support beam and
 * cantilever brackets bridge that gap so the pole never visually enters
 * the billboard face — only the mounting assembly does.
 */
const POLE_BASE_Y = 0.45;
const POLE_HEIGHT = 7.5;
const POLE_TOP_Y = POLE_BASE_Y + POLE_HEIGHT;

/* Where the rear frame's bottom-centre sits once seated, expressed in
   PoleAndBase-local space (outer target minus the poleRef y-offset). */
const FRAME_CONNECT_Y = 8.7;
const FRAME_CONNECT_Z = -0.68;

function RearMountingHead() {
  return (
    <group name="RearMount">
      {/* Cap plate at the pole top */}
      <mesh position={[0, POLE_TOP_Y + 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.46, 0.16, 28]} />
        <SteelMaterial color="#5a6165" roughness={0.4} />
      </mesh>

      {/* T-shaped crossbar */}
      <BoxMember
        position={[0, POLE_TOP_Y + 0.32, 0]}
        size={[1.55, 0.18, 0.34]}
        color="#565d61"
      />

      {/* Main support beam rising from the mounting head to the rear frame */}
      <BeamBetween
        start={[0, POLE_TOP_Y + 0.24, 0.02]}
        end={[0, FRAME_CONNECT_Y, FRAME_CONNECT_Z]}
        radius={0.17}
        color="#5a6165"
      />

      {/* Cantilever brackets bracing the beam to the frame's lower corners */}
      <BeamBetween
        start={[0, POLE_TOP_Y + 0.2, -0.05]}
        end={[-1.85, FRAME_CONNECT_Y - 0.35, FRAME_CONNECT_Z - 0.05]}
        radius={0.095}
      />
      <BeamBetween
        start={[0, POLE_TOP_Y + 0.2, -0.05]}
        end={[1.85, FRAME_CONNECT_Y - 0.35, FRAME_CONNECT_Z - 0.05]}
        radius={0.095}
      />
    </group>
  );
}

function PoleAndBase() {
  return (
    <group>
      <mesh
        name="Pole"
        position={[0, POLE_BASE_Y + POLE_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.44, 0.72, POLE_HEIGHT, 56]} />
        <meshStandardMaterial
          color="#c5c9cc"
          metalness={0.9}
          roughness={0.38}
          envMapIntensity={1.05}
        />
      </mesh>

      <mesh name="BasePlate" position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[1.02, 1.02, 0.22, 44]} />
        <meshStandardMaterial
          color="#8f9599"
          metalness={0.88}
          roughness={0.4}
        />
      </mesh>

      <group name="GussetPlates">
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(
          (rotation, index) => (
            <mesh
              key={index}
              position={[
                Math.sin(rotation) * 0.68,
                0.76,
                Math.cos(rotation) * 0.68,
              ]}
              rotation={[0, rotation, 0]}
              castShadow
            >
              <boxGeometry args={[0.12, 0.72, 0.68]} />
              <SteelMaterial color="#747a7e" />
            </mesh>
          ),
        )}
      </group>

      <RearMountingHead />
      <Ladder />
      <ElectricalDetails />
    </group>
  );
}

function RearStructuralFrame() {
  const verticalPosts = [-4.35, -2.9, -1.45, 0, 1.45, 2.9, 4.35];

  return (
    <group>
      <BoxMember
        position={[0, 1.82, -0.52]}
        size={[9.5, 0.18, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[0, -1.82, -0.52]}
        size={[9.5, 0.18, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[-4.66, 0, -0.52]}
        size={[0.18, 3.82, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[4.66, 0, -0.52]}
        size={[0.18, 3.82, 0.24]}
        color="#6b7074"
      />

      {verticalPosts.map((x) => (
        <BoxMember
          key={x}
          position={[x, 0, -0.95]}
          size={[0.08, 3.45, 0.08]}
          color="#656b6f"
        />
      ))}

      <group name="CrossBracing">
        {verticalPosts.map((x, index) => (
          <BeamBetween
            key={x}
            start={[x - 0.52, -1.55, -0.92]}
            end={[x + 0.52, 1.55, -0.92]}
            radius={0.045}
            color={index % 2 === 0 ? "#5e6468" : "#70767a"}
          />
        ))}

        <BeamBetween
          start={[-2.6, -2.2, -0.7]}
          end={[-0.9, -3.75, -0.15]}
          radius={0.1}
        />
        <BeamBetween
          start={[2.6, -2.2, -0.7]}
          end={[0.9, -3.75, -0.15]}
          radius={0.1}
        />
        <BeamBetween
          start={[-2.2, -1.8, -0.6]}
          end={[-0.7, -0.25, -0.15]}
          radius={0.075}
        />
        <BeamBetween
          start={[2.2, -1.8, -0.6]}
          end={[0.7, -0.25, -0.15]}
          radius={0.075}
        />
      </group>

      <BoxMember
        position={[0, -2.22, -0.7]}
        size={[5.8, 0.28, 0.36]}
        color="#666c70"
      />

      <BoxMember
        position={[0, -3.75, -0.15]}
        size={[2.35, 0.3, 0.44]}
        color="#62686c"
      />
    </group>
  );
}

function MaintenanceDeck() {
  const deckSections = [-3.75, -2.5, -1.25, 0, 1.25, 2.5, 3.75];

  return (
    <group position={[0, -2.24, 0.72]}>
      <BoxMember
        position={[0, 0, 0]}
        size={[9.15, 0.15, 1.6]}
        color="#7f8589"
      />

      {deckSections.map((x) => (
        <group key={x} position={[x, 0.11, 0]}>
          <BoxMember
            position={[0, 0, 0]}
            size={[1.02, 0.07, 1.34]}
            color="#93989c"
          />

          {[-0.44, -0.22, 0, 0.22, 0.44].map((z) => (
            <BoxMember
              key={z}
              position={[0, 0.05, z]}
              size={[0.9, 0.025, 0.03]}
              color="#63686c"
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function FloodLight({
  position,
  rotation = [0, 0, 0],
}: {
  position: Vec3;
  rotation?: Vec3;
}) {
  const coolingFins = [-0.1, 0, 0.1];

  return (
    <group position={position} rotation={rotation}>
      {/* Galvanized mounting yoke */}
      <mesh position={[0, -0.2, -0.02]} castShadow>
        <boxGeometry args={[0.36, 0.045, 0.065]} />
        <meshStandardMaterial
          color="#7d858a"
          metalness={0.88}
          roughness={0.28}
        />
      </mesh>

      <mesh position={[-0.16, -0.06, -0.02]} castShadow>
        <boxGeometry args={[0.045, 0.2, 0.065]} />
        <meshStandardMaterial
          color="#71797e"
          metalness={0.9}
          roughness={0.27}
        />
      </mesh>

      <mesh position={[0.16, -0.06, -0.02]} castShadow>
        <boxGeometry args={[0.045, 0.2, 0.065]} />
        <meshStandardMaterial
          color="#71797e"
          metalness={0.9}
          roughness={0.27}
        />
      </mesh>

      {/* Adjustable hinge knuckle between yoke and housing */}
      <mesh
        position={[0, -0.02, -0.06]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.045, 0.045, 0.14, 12]} />
        <meshStandardMaterial
          color="#5a6166"
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>

      {/* Powder-coated floodlight housing */}
      <RoundedBox
        args={[0.42, 0.24, 0.3]}
        radius={0.045}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial
          color="#20262a"
          metalness={0.76}
          roughness={0.22}
          envMapIntensity={1.2}
        />
      </RoundedBox>

      {/* Visible edge highlight around the lens opening, so the fixture
          reads clearly against the black background */}
      <mesh position={[0, 0, 0.205]}>
        <ringGeometry args={[0.135, 0.155, 20]} />
        <meshStandardMaterial
          color="#6b7278"
          metalness={0.7}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rear heat-sink fins */}
      {coolingFins.map((x) => (
        <mesh key={x} position={[x, 0, -0.17]} castShadow>
          <boxGeometry args={[0.02, 0.17, 0.06]} />
          <meshStandardMaterial
            color="#12171a"
            metalness={0.82}
            roughness={0.32}
          />
        </mesh>
      ))}

      {/* Recessed glass lens and reflector */}
      <RoundedBox
        position={[0, 0, 0.162]}
        args={[0.3, 0.145, 0.028]}
        radius={0.025}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color="#fff5d6"
          emissive="#ffe5a3"
          emissiveIntensity={4.6}
          roughness={0.08}
          metalness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.08}
          toneMapped={false}
        />
      </RoundedBox>

      <mesh position={[0, 0, 0.181]}>
        <planeGeometry args={[0.23, 0.095]} />
        <meshBasicMaterial
          color="#fffdf3"
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* Fixture x-positions across the top rail. All billboard illumination now
   lives up here, structurally attached to the frame — no ground-level or
   base-mounted fixtures remain. */
const BOARD_LIGHT_X = [-3.75, -1.88, 0, 1.88, 3.75] as const;

/* The lighting group is mounted at the billboard's vertical centre.
   Keep this value aligned with the RearFrame and SignageBoard Y position. */
const BOARD_LIGHT_GROUP_Y = 11.55;

/* One pose controls each housing, its arm attachment AND its real light.
 * A housing's lens faces local +Z. The old 0.58-radian tilt aimed it downward
 * but OUT away from the board. Aim +Z at the actual panel face instead.
 */
function createBoardLightPose(x: number) {
  // Shorter real-world bracket. The housing is deliberately only mildly
  // pitched downward so it remains visible from the front hero camera.
  const position = new THREE.Vector3(x, 2.42 + BOARD_LIGHT_RISE, 0.62);
  const rotation = new THREE.Euler(THREE.MathUtils.degToRad(24), 0, 0);
  const armEnd = new THREE.Vector3(x, 2.28 + BOARD_LIGHT_RISE, 0.48);

  // Actual illumination aims at the upper-middle board face. This is kept
  // separate from the housing pose to avoid visually hiding the fixture.
  const lightPosition = new THREE.Vector3(x, 2.30 + BOARD_LIGHT_RISE, 0.38);
  const targetPosition = new THREE.Vector3(x, BOARD_LIGHT_AIM_OFFSET_Y, 0.18);
  return {
    x,
    position: [position.x, position.y, position.z] as Vec3,
    rotation: [rotation.x, rotation.y, rotation.z] as Vec3,
    armEnd: [armEnd.x, armEnd.y, armEnd.z] as Vec3,
    lightPosition: [lightPosition.x, lightPosition.y, lightPosition.z] as Vec3,
    targetPosition: [targetPosition.x, targetPosition.y, targetPosition.z] as Vec3,
  };
}
const BOARD_LIGHT_POSES = BOARD_LIGHT_X.map(createBoardLightPose);

function LightingRig({ isNight }: { isNight: boolean }) {
  return (
    <group>
      <group name="LightArms">
        {BOARD_LIGHT_POSES.map((pose) => (
          <group key={pose.x}>
            <BoxMember
              position={[pose.x, 1.82, -0.14]}
              size={[0.16, 0.16, 0.22]}
              color="#4b5157"
            />
            <BeamBetween
              start={[pose.x, 1.86, -0.06]}
              end={pose.armEnd}
              radius={0.05}
              color="#454a4e"
            />
          </group>
        ))}
      </group>
      <group name="FloodLights">
        {BOARD_LIGHT_POSES.map((pose) => (
          <FloodLight key={pose.x} position={pose.position} rotation={pose.rotation} />
        ))}
      </group>

      {isNight && (
        <group name="FloodLightVisibleGlow">
          {BOARD_LIGHT_POSES.map((pose) => (
            <sprite
              key={`glow-${pose.x}`}
              position={pose.position}
              scale={[0.58, 0.58, 1]}
              material={UNIPOLE_LIGHT_GLOW_MATERIAL}
            />
          ))}
        </group>
      )}
    </group>
  );
}

function useAdinnBoardVideoTexture() {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameloop = useThree((state) => state.frameloop);
  const get = useThree((state) => state.get);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (frameloop === "always" && !document.hidden) void video.play().catch(() => {});
    else video.pause();
  }, [frameloop]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let disposed = false;
    let createdTexture: THREE.VideoTexture | null = null;
    const video = document.createElement("video");
    videoRef.current = video;

    video.src = ADINN_BOARD_VIDEO_PATH;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = false;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const tryPlay = () => {
      if (disposed) return;
      if (get().frameloop !== "always" || document.hidden) {
        video.pause();
        return;
      }
      void video.play().catch(() => {
        // Muted autoplay is normally allowed. If a browser still blocks it,
        // the pointer/scroll listeners below retry after user interaction.
      });
    };

    const createTexture = () => {
      if (disposed || createdTexture) return;

      createdTexture = new THREE.VideoTexture(video);
      createdTexture.colorSpace = THREE.SRGBColorSpace;
      createdTexture.minFilter = THREE.LinearFilter;
      createdTexture.magFilter = THREE.LinearFilter;
      createdTexture.generateMipmaps = false;
      createdTexture.needsUpdate = true;
      setTexture(createdTexture);
      tryPlay();
    };

    const handleError = () => {
      // FrontDisplayPanel keeps the static Adinn canvas texture as fallback.
      if (!disposed) setTexture(null);
    };

    video.addEventListener("loadeddata", createTexture);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("error", handleError);
    document.addEventListener("pointerdown", tryPlay, { once: true });
    window.addEventListener("scroll", tryPlay, { passive: true, once: true });
    video.load();

    return () => {
      disposed = true;
      video.removeEventListener("loadeddata", createTexture);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("error", handleError);
      document.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("scroll", tryPlay);
      video.pause();
      videoRef.current = null;
      video.removeAttribute("src");
      video.load();
      createdTexture?.dispose();
    };
  }, [get]);

  return texture;
}

function FrontDisplayPanel({ isNight }: { isNight: boolean }) {
  const fallbackTexture = useAdinnBoardTexture();
  const videoTexture = useAdinnBoardVideoTexture();
  const displayTexture = videoTexture ?? fallbackTexture;

  return (
    <group>
      <RoundedBox
        args={[9.14, 3.52, 0.16]}
        radius={0.035}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          map={displayTexture ?? undefined}
          emissiveMap={isNight ? (displayTexture ?? undefined) : (videoTexture ?? undefined)}
          emissive={displayTexture ? "#ffffff" : "#000000"}
          emissiveIntensity={
            isNight
              ? (videoTexture ? 0.82 : 0.55)
              : (videoTexture ? ADINN_BOARD_VIDEO_EMISSIVE_INTENSITY : 0)
          }
          color={displayTexture ? "#ffffff" : "#f4f4f1"}
          roughness={videoTexture ? 0.34 : 0.46}
          metalness={0.02}
          toneMapped
        />
      </RoundedBox>

      <mesh position={[0, 0, -0.13]} castShadow>
        <boxGeometry args={[9.3, 3.68, 0.11]} />
        <meshStandardMaterial
          color="#c2c6c8"
          metalness={0.56}
          roughness={0.42}
        />
      </mesh>

      <BoxMember position={[0, 1.85, -0.02]} size={[9.38, 0.12, 0.23]} color="#7a8084" />
      <BoxMember position={[0, -1.85, -0.02]} size={[9.38, 0.12, 0.23]} color="#7a8084" />
      <BoxMember position={[-4.7, 0, -0.02]} size={[0.12, 3.8, 0.23]} color="#7a8084" />
      <BoxMember position={[4.7, 0, -0.02]} size={[0.12, 3.8, 0.23]} color="#7a8084" />
    </group>
  );
}

/* ========================================================================== */
/* STAGE 01 / 02 VISUALS - SURVEY + STRUCTURAL ENGINEERING                    */
/* ========================================================================== */

function SurveyStageVisual() {
  const stakes: Vec3[] = [
    [-1.65, 0.48, -1.55],
    [1.65, 0.48, -1.55],
    [-1.65, 0.48, 1.55],
    [1.65, 0.48, 1.55],
  ];

  return (
    <group name="Stage01SiteSurvey">
      {/* Surveyed foundation footprint */}
      <BoxMember position={[0, 0.07, -1.7]} size={[3.55, 0.05, 0.06]} color="#d71920" />
      <BoxMember position={[0, 0.07, 1.7]} size={[3.55, 0.05, 0.06]} color="#d71920" />
      <BoxMember position={[-1.75, 0.07, 0]} size={[0.06, 0.05, 3.4]} color="#d71920" />
      <BoxMember position={[1.75, 0.07, 0]} size={[0.06, 0.05, 3.4]} color="#d71920" />

      {stakes.map((position, index) => (
        <group key={`survey-stake-${index}`} position={position}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.95, 10]} />
            <meshStandardMaterial color="#d71920" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.38, 0]} castShadow>
            <sphereGeometry args={[0.075, 12, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.38} />
          </mesh>
        </group>
      ))}

      {/* Total station + tripod */}
      <group position={[2.5, 0, 1.7]}>
        <BeamBetween start={[0, 1.42, 0]} end={[-0.65, 0.05, -0.48]} radius={0.032} color="#4e555a" />
        <BeamBetween start={[0, 1.42, 0]} end={[0.68, 0.05, -0.42]} radius={0.032} color="#4e555a" />
        <BeamBetween start={[0, 1.42, 0]} end={[0.04, 0.05, 0.76]} radius={0.032} color="#4e555a" />
        <mesh position={[0, 1.48, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.22, 0.12, 18]} />
          <meshStandardMaterial color="#3e454a" metalness={0.5} roughness={0.42} />
        </mesh>
        <RoundedBox position={[0, 1.7, 0]} args={[0.46, 0.34, 0.34]} radius={0.04} smoothness={2} castShadow>
          <meshStandardMaterial color="#d5a928" metalness={0.24} roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 1.73, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 16]} />
          <meshStandardMaterial color="#20272c" metalness={0.4} roughness={0.24} />
        </mesh>
      </group>

      {/* Compact borehole / soil test rig */}
      <group position={[-2.45, 0, 1.35]}>
        <BoxMember position={[0, 0.08, 0]} size={[1.1, 0.12, 0.78]} color="#6d7377" />
        <BoxMember position={[0, 1.3, 0]} size={[0.11, 2.5, 0.11]} color="#50575c" />
        <BoxMember position={[0, 2.5, 0]} size={[0.9, 0.11, 0.11]} color="#50575c" />
        <mesh position={[0.26, 1.14, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 2.18, 12]} />
          <meshStandardMaterial color="#363c40" metalness={0.75} roughness={0.36} />
        </mesh>
        <mesh position={[0.26, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.055, 0.4, 12]} />
          <meshStandardMaterial color="#545b60" metalness={0.72} roughness={0.38} />
        </mesh>
      </group>

      {/* Centre marker */}
      <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.47, 48]} />
        <meshBasicMaterial color="#d71920" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function StructuralEngineeringVisual() {
  return (
    <group name="Stage02StructuralEngineering">
      <gridHelper args={[8.5, 17, "#4b98c9", "#28495c"]} position={[0, 0.035, 0]} />

      {/* Ghosted engineered foundation */}
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[3.15, 0.68, 3.15]} />
        <meshBasicMaterial color="#48b7e8" wireframe transparent opacity={0.42} />
      </mesh>

      {/* Engineered tapered mast envelope */}
      <mesh position={[0, 4.86, 0]}>
        <cylinderGeometry args={[0.44, 0.72, 7.5, 28]} />
        <meshBasicMaterial color="#48b7e8" wireframe transparent opacity={0.5} />
      </mesh>

      {/* Billboard design envelope / structural frame */}
      <mesh position={[0, 11.55, -0.18]}>
        <boxGeometry args={[9.5, 3.82, 0.5]} />
        <meshBasicMaterial color="#ff5360" wireframe transparent opacity={0.48} />
      </mesh>

      {/* Structural centre line + load direction guides */}
      <BeamBetween start={[0, 0.45, -2.25]} end={[0, 12.1, -2.25]} radius={0.018} color="#48b7e8" />
      <BeamBetween start={[-4.8, 13.75, -0.18]} end={[4.8, 13.75, -0.18]} radius={0.018} color="#ff5360" />
      <BeamBetween start={[-4.8, 9.35, -0.18]} end={[4.8, 9.35, -0.18]} radius={0.018} color="#ff5360" />

      {/* Wind-load arrows shown as compact 3D members. */}
      {[-3.2, 0, 3.2].map((x) => (
        <group key={`load-arrow-${x}`}>
          <BeamBetween start={[x, 11.55, 2.0]} end={[x, 11.55, 0.7]} radius={0.035} color="#d71920" />
          <mesh position={[x, 11.55, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.13, 0.34, 14]} />
            <meshStandardMaterial color="#d71920" roughness={0.42} />
          </mesh>
        </group>
      ))}

      {/* Foundation load rings */}
      {[0.95, 1.35].map((radius) => (
        <mesh key={radius} position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.025, 10, 64]} />
          <meshBasicMaterial color="#48b7e8" transparent opacity={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function FinalInspectionVisual() {
  return (
    <group name="Stage08InspectionMarkers">
      {[
        [0, 1.0, 0, 1.15],
        [0, 5.4, 0, 0.82],
        [0, 11.55, 0.35, 1.45],
      ].map(([x, y, z, radius], index) => (
        <mesh key={index} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.025, 10, 56]} />
          <meshBasicMaterial color="#d71920" transparent opacity={0.78} />
        </mesh>
      ))}
    </group>
  );
}

function CityReferenceUnipole({
  progressRef,
  isNight,
}: {
  progressRef: { current: number };
  isNight: boolean;
}) {
  const surveyRef = useRef<THREE.Group | null>(null);
  const engineeringRef = useRef<THREE.Group | null>(null);
  const inspectionRef = useRef<THREE.Group | null>(null);
  const foundationRef = useRef<THREE.Group | null>(null);
  const poleRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<THREE.Group | null>(null);
  const lightingRef = useRef<THREE.Group | null>(null);
  const panelRef = useRef<THREE.Group | null>(null);
  const boardLightRefs = useRef<Array<THREE.SpotLight | null>>([]);
  const smoothed = useRef(0);

  const boardLightRig = useMemo(
    () =>
      BOARD_LIGHT_POSES.map((pose) => {
        const target = new THREE.Object3D();
        target.position.set(...pose.targetPosition);
        return { position: pose.lightPosition, target };
      }),
    [],
  );

  useFrame((_, delta) => {
    // Current city scroll source is rawStage 0..7. Convert once to 0..1 and
    // damp it so the reference unipole retains the smooth construction feel.
    const target = THREE.MathUtils.clamp(progressRef.current / 7, 0, 1);
    smoothed.current = THREE.MathUtils.damp(smoothed.current, target, 6.5, delta);
    const progress = smoothed.current;

    // Match the visual build to all 8 content stages. Stages 1 and 2 now
    // contain meaningful 3D survey/engineering visuals instead of blank road.
    const survey = 1 - smoothstep01(progress, 0.11, 0.18);
    const engineeringIn = smoothstep01(progress, 0.085, 0.15);
    const engineeringOut = 1 - smoothstep01(progress, 0.255, 0.32);
    const engineering = engineeringIn * engineeringOut;
    const foundation = smoothstep01(progress, 0.255, 0.40);
    const pole = smoothstep01(progress, 0.39, 0.54);
    const frame = smoothstep01(progress, 0.52, 0.68);
    const lighting = smoothstep01(progress, 0.65, 0.80);
    const panel = smoothstep01(progress, 0.77, 0.92);
    const inspection = smoothstep01(progress, 0.91, 1);

    if (surveyRef.current) {
      surveyRef.current.visible = survey > 0.002;
      const surveyScale = THREE.MathUtils.lerp(0.94, 1, survey);
      surveyRef.current.scale.setScalar(surveyScale);
      surveyRef.current.position.y = THREE.MathUtils.lerp(-0.1, 0, survey);
    }

    if (engineeringRef.current) {
      engineeringRef.current.visible = engineering > 0.002;
      const engineeringScale = THREE.MathUtils.lerp(0.93, 1, engineering);
      engineeringRef.current.scale.setScalar(engineeringScale);
      engineeringRef.current.position.y = THREE.MathUtils.lerp(-0.2, 0, engineeringIn);
    }

    if (inspectionRef.current) {
      inspectionRef.current.visible = inspection > 0.002;
      inspectionRef.current.scale.setScalar(THREE.MathUtils.lerp(0.92, 1, inspection));
      inspectionRef.current.rotation.y += delta * 0.12 * inspection;
    }

    if (foundationRef.current) {
      foundationRef.current.visible = foundation > 0.002;
      foundationRef.current.position.y = THREE.MathUtils.lerp(-1.25, 0, foundation);
      foundationRef.current.scale.set(1, THREE.MathUtils.lerp(0.12, 1, foundation), 1);
    }

    if (poleRef.current) {
      poleRef.current.visible = pole > 0.002;
      poleRef.current.scale.set(1, Math.max(0.001, pole), 1);
    }

    if (frameRef.current) {
      frameRef.current.visible = frame > 0.002;
      frameRef.current.position.set(
        0,
        THREE.MathUtils.lerp(10.95, 11.55, frame),
        THREE.MathUtils.lerp(-5.8, -0.18, frame),
      );
      frameRef.current.rotation.x = THREE.MathUtils.lerp(-0.08, 0, frame);
      frameRef.current.scale.setScalar(THREE.MathUtils.lerp(0.9, 1, frame));
    }

    if (lightingRef.current) {
      lightingRef.current.visible = lighting > 0.002;
      lightingRef.current.position.y = THREE.MathUtils.lerp(
        BOARD_LIGHT_GROUP_Y - 0.6,
        BOARD_LIGHT_GROUP_Y,
        lighting,
      );
      lightingRef.current.scale.setScalar(Math.max(0.001, lighting));
    }

    if (panelRef.current) {
      panelRef.current.visible = panel > 0.002;
      panelRef.current.position.set(
        0,
        THREE.MathUtils.lerp(11.78, 11.55, panel),
        THREE.MathUtils.lerp(6.4, 0.22, panel),
      );
      panelRef.current.rotation.y = THREE.MathUtils.lerp(0.07, 0, panel);
      panelRef.current.scale.setScalar(THREE.MathUtils.lerp(0.96, 1, panel));
    }

    // Illuminate the seated display, not empty space during the front-panel lift.
    const intensity = lighting * smoothstep01(panel, 0.85, 1) *
      (isNight ? BOARD_LIGHT_OUTPUT_NIGHT : BOARD_LIGHT_OUTPUT_DAY);
    boardLightRefs.current.forEach((light) => {
      if (light) light.intensity = intensity;
    });
  });

  return (
    <group scale={1.42} position={[0, -0.46, 0]}>
      <group ref={surveyRef}>
        <SurveyStageVisual />
      </group>

      <group ref={engineeringRef} visible={false}>
        <StructuralEngineeringVisual />
      </group>

      <group name="Foundation" ref={foundationRef} visible={false}>
        <RoundedBox
          position={[0, 0.34, 0]}
          args={[3.15, 0.68, 3.15]}
          radius={0.08}
          smoothness={3}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#8b8e91" roughness={0.9} />
        </RoundedBox>

        <group name="AnchorBolts">
          {[
            [-0.96, 0.94, -0.96],
            [0.96, 0.94, -0.96],
            [-0.96, 0.94, 0.96],
            [0.96, 0.94, 0.96],
            [-0.96, 0.94, 0],
            [0.96, 0.94, 0],
          ].map((position, index) => (
            <AnchorBolt key={index} position={position as Vec3} />
          ))}
        </group>
      </group>

      <group
        ref={poleRef}
        position={[0, 0.66, 0]}
        scale={[1, 0.001, 1]}
        visible={false}
      >
        <PoleAndBase />
      </group>

      <group
        name="RearFrame"
        ref={frameRef}
        position={[0, 11.55, -5.8]}
        visible={false}
      >
        <RearStructuralFrame />
        <MaintenanceDeck />
      </group>

      <group
        name="LightArms"
        ref={lightingRef}
        position={[0, BOARD_LIGHT_GROUP_Y, -0.15]}
        scale={0.001}
        visible={false}
      >
        <LightingRig isNight={isNight} />
        {/* Fixtures, emitters and aim targets inherit the SAME animation/scale. */}
        {boardLightRig.map((rig, index) => (
          <group key={`board-light-${index}`}>
            <primitive object={rig.target} />
            <spotLight
              ref={(light) => {
                boardLightRefs.current[index] = light;
                if (light) light.target = rig.target;
              }}
              position={rig.position}
              angle={0.27}
              penumbra={0.72}
              distance={12}
              decay={1.8}
              intensity={0}
              color="#ffe9c2"
              castShadow={false}
            />
          </group>
        ))}
      </group>

      <group
        name="SignageBoard"
        ref={panelRef}
        position={[0, 11.78, 6.4]}
        visible={false}
      >
        <FrontDisplayPanel isNight={isNight} />
      </group>

      <group ref={inspectionRef} visible={false}>
        <FinalInspectionVisual />
      </group>
    </group>
  );
}

function RoadUnipole({
  progressRef,
  isNight,
}: {
  isNight: boolean;
  progressRef: { current: number };
}) {
  return (
    <group
      position={[UNIPOLE_FORWARD_X, 0.2, ROAD_CENTER_Z]}
      // The reference unipole's face is local +Z. -PI/2 makes it read almost
      // perfectly front-on from the default hero camera while preserving a
      // small amount of real frame depth instead of a side-dominant view.
      rotation={[0, -Math.PI / 2, 0]}
    >
      <CityReferenceUnipole progressRef={progressRef} isNight={isNight} />
    </group>
  );
}

function MetroViaductSystem() {
  const deckMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < METRO_SEGMENT_COUNT; i += 1) {
      const { mid, angle, length } = metroFrame(i / METRO_SEGMENT_COUNT, (i + 1) / METRO_SEGMENT_COUNT);
      out.push(matrix([mid.x, METRO_DECK_TOP_Y - METRO_DECK_THICKNESS / 2, mid.z], [0, angle, 0], [length * 1.025, METRO_DECK_THICKNESS, METRO_DECK_WIDTH]));
    }
    return out;
  }, []);

  const undersideBeams = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < METRO_SEGMENT_COUNT; i += 1) {
      const { mid, angle, length } = metroFrame(i / METRO_SEGMENT_COUNT, (i + 1) / METRO_SEGMENT_COUNT);
      const perpX = Math.sin(angle);
      const perpZ = Math.cos(angle);
      [-1, 1].forEach((side) => {
        const offset = side * (METRO_DECK_WIDTH * 0.34);
        out.push(matrix([mid.x + perpX * offset, METRO_DECK_BOTTOM_Y - 0.28, mid.z + perpZ * offset], [0, angle, 0], [length * 1.02, 0.56, 0.38]));
      });
    }
    return out;
  }, []);

  const parapets = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < METRO_SEGMENT_COUNT; i += 1) {
      const { mid, angle, length } = metroFrame(i / METRO_SEGMENT_COUNT, (i + 1) / METRO_SEGMENT_COUNT);
      const perpX = Math.sin(angle);
      const perpZ = Math.cos(angle);
      [-1, 1].forEach((side) => {
        const offset = side * (METRO_DECK_WIDTH / 2 - 0.12);
        out.push(matrix([mid.x + perpX * offset, METRO_DECK_TOP_Y + 0.47, mid.z + perpZ * offset], [0, angle, 0], [length * 1.025, 0.72, 0.16]));
      });
    }
    return out;
  }, []);

  const railMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < METRO_SEGMENT_COUNT; i += 1) {
      const { mid, angle, length } = metroFrame(i / METRO_SEGMENT_COUNT, (i + 1) / METRO_SEGMENT_COUNT);
      const perpX = Math.sin(angle);
      const perpZ = Math.cos(angle);
      [-1, 1].forEach((side) => {
        const offset = METRO_RAIL_GAUGE_HALF * side;
        out.push(matrix([mid.x + perpX * offset, METRO_RAIL_TOP_Y - 0.055, mid.z + perpZ * offset], [0, angle, 0], [length * 1.025, 0.11, 0.09]));
      });
    }
    return out;
  }, []);

  const sleeperMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const count = Math.round(METRO_CURVE.getLength() / METRO_SLEEPER_SPACING);
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const point = METRO_CURVE.getPointAt(t);
      const tangent = METRO_CURVE.getTangentAt(t);
      const angle = Math.atan2(-tangent.z, tangent.x);
      out.push(matrix([point.x, METRO_DECK_TOP_Y + 0.075, point.z], [0, angle, 0], [0.2, 0.11, 2.15]));
    }
    return out;
  }, []);

  const piers = useMemo(() => {
    const shafts: THREE.Matrix4[] = [];
    const caps: THREE.Matrix4[] = [];
    const footings: THREE.Matrix4[] = [];
    const bearings: THREE.Matrix4[] = [];
    for (let i = 0; i < METRO_PIER_COUNT; i += 1) {
      const t = i / (METRO_PIER_COUNT - 1);
      const point = METRO_CURVE.getPointAt(t);
      const tangent = METRO_CURVE.getTangentAt(t);
      const angle = Math.atan2(-tangent.z, tangent.x);
      footings.push(matrix([point.x, 0.25, point.z], [0, angle, 0], [2.5, 0.5, 2.15]));
      shafts.push(matrix([point.x, METRO_DECK_BOTTOM_Y / 2, point.z], [0, 0, 0], [0.9, METRO_DECK_BOTTOM_Y, 0.9]));
      caps.push(matrix([point.x, METRO_DECK_BOTTOM_Y - 0.36, point.z], [0, angle, 0], [2.7, 0.58, METRO_DECK_WIDTH * 0.9]));
      [-1.25, 1.25].forEach((side) => {
        bearings.push(matrix([point.x, METRO_DECK_BOTTOM_Y - 0.03, point.z + side * 0.0], [0, angle, 0], [0.48, 0.16, 0.55]));
      });
    }
    return { shafts, caps, footings, bearings };
  }, []);

  const catenary = useMemo(() => {
    const masts: THREE.Matrix4[] = [];
    const arms: THREE.Matrix4[] = [];
    const droppers: THREE.Matrix4[] = [];
    const count = Math.max(2, Math.round(METRO_CURVE.getLength() / METRO_MAST_SPACING));

    for (let i = 1; i < count; i += 1) {
      const t = i / count;
      const point = METRO_CURVE.getPointAt(t);
      const tangent = METRO_CURVE.getTangentAt(t).normalize();
      const angle = Math.atan2(-tangent.z, tangent.x);
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const mastPos = point.clone().addScaledVector(perp, side * (METRO_DECK_WIDTH / 2 - 0.35));
      masts.push(matrix([mastPos.x, METRO_DECK_TOP_Y + 2.5, mastPos.z], [0, 0, 0], [1, 5.0, 1]));
      arms.push(matrix([mastPos.x - perp.x * side * 1.45, METRO_CATENARY_Y + 0.35, mastPos.z - perp.z * side * 1.45], [0, angle, 0], [2.9, 0.07, 0.08]));
    }

    const dropCount = 70;
    for (let i = 1; i < dropCount; i += 1) {
      const t = i / dropCount;
      const p = METRO_CURVE.getPointAt(t);
      droppers.push(matrix([p.x, METRO_CATENARY_Y + 0.29, p.z], [0, 0, 0], [0.018, 0.58, 0.018]));
    }
    return { masts, arms, droppers };
  }, []);

  return (
    <group dispose={null}>
      <InstanceBatch matrices={piers.footings} material={ROAD_CONCRETE} receiveShadow />
      <InstanceBatch matrices={piers.shafts} geometry={ROAD_POLE_GEOMETRY} material={ROAD_CONCRETE} castShadow receiveShadow />
      <InstanceBatch matrices={piers.caps} material={ROAD_CONCRETE} castShadow receiveShadow />
      <InstanceBatch matrices={piers.bearings} material={ROAD_DRAIN} />
      <InstanceBatch matrices={deckMatrices} material={ROAD_CONCRETE} castShadow receiveShadow />
      <InstanceBatch matrices={undersideBeams} material={ROAD_CURB} castShadow receiveShadow />
      <InstanceBatch matrices={parapets} material={ROAD_CURB} castShadow />
      <InstanceBatch matrices={sleeperMatrices} material={ROAD_TIRE_WEAR} />
      <InstanceBatch matrices={railMatrices} material={UNIPOLE_STEEL} />

      {/* 25 kV-style overhead catenary visual system */}
      <InstanceBatch matrices={catenary.masts} geometry={METRO_CATENARY_POLE_GEOMETRY} material={ROAD_LIGHT_METAL} />
      <InstanceBatch matrices={catenary.arms} material={ROAD_LIGHT_METAL} />
      <InstanceBatch matrices={catenary.droppers} material={METRO_WIRE_MATERIAL} />
      <mesh geometry={METRO_CONTACT_WIRE_GEOMETRY} material={METRO_WIRE_MATERIAL} />
      <mesh geometry={METRO_MESSENGER_WIRE_GEOMETRY} material={METRO_WIRE_MATERIAL} />

      <Suspense fallback={null}>
        <MetroTrain />
      </Suspense>
    </group>
  );
}

function MetroTrain() {
  const { scene } = useGLTF(TRAIN_MODEL_PATH);
  const groupRef = useRef<THREE.Group>(null);

  const setup = useMemo(() => {
    const model = scene.clone(true);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());

    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
      }
      if (!(object as THREE.SkinnedMesh).isSkinnedMesh) {
        object.updateMatrix();
        object.matrixAutoUpdate = false;
      }
    });

    const path = createTrainPathTable();
    const serviceDistance = path.length * (TRAIN_START_U - TRAIN_END_U);
    return {
      model,
      alignment: [
        -center.x * TRAIN_SCALE,
        -bounds.min.y * TRAIN_SCALE + TRAIN_RAIL_CONTACT_OFFSET,
        -center.z * TRAIN_SCALE,
      ] as Vec3,
      path,
      serviceDistance,
    };
  }, [scene]);

  const runtimeRef = useRef({
    distance: 0,
    pauseRemaining: 0,
    point: new THREE.Vector3(),
    ahead: new THREE.Vector3(),
    behind: new THREE.Vector3(),
    yaw: Number.NaN,
  });

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || document.hidden) return;

    const rt = runtimeRef.current;
    const realDt = Number.isFinite(delta) ? Math.max(0, delta) : 0.016;

    if (rt.pauseRemaining > 0) {
      rt.pauseRemaining = Math.max(0, rt.pauseRemaining - realDt);
      group.visible = false;
      if (rt.pauseRemaining > 0) return;
      rt.distance = 0;
      rt.yaw = Number.NaN;
    }

    // Do not catch up after a slow render frame. The train temporarily slows
    // instead of jumping forward, eliminating the heavy push/stick motion.
    const movementDt = Math.min(realDt, 1 / 30);
    rt.distance += Math.max(0.001, TRAIN_SPEED_UNITS_PER_SECOND) * movementDt;

    if (rt.distance >= setup.serviceDistance) {
      group.visible = false;
      rt.distance = 0;
      rt.pauseRemaining = Math.max(0, TRAIN_PAUSE_SECONDS);
      return;
    }

    const u = THREE.MathUtils.clamp(
      TRAIN_START_U - rt.distance / setup.path.length,
      TRAIN_END_U,
      TRAIN_START_U,
    );
    sampleTrainPath(setup.path, u, rt.point);

    const baseline = 4.5 / setup.path.length;
    sampleTrainPath(setup.path, Math.max(TRAIN_END_U, u - baseline), rt.ahead);
    sampleTrainPath(setup.path, Math.min(TRAIN_START_U, u + baseline), rt.behind);
    const targetYaw = Math.atan2(
      -(rt.ahead.z - rt.behind.z),
      rt.ahead.x - rt.behind.x,
    ) + TRAIN_YAW_OFFSET;

    group.position.copy(rt.point);
    if (!Number.isFinite(rt.yaw)) rt.yaw = targetYaw;
    else {
      const yawDelta = Math.atan2(
        Math.sin(targetYaw - rt.yaw),
        Math.cos(targetYaw - rt.yaw),
      );
      rt.yaw += yawDelta * (1 - Math.exp(-18 * movementDt));
    }
    group.rotation.y = rt.yaw;
    group.visible = true;
  });

  return (
    <group ref={groupRef} visible={false} dispose={null}>
      <group position={setup.alignment} scale={TRAIN_SCALE}>
        <primitive object={setup.model} dispose={null} />
      </group>
    </group>
  );
}

useGLTF.preload(TRAIN_MODEL_PATH);

function createNightGlowTexture() {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const distance = Math.sqrt(nx * nx + ny * ny);
      const falloff = Math.max(0, 1 - distance);
      const alpha = Math.round(255 * falloff * falloff * falloff);
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 233;
      data[index + 2] = 188;
      data[index + 3] = alpha;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const NIGHT_GLOW_TEXTURE = createNightGlowTexture();
const ROAD_LIGHT_POOL_MATERIAL = new THREE.MeshBasicMaterial({
  map: NIGHT_GLOW_TEXTURE,
  transparent: true,
  opacity: NIGHT_STREETLIGHT_POOL_OPACITY,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  side: THREE.DoubleSide,
});
const TRAFFIC_HEADLIGHT_POOL_MATERIAL = new THREE.MeshBasicMaterial({
  map: NIGHT_GLOW_TEXTURE,
  color: "#fff3cf",
  transparent: true,
  opacity: 0.13,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  side: THREE.DoubleSide,
});

const CITY_ENTRY_GLOW_MATERIAL = new THREE.MeshBasicMaterial({
  map: NIGHT_GLOW_TEXTURE,
  color: "#ffd39d",
  transparent: true,
  opacity: 0.10,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  side: THREE.DoubleSide,
});

const NIGHT_CITY_ENTRY_GLOWS = [
  -82, -58, -34, -10, 14, 38, 62, 84,
].flatMap((x) => [
  matrix([x, 0.075, -6.4], [-Math.PI / 2, 0, 0], [8.5, 4.4, 1]),
  matrix([x + 7, 0.075, 45.7], [-Math.PI / 2, 0, 0], [8.5, 4.4, 1]),
]);
const UNIPOLE_LIGHT_GLOW_MATERIAL = new THREE.SpriteMaterial({
  map: NIGHT_GLOW_TEXTURE,
  color: "#fff0c8",
  transparent: true,
  opacity: 0.68,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});

// A soft, depth-tested halo makes the tiny LED aperture legible at distance.
// Instanced camera-facing quads: one draw call, no React updates or bloom pass.
const STREETLIGHT_HALO_MATERIAL = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  uniforms: { glowColor: { value: new THREE.Color("#fff1d9") } },
  vertexShader: `
    varying vec2 vGlowUv;
    void main() {
      vGlowUv = uv;
      vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
      center.xy += position.xy * size;
      gl_Position = projectionMatrix * center;
    }
  `,
  fragmentShader: `
    uniform vec3 glowColor;
    varying vec2 vGlowUv;
    void main() {
      float radius = length(vGlowUv * 2.0 - 1.0);
      float edge = 1.0 - smoothstep(0.65, 1.0, radius);
      float glow = exp(-7.0 * radius * radius) * edge * 0.42;
      gl_FragColor = vec4(glowColor, glow);
    }
  `,
});
const STREETLIGHT_METAL_NIGHT = new THREE.MeshStandardMaterial({
  color: "#929b9f",
  roughness: 0.48,
  metalness: 0.45,
  envMapIntensity: 1.15,
});

// Realistic curbside cobra-head street lights: tapered pole, single angled
// arm reaching over the near lane, lamp head facing the road. Every part is
// instanced (shared geometry, one draw call per part) instead of one JSX
// group per pole.
const STREETLIGHT_SOUTH_Z = 10.3;
const STREETLIGHT_NORTH_Z = 34.9;
const STREETLIGHT_BRIDGE_ARM_Y = 6.8;
const STREETLIGHT_ROAD_ARM_Y = 9.1;
const STREETLIGHT_BRIDGE_CLEARANCE =
  METRO_DECK_BOTTOM_Y - 0.56 - (STREETLIGHT_BRIDGE_ARM_Y + 0.72);

function StreetlightDynamicSpot({
  position,
  target,
}: {
  position: Vec3;
  target: Vec3;
}) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  useLayoutEffect(() => {
    if (lightRef.current && targetRef.current) lightRef.current.target = targetRef.current;
  }, []);

  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        intensity={NIGHT_STREETLIGHT_SPOT_INTENSITY * Math.pow(position[1] / 7.05, 2)}
        distance={22}
        decay={2}
        angle={0.68}
        penumbra={0.75}
        color="#fff1d9"
        castShadow={false}
      />
      <object3D ref={targetRef} position={target} />
    </>
  );
}

function RealStreetlights({ isNight }: { isNight: boolean }) {
  const positions = useMemo(() => {
    const out: number[] = [];
    for (let x = -ROAD_STRAIGHT_HALF + 26; x <= ROAD_STRAIGHT_HALF - 26; x += 30) out.push(x);
    return out;
  }, []);

  const batches = useMemo(() => {
    const bases: THREE.Matrix4[] = [];
    const shafts: THREE.Matrix4[] = [];
    const accessDoors: THREE.Matrix4[] = [];
    const southArms: THREE.Matrix4[] = [];
    const northArms: THREE.Matrix4[] = [];
    const housings: THREE.Matrix4[] = [];
    const lowerTrims: THREE.Matrix4[] = [];
    const lenses: THREE.Matrix4[] = [];
    const lightPools: THREE.Matrix4[] = [];
    const halos: THREE.Matrix4[] = [];
    for (const x of positions) {
      for (const side of [1, -1]) {
        const z = side === 1 ? STREETLIGHT_SOUTH_Z : STREETLIGHT_NORTH_Z;
        const armY = side === 1 ? STREETLIGHT_BRIDGE_ARM_Y : STREETLIGHT_ROAD_ARM_Y;
        const yaw = side === 1 ? 0 : Math.PI;
        const poleBottom = 0.25;
        const poleTop = armY + 0.18;
        bases.push(matrix([x, 0.19, z], [0, 0, 0], [0.38, 0.24, 0.38]));
        shafts.push(matrix([x, (poleBottom + poleTop) / 2, z], [0, 0, 0], [1, poleTop - poleBottom, 1]));
        accessDoors.push(matrix([x, 1.05, z + side * 0.105], [0, yaw, 0], [0.15, 0.34, 0.028]));
        (side === 1 ? southArms : northArms).push(matrix([x, armY, z], [0, yaw, 0]));
        housings.push(matrix([x, armY + 0.39, z + side * 2.83], [side * 0.035, yaw, 0], [0.36, 0.13, 0.82]));
        lowerTrims.push(matrix([x, armY + 0.325, z + side * 2.87], [side * 0.035, yaw, 0], [0.32, 0.045, 0.68]));
        lenses.push(matrix([x, armY + 0.305, z + side * 2.9], [side * 0.035, yaw, 0], [0.25, 0.016, 0.56]));
        halos.push(matrix([x, armY + 0.29, z + side * 2.9], [0, 0, 0], [1.35, 1.35, 1]));
        lightPools.push(matrix(
          [x, 0.082, z + side * 6.15],
          [-Math.PI / 2, 0, 0],
          [14, 6.6, 1],
        ));
      }
    }
    return { bases, shafts, accessDoors, southArms, northArms, housings, lowerTrims, lenses, lightPools, halos };
  }, [positions]);

  const nearby = useMemo(() => {
    const anchors = [-120, -60, 0, 60, 120];
    return [...new Set(anchors.map((anchor) => positions.reduce(
      (best, x) => Math.abs(x - anchor) < Math.abs(best - anchor) ? x : best,
      positions[0],
    )))];
  }, [positions]);
  const fixtureMetal = isNight ? STREETLIGHT_METAL_NIGHT : ROAD_LIGHT_METAL;

  return (
    <group name="ClearanceCheckedStreetlights" dispose={null}>
      <InstanceBatch matrices={batches.bases} material={ROAD_CURB} receiveShadow />
      <InstanceBatch matrices={batches.shafts} geometry={STREETLIGHT_POLE_GEOMETRY} material={fixtureMetal} castShadow />
      <InstanceBatch matrices={batches.accessDoors} material={ROAD_DRAIN} />
      <InstanceBatch matrices={batches.southArms} geometry={STREETLIGHT_ARM_GEOMETRY} material={fixtureMetal} castShadow />
      <InstanceBatch matrices={batches.northArms} geometry={STREETLIGHT_ARM_GEOMETRY} material={fixtureMetal} castShadow />
      <InstanceBatch matrices={batches.housings} material={fixtureMetal} castShadow />
      <InstanceBatch matrices={batches.lowerTrims} material={DARK_METAL} />
      <InstanceBatch matrices={batches.lenses} material={isNight ? ROAD_LIGHT_HEAD_NIGHT : ROAD_LIGHT_HEAD_DAY} />
      {isNight && (
        <>
          <InstanceBatch matrices={batches.lightPools} geometry={PLANE} material={ROAD_LIGHT_POOL_MATERIAL} />
          <InstanceBatch matrices={batches.halos} geometry={PLANE} material={STREETLIGHT_HALO_MATERIAL} />
        </>
      )}
      {isNight && nearby.flatMap((x) => [
        <StreetlightDynamicSpot key={`south-${x}`}
          position={[x, STREETLIGHT_BRIDGE_ARM_Y + 0.25, STREETLIGHT_SOUTH_Z + 2.9]}
          target={[x, 0.15, STREETLIGHT_SOUTH_Z + 6.2]} />,
        <StreetlightDynamicSpot key={`north-${x}`}
          position={[x, STREETLIGHT_ROAD_ARM_Y + 0.25, STREETLIGHT_NORTH_Z - 2.9]}
          target={[x, 0.15, STREETLIGHT_NORTH_Z - 6.2]} />,
      ])}
    </group>
  );
}

function NightCityAmbientRig() {
  return (
    <group name="NightCityAmbientRig">
      <InstanceBatch
        matrices={NIGHT_CITY_ENTRY_GLOWS}
        geometry={PLANE}
        material={CITY_ENTRY_GLOW_MATERIAL}
      />

      {/* A few non-shadowing practical-light fills keep nearby stone, glass
          and sidewalks readable without flattening the whole city. */}
      {[-58, 48].map((x) => (
        <pointLight
          key={`south-city-${x}`}
          position={[x, 7.5, -5.8]}
          intensity={62}
          distance={32}
          decay={2}
          color="#ffc887"
          castShadow={false}
        />
      ))}
      {[-48, 58].map((x) => (
        <pointLight
          key={`north-city-${x}`}
          position={[x, 7.5, 45.2]}
          intensity={58}
          distance={32}
          decay={2}
          color="#ffd29a"
          castShadow={false}
        />
      ))}

      {/* Cooler low-energy fill along the elevated metro keeps concrete and
          catenary visible like a moonlit real city, without fake strip lights. */}
      {[-50, 50].map((x) => (
        <pointLight
          key={`metro-fill-${x}`}
          position={[x, 12.5, 7.4]}
          intensity={38}
          distance={38}
          decay={2}
          color="#9bb9d9"
          castShadow={false}
        />
      ))}
    </group>
  );
}

function RoadSurfaceHardware() {
  return (
    <group>
      <mesh
        geometry={ROAD_MANHOLE}
        material={ROAD_MANHOLE_MAT}
        position={[-36, 0.064, 17.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.62, 0.62, 1]}
      />
      <mesh
        geometry={ROAD_MANHOLE}
        material={ROAD_MANHOLE_MAT}
        position={[38, 0.064, 28.1]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.62, 0.62, 1]}
      />
      <mesh
        geometry={ROAD_MANHOLE}
        material={ROAD_MANHOLE_MAT}
        position={[78, 0.064, 15.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.58, 0.58, 1]}
      />
    </group>
  );
}

type RoadTrafficVehicleType = "car" | "suv" | "van" | "bus" | "auto" | "truck";

type RoadTrafficVehicle = {
  laneIndex: number;
  laneZ: number;
  direction: 1 | -1;
  // Individual free-flow speed. The lane-following solver can reduce this
  // smoothly when another vehicle is ahead, but never lets vehicles overlap.
  speed: number;
  baseX: number;
  type: RoadTrafficVehicleType;
  color: THREE.Color;
};

type RoadTrafficSpec = {
  length: number;
  width: number;
  bodyH: number;
  cabinL: number;
  cabinH: number;
  cabinOffset: number;
  wheelR: number;
  wheelW: number;
  cargoL?: number;
  cargoH?: number;
  cargoOffset?: number;
};

const ROAD_TRAFFIC_SPECS: Record<RoadTrafficVehicleType, RoadTrafficSpec> = {
  car:   { length: 4.35, width: 1.78, bodyH: 0.56, cabinL: 2.25, cabinH: 0.78, cabinOffset: 0.10, wheelR: 0.30, wheelW: 0.17 },
  suv:   { length: 4.72, width: 1.9,  bodyH: 0.66, cabinL: 2.48, cabinH: 0.92, cabinOffset: 0.02, wheelR: 0.34, wheelW: 0.19 },
  van:   { length: 4.92, width: 1.9,  bodyH: 0.64, cabinL: 2.92, cabinH: 1.22, cabinOffset: -0.05, wheelR: 0.33, wheelW: 0.19 },
  bus:   { length: 10.2, width: 2.36, bodyH: 0.72, cabinL: 9.25, cabinH: 2.08, cabinOffset: 0, wheelR: 0.44, wheelW: 0.25 },
  auto:  { length: 2.82, width: 1.34, bodyH: 0.48, cabinL: 1.68, cabinH: 1.08, cabinOffset: -0.12, wheelR: 0.25, wheelW: 0.13 },
  truck: { length: 7.45, width: 2.18, bodyH: 0.66, cabinL: 2.12, cabinH: 1.55, cabinOffset: 2.28, wheelR: 0.41, wheelW: 0.24, cargoL: 4.55, cargoH: 1.72, cargoOffset: -1.12 },
};

const ROAD_TRAFFIC_LANES = [
  { z: 12.6, direction: 1 as const, speed: 21.0 },
  { z: 15.2, direction: 1 as const, speed: 19.0 },
  { z: 17.8, direction: 1 as const, speed: 17.4 },
  { z: 26.2, direction: -1 as const, speed: 17.6 },
  { z: 28.8, direction: -1 as const, speed: 19.2 },
  { z: 31.4, direction: -1 as const, speed: 21.2 },
] as const;

// Different vehicle classes now have genuinely different free-flow speeds.
// Faster cars/SUVs naturally catch slower buses/trucks, then the lane-following
// solver slows them instead of allowing geometry to pass through geometry.
const ROAD_TRAFFIC_TYPE_SPEED_FACTOR: Record<RoadTrafficVehicleType, number> = {
  car: 1.08,
  suv: 1.04,
  van: 0.96,
  bus: 0.80,
  auto: 0.76,
  truck: 0.86,
};

const ROAD_TRAFFIC_COLORS = [
  "#f1f2ef", "#1d252b", "#9f2d32", "#315f80", "#6f797a",
  "#c2a34e", "#386248", "#c8cccf", "#5b4c42",
] as const;

function createRoadTrafficLayout(): RoadTrafficVehicle[] {
  const random = seeded(22097);
  const vehicles: RoadTrafficVehicle[] = [];
  const minX = ROAD_TRAFFIC_ROUTE_MIN_X;
  const maxX = ROAD_TRAFFIC_ROUTE_MAX_X;
  const span = maxX - minX;

  ROAD_TRAFFIC_LANES.forEach((lane, laneIndex) => {
    // The two outer lanes are intentionally Roadshow-only. This removes the
    // cross-system collision that previously let a small car enter a large
    // Roadshow body while both components animated independently.
    if (ROADSHOW_RESERVED_LANES.has(laneIndex)) return;

    for (let i = 0; i < ROAD_TRAFFIC_VEHICLES_PER_LANE; i += 1) {
      const r = random();
      let type: RoadTrafficVehicleType;
      if (laneIndex === 1 || laneIndex === 4) {
        type = r < 0.11 ? "bus" : r < 0.25 ? "van" : r < 0.39 ? "auto" : r < 0.62 ? "suv" : "car";
      } else {
        type = r < 0.12 ? "truck" : r < 0.25 ? "auto" : r < 0.48 ? "suv" : "car";
      }

      const slot = span / ROAD_TRAFFIC_VEHICLES_PER_LANE;
      const jitter = (random() - 0.5) * slot * 0.16;
      const baseX = minX + ((i + 0.5) / ROAD_TRAFFIC_VEHICLES_PER_LANE) * span + jitter;
      const color = type === "auto"
        ? new THREE.Color(random() > 0.45 ? "#e5bd32" : "#2f6b45")
        : type === "bus"
          ? new THREE.Color(random() > 0.5 ? "#3a70a1" : "#b84038")
          : new THREE.Color(ROAD_TRAFFIC_COLORS[Math.floor(random() * ROAD_TRAFFIC_COLORS.length)]);

      vehicles.push({
        laneIndex,
        laneZ: lane.z + (random() - 0.5) * 0.07,
        direction: lane.direction,
        speed: lane.speed * ROAD_TRAFFIC_SPEED_MULTIPLIER *
          ROAD_TRAFFIC_TYPE_SPEED_FACTOR[type] * (0.95 + random() * 0.1),
        baseX,
        type,
        color,
      });
    }
  });
  return vehicles;
}

function moduloPositive(value: number, span: number) {
  return ((value % span) + span) % span;
}

function setTrafficMatrix(
  mesh: THREE.InstancedMesh,
  dummy: THREE.Object3D,
  index: number,
  x: number,
  y: number,
  z: number,
  yaw: number,
  sx: number,
  sy: number,
  sz: number,
  rotX = 0,
  rotZ = 0,
) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(rotX, yaw, rotZ);
  dummy.scale.set(
    Math.max(0.001, sx),
    Math.max(0.001, sy),
    Math.max(0.001, sz),
  );
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function RoadTrafficSystem({ isNight }: { isNight: boolean }) {
  const vehicles = useMemo(createRoadTrafficLayout, []);
  const lowerRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const cargoRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const headlightRef = useRef<THREE.InstancedMesh>(null);
  const taillightRef = useRef<THREE.InstancedMesh>(null);

  // Stable lane runtime. Positions use a direction-independent travel
  // coordinate (0..span), so every lane can share the same car-following math.
  const runtime = useMemo(() => ({
    dummy: new THREE.Object3D(),
    rim: null as THREE.InstancedMesh | null,
    hood: null as THREE.InstancedMesh | null,
    roof: null as THREE.InstancedMesh | null,
    sideWindows: null as THREE.InstancedMesh | null,
    headlightPools: null as THREE.InstancedMesh | null,
    positions: new Float32Array(vehicles.length),
    nextPositions: new Float32Array(vehicles.length),
    speeds: new Float32Array(vehicles.length),
    nextSpeeds: new Float32Array(vehicles.length),
    wheelAngles: new Float32Array(vehicles.length),
    leaders: new Int16Array(vehicles.length).fill(-1),
  }), [vehicles]);

  const spanMin = ROAD_TRAFFIC_ROUTE_MIN_X;
  const spanMax = ROAD_TRAFFIC_ROUTE_MAX_X;
  const span = spanMax - spanMin;

  useLayoutEffect(() => {
    const moving = [
      lowerRef.current,
      cabinRef.current,
      glassRef.current,
      cargoRef.current,
      wheelRef.current,
      runtime.rim,
      runtime.hood,
      runtime.roof,
      runtime.sideWindows,
      runtime.headlightPools,
      headlightRef.current,
      taillightRef.current,
    ];
    for (const mesh of moving) {
      mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    // Initialize lane positions and fixed leader relationships once. Vehicles
    // never overtake in one lane; faster vehicles smoothly match the vehicle
    // ahead when the safe headway closes.
    const laneGroups = new Map<number, number[]>();
    for (let index = 0; index < vehicles.length; index += 1) {
      const vehicle = vehicles[index];
      const raw = vehicle.direction > 0
        ? vehicle.baseX - spanMin
        : spanMax - vehicle.baseX;
      runtime.positions[index] = moduloPositive(raw, span);
      runtime.nextPositions[index] = runtime.positions[index];
      runtime.speeds[index] = vehicle.speed;
      runtime.nextSpeeds[index] = vehicle.speed;
      const group = laneGroups.get(vehicle.laneIndex) ?? [];
      group.push(index);
      laneGroups.set(vehicle.laneIndex, group);
    }
    for (const indices of laneGroups.values()) {
      indices.sort((a, b) => runtime.positions[a] - runtime.positions[b]);
      for (let order = 0; order < indices.length; order += 1) {
        runtime.leaders[indices[order]] = indices[(order + 1) % indices.length];
      }
    }

    for (let index = 0; index < vehicles.length; index += 1) {
      const vehicle = vehicles[index];
      lowerRef.current?.setColorAt(index, vehicle.color);
      cabinRef.current?.setColorAt(index, vehicle.color);
      runtime.hood?.setColorAt(index, vehicle.color);
      runtime.roof?.setColorAt(index, vehicle.color);
    }

    for (const mesh of [lowerRef.current, cabinRef.current, runtime.hood, runtime.roof]) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [runtime, vehicles]);

  useFrame((_, delta) => {
    const lower = lowerRef.current;
    const cabin = cabinRef.current;
    const windshield = glassRef.current;
    const cargo = cargoRef.current;
    const wheels = wheelRef.current;
    const rims = runtime.rim;
    const hoods = runtime.hood;
    const roofs = runtime.roof;
    const sideWindows = runtime.sideWindows;
    const headlightPools = runtime.headlightPools;
    const headlights = headlightRef.current;
    const taillights = taillightRef.current;

    if (
      !lower || !cabin || !windshield || !cargo || !wheels || !rims ||
      !hoods || !roofs || !sideWindows || !headlights || !taillights
    ) return;

    const dt = Number.isFinite(delta)
      ? Math.min(Math.max(delta, 0), MOTION_MAX_DELTA)
      : 1 / 60;
    const dummy = runtime.dummy;

    // Pass 1: solve speed and distance with a hard non-overlap limit. The
    // leader positions are sampled from the previous frame, making this stable
    // even after a dropped render frame.
    for (let index = 0; index < vehicles.length; index += 1) {
      const vehicle = vehicles[index];
      const spec = ROAD_TRAFFIC_SPECS[vehicle.type];
      const leaderIndex = runtime.leaders[index];
      let targetSpeed = vehicle.speed;
      let maxAdvance = targetSpeed * dt;

      if (leaderIndex >= 0 && leaderIndex !== index) {
        const leader = vehicles[leaderIndex];
        const leaderSpec = ROAD_TRAFFIC_SPECS[leader.type];
        const centreGap = moduloPositive(
          runtime.positions[leaderIndex] - runtime.positions[index],
          span,
        );
        const bumperGap = centreGap - (spec.length + leaderSpec.length) * 0.5;
        const safeGap = ROAD_TRAFFIC_MIN_BUMPER_GAP +
          runtime.speeds[index] * ROAD_TRAFFIC_HEADWAY_SECONDS;

        if (bumperGap < safeGap * 1.8) {
          const room = THREE.MathUtils.clamp(
            (bumperGap - ROAD_TRAFFIC_MIN_BUMPER_GAP) /
              Math.max(0.01, safeGap * 1.8 - ROAD_TRAFFIC_MIN_BUMPER_GAP),
            0,
            1,
          );
          targetSpeed = Math.min(
            targetSpeed,
            THREE.MathUtils.lerp(runtime.speeds[leaderIndex] * 0.92, targetSpeed, room),
          );
        }

        // Absolute collision guard: even if a frame stalls, the follower can
        // never advance into the physical length of the vehicle ahead.
        maxAdvance = Math.max(
          0,
          bumperGap - ROAD_TRAFFIC_MIN_BUMPER_GAP,
        );
      }

      const speedAlpha = 1 - Math.exp(-3.8 * dt);
      const solvedSpeed = THREE.MathUtils.lerp(
        runtime.speeds[index],
        Math.max(0, targetSpeed),
        speedAlpha,
      );
      const advance = Math.min(solvedSpeed * dt, maxAdvance);
      runtime.nextSpeeds[index] = solvedSpeed;
      runtime.nextPositions[index] = moduloPositive(runtime.positions[index] + advance, span);
      runtime.wheelAngles[index] += advance / Math.max(spec.wheelR, 0.1);
    }

    runtime.positions.set(runtime.nextPositions);
    runtime.speeds.set(runtime.nextSpeeds);

    let wheelIndex = 0;

    // Pass 2: render the already-solved collision-free vehicle transforms.
    for (let index = 0; index < vehicles.length; index += 1) {
      const vehicle = vehicles[index];
      const spec = ROAD_TRAFFIC_SPECS[vehicle.type];
      const travel = runtime.positions[index];
      const x = vehicle.direction > 0
        ? spanMin + travel
        : spanMax - travel;
      const yaw = vehicle.direction > 0 ? 0 : Math.PI;
      const roadY = 0.07;
      const wheelY = roadY + spec.wheelR;
      const bodyY = roadY + spec.wheelR + spec.bodyH * 0.5;
      const cabinY = roadY + spec.wheelR + spec.bodyH + spec.cabinH * 0.5 - 0.06;
      const cabinWorldX = x + vehicle.direction * spec.cabinOffset;

      setTrafficMatrix(lower, dummy, index, x, bodyY, vehicle.laneZ, yaw,
        spec.length, spec.bodyH, spec.width);
      setTrafficMatrix(cabin, dummy, index, cabinWorldX, cabinY, vehicle.laneZ, yaw,
        spec.cabinL, spec.cabinH, spec.width * 0.9);

      const cabinFrontX = cabinWorldX + vehicle.direction * spec.cabinL * 0.39;
      setTrafficMatrix(
        windshield,
        dummy,
        index,
        cabinFrontX,
        cabinY + spec.cabinH * 0.04,
        vehicle.laneZ,
        yaw,
        0.055,
        spec.cabinH * 0.53,
        spec.width * 0.7,
        0,
        0.16,
      );

      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const side = sideIndex === 0 ? -1 : 1;
        setTrafficMatrix(
          sideWindows,
          dummy,
          index * 2 + sideIndex,
          cabinWorldX - vehicle.direction * spec.cabinL * 0.05,
          cabinY + spec.cabinH * 0.04,
          vehicle.laneZ + side * spec.width * 0.455,
          yaw,
          spec.cabinL * 0.52,
          spec.cabinH * 0.4,
          0.035,
        );
      }

      const hoodLength = vehicle.type === "car" ? 0.9
        : vehicle.type === "suv" ? 0.95
          : vehicle.type === "auto" ? 0.48
            : vehicle.type === "truck" ? 0.68
              : vehicle.type === "van" ? 0.42
                : 0.28;
      const hoodX = x + vehicle.direction * (spec.length * 0.5 - hoodLength * 0.5 - 0.07);
      setTrafficMatrix(
        hoods,
        dummy,
        index,
        hoodX,
        roadY + spec.wheelR + spec.bodyH * 0.91,
        vehicle.laneZ,
        yaw,
        hoodLength,
        Math.max(0.08, spec.bodyH * 0.18),
        spec.width * 0.86,
      );

      setTrafficMatrix(
        roofs,
        dummy,
        index,
        cabinWorldX - vehicle.direction * spec.cabinL * 0.08,
        cabinY + spec.cabinH * 0.49,
        vehicle.laneZ,
        yaw,
        spec.cabinL * 0.74,
        0.075,
        spec.width * 0.82,
      );

      if (spec.cargoL && spec.cargoH && spec.cargoOffset !== undefined) {
        setTrafficMatrix(
          cargo,
          dummy,
          index,
          x + vehicle.direction * spec.cargoOffset,
          roadY + spec.wheelR + spec.bodyH + spec.cargoH * 0.5 - 0.02,
          vehicle.laneZ,
          yaw,
          spec.cargoL,
          spec.cargoH,
          spec.width * 0.96,
        );
      } else {
        setTrafficMatrix(cargo, dummy, index, x, -10, vehicle.laneZ, yaw, 0.001, 0.001, 0.001);
      }

      const axle = spec.length * (
        vehicle.type === "bus" ? 0.39 : vehicle.type === "truck" ? 0.36 : 0.34
      );
      const wheelZ = spec.width * 0.5 - spec.wheelW * 0.5 + 0.02;
      const spin = runtime.wheelAngles[index] * vehicle.direction;

      for (let axleIndex = 0; axleIndex < 2; axleIndex += 1) {
        const localX = axleIndex === 0 ? -axle : axle;
        for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
          const localZ = sideIndex === 0 ? -wheelZ : wheelZ;
          const wheelWorldX = x + vehicle.direction * localX;
          const wheelWorldZ = vehicle.laneZ + localZ;
          const idx = wheelIndex++;
          setTrafficMatrix(
            wheels, dummy, idx, wheelWorldX, wheelY, wheelWorldZ, yaw,
            spec.wheelR, spec.wheelR, spec.wheelW / 0.56, 0, spin,
          );
          setTrafficMatrix(
            rims, dummy, idx, wheelWorldX, wheelY, wheelWorldZ, yaw,
            spec.wheelR * 0.53, spec.wheelR * 0.53, spec.wheelW * 0.82, 0, spin,
          );
        }
      }

      const frontX = x + vehicle.direction * (spec.length / 2 + 0.045);
      const rearX = x - vehicle.direction * (spec.length / 2 + 0.045);
      const lampY = roadY + spec.wheelR + spec.bodyH * 0.72;

      // One soft road projection per moving vehicle. It is only mounted in
      // night mode, adds one instanced draw call, and avoids dozens of dynamic
      // real lights while still making traffic read like a live night street.
      if (headlightPools) {
        setTrafficMatrix(
          headlightPools,
          dummy,
          index,
          frontX + vehicle.direction * 3.9,
          0.071,
          vehicle.laneZ,
          0,
          8.2,
          2.8,
          1,
          -Math.PI / 2,
        );
      }

      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const side = sideIndex === 0 ? -1 : 1;
        const lampZ = vehicle.laneZ + side * spec.width * 0.31;
        setTrafficMatrix(
          headlights, dummy, index * 2 + sideIndex,
          frontX, lampY, lampZ, yaw, 0.055, 0.14, 0.17,
        );
        setTrafficMatrix(
          taillights, dummy, index * 2 + sideIndex,
          rearX, lampY, lampZ, yaw, 0.055, 0.13, 0.16,
        );
      }
    }

    lower.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
    windshield.instanceMatrix.needsUpdate = true;
    cargo.instanceMatrix.needsUpdate = true;
    wheels.instanceMatrix.needsUpdate = true;
    rims.instanceMatrix.needsUpdate = true;
    hoods.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    sideWindows.instanceMatrix.needsUpdate = true;
    headlights.instanceMatrix.needsUpdate = true;
    taillights.instanceMatrix.needsUpdate = true;
    if (headlightPools) headlightPools.instanceMatrix.needsUpdate = true;
  });

  const count = vehicles.length;
  const wheelCount = count * 4;
  const doubleCount = count * 2;

  return (
    <group name="LiveRoadTraffic" dispose={null}>
      <instancedMesh ref={lowerRef} args={[undefined, undefined, count]}
        geometry={TRAFFIC_LOWER_BODY_GEOMETRY} material={TRAFFIC_BODY_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={cabinRef} args={[undefined, undefined, count]}
        geometry={TRAFFIC_CABIN_GEOMETRY} material={TRAFFIC_BODY_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={glassRef} args={[undefined, undefined, count]}
        geometry={BOX} material={TRAFFIC_GLASS_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={cargoRef} args={[undefined, undefined, count]}
        geometry={BOX} material={TRAFFIC_CARGO_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={(mesh) => { runtime.hood = mesh; }} args={[undefined, undefined, count]}
        geometry={BOX} material={TRAFFIC_BODY_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={(mesh) => { runtime.roof = mesh; }} args={[undefined, undefined, count]}
        geometry={BOX} material={TRAFFIC_BODY_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={(mesh) => { runtime.sideWindows = mesh; }} args={[undefined, undefined, doubleCount]}
        geometry={BOX} material={TRAFFIC_GLASS_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={wheelRef} args={[undefined, undefined, wheelCount]}
        geometry={TRAFFIC_TIRE_GEOMETRY} material={TRAFFIC_TIRE_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={(mesh) => { runtime.rim = mesh; }} args={[undefined, undefined, wheelCount]}
        geometry={TRAFFIC_RIM_GEOMETRY} material={TRAFFIC_RIM_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={headlightRef} args={[undefined, undefined, doubleCount]}
        geometry={BOX} material={isNight ? TRAFFIC_HEADLIGHT_NIGHT_MATERIAL : TRAFFIC_HEADLIGHT_MATERIAL} frustumCulled={false} />
      <instancedMesh ref={taillightRef} args={[undefined, undefined, doubleCount]}
        geometry={BOX} material={isNight ? TRAFFIC_TAILLIGHT_NIGHT_MATERIAL : TRAFFIC_TAILLIGHT_MATERIAL} frustumCulled={false} />
      {isNight && (
        <instancedMesh
          ref={(mesh) => {
            runtime.headlightPools = mesh;
            mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          }}
          args={[undefined, undefined, count]}
          geometry={PLANE}
          material={TRAFFIC_HEADLIGHT_POOL_MATERIAL}
          frustumCulled={false}
        />
      )}
    </group>
  );
}

/* ========================================================================== */
/* ADINN-STYLE 3D LED ROADSHOW VEHICLES                                       */
/* ========================================================================== */

// Visual direction follows Adinn's current Roadshow fleet presentation:
// compact/medium cab-over commercial vehicles with a purpose-built black media
// body, large side LED cabinet, roof/fairing branding and proper road hardware.
// We intentionally model several LCV proportions instead of cloning one truck.
type RoadshowVariant = "ace" | "tata407" | "eicher" | "largeLed";
type RoadshowScreenMode = "led" | "adinn" | "hybrid";

type RoadshowVariantSpec = {
  label: string;
  width: number;
  bodyLength: number;
  bodyHeight: number;
  bodyCenterX: number;
  cabLength: number;
  cabHeight: number;
  cabCenterX: number;
  screenWidth: number;
  screenHeight: number;
  wheelRadius: number;
  wheelWidth: number;
  axleX: readonly [number, number];
  fairingHeight: number;
  rearScreen: boolean;
};

const ROADSHOW_VARIANTS: Record<RoadshowVariant, RoadshowVariantSpec> = {
  // Compact Tata-Ace-like LED van: short cab, tight wheelbase, 6x4/7x5-style
  // media cabinet proportions.
  ace: {
    label: "Compact LED Van",
    width: 1.82,
    bodyLength: 3.72,
    bodyHeight: 2.32,
    bodyCenterX: -0.78,
    cabLength: 2.02,
    cabHeight: 1.58,
    cabCenterX: 2.03,
    screenWidth: 3.38,
    screenHeight: 1.86,
    wheelRadius: 0.33,
    wheelWidth: 0.18,
    axleX: [2.08, -1.54],
    fairingHeight: 0.62,
    rearScreen: true,
  },
  // Tata-407-like medium LCV with a longer box and taller LED face.
  tata407: {
    label: "Medium LED Truck",
    width: 2.02,
    bodyLength: 4.42,
    bodyHeight: 2.5,
    bodyCenterX: -0.88,
    cabLength: 2.22,
    cabHeight: 1.72,
    cabCenterX: 2.38,
    screenWidth: 4.05,
    screenHeight: 2.05,
    wheelRadius: 0.38,
    wheelWidth: 0.21,
    axleX: [2.47, -1.96],
    fairingHeight: 0.72,
    rearScreen: false,
  },
  // Eicher-like LCV: longer media body and slightly wider road stance.
  eicher: {
    label: "Large LED LCV",
    width: 2.16,
    bodyLength: 4.96,
    bodyHeight: 2.66,
    bodyCenterX: -1.02,
    cabLength: 2.38,
    cabHeight: 1.82,
    cabCenterX: 2.58,
    screenWidth: 4.56,
    screenHeight: 2.2,
    wheelRadius: 0.4,
    wheelWidth: 0.22,
    axleX: [2.68, -2.18],
    fairingHeight: 0.78,
    rearScreen: true,
  },
  // Hero-size black LED vehicle inspired by Adinn's current Roadshow hero.
  largeLed: {
    label: "Premium LED Roadshow",
    width: 2.28,
    bodyLength: 5.45,
    bodyHeight: 2.8,
    bodyCenterX: -1.14,
    cabLength: 2.5,
    cabHeight: 1.94,
    cabCenterX: 2.78,
    screenWidth: 5.0,
    screenHeight: 2.3,
    wheelRadius: 0.43,
    wheelWidth: 0.24,
    axleX: [2.9, -2.4],
    fairingHeight: 0.84,
    rearScreen: true,
  },
};

const ROADSHOW_VARIANT_ORDER: readonly RoadshowVariant[] = [
  "largeLed",
  "ace",
  "eicher",
  "tata407",
];


/* -------------------------------------------------------------------------- */
/* ROADSHOW VEHICLE SHARED HARD-SURFACE GEOMETRY                              */
/* -------------------------------------------------------------------------- */

// The old vehicle used stacked RoundedBox primitives for the complete cab.
// These shared extruded shells give the truck a true cab-over silhouette:
// a low bumper, curved nose, raked windscreen, roof break and rear cab wall.
// One geometry is created per vehicle class and reused by every moving truck.
function createRoadshowCabGeometry(spec: RoadshowVariantSpec) {
  const length = spec.cabLength;
  const height = spec.cabHeight;
  const width = spec.width * 0.94;
  const rear = -length / 2;
  const front = length / 2;

  const shape = new THREE.Shape();
  shape.moveTo(rear, height * 0.08);
  shape.lineTo(front - length * 0.05, height * 0.08);
  shape.quadraticCurveTo(front + length * 0.015, height * 0.12, front, height * 0.24);
  shape.lineTo(front - length * 0.035, height * 0.48);
  shape.lineTo(front - length * 0.25, height * 0.84);
  shape.quadraticCurveTo(
    front - length * 0.31,
    height * 0.96,
    front - length * 0.43,
    height,
  );
  shape.lineTo(rear + length * 0.13, height * 0.96);
  shape.quadraticCurveTo(rear, height * 0.9, rear, height * 0.72);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    steps: 1,
    curveSegments: 5,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -width / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createRoadshowFairingGeometry(spec: RoadshowVariantSpec) {
  const length = spec.cabLength * 0.84;
  const height = spec.fairingHeight;
  const width = spec.width * 0.88;
  const rear = -length / 2;
  const front = length / 2;

  const shape = new THREE.Shape();
  shape.moveTo(rear, 0);
  shape.lineTo(front, 0);
  shape.lineTo(front - length * 0.05, height * 0.22);
  shape.lineTo(rear + length * 0.18, height);
  shape.lineTo(rear, height * 0.92);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    steps: 1,
    curveSegments: 3,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -width / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const ROADSHOW_CAB_GEOMETRIES: Record<RoadshowVariant, THREE.ExtrudeGeometry> = {
  ace: createRoadshowCabGeometry(ROADSHOW_VARIANTS.ace),
  tata407: createRoadshowCabGeometry(ROADSHOW_VARIANTS.tata407),
  eicher: createRoadshowCabGeometry(ROADSHOW_VARIANTS.eicher),
  largeLed: createRoadshowCabGeometry(ROADSHOW_VARIANTS.largeLed),
};

const ROADSHOW_FAIRING_GEOMETRIES: Record<RoadshowVariant, THREE.ExtrudeGeometry> = {
  ace: createRoadshowFairingGeometry(ROADSHOW_VARIANTS.ace),
  tata407: createRoadshowFairingGeometry(ROADSHOW_VARIANTS.tata407),
  eicher: createRoadshowFairingGeometry(ROADSHOW_VARIANTS.eicher),
  largeLed: createRoadshowFairingGeometry(ROADSHOW_VARIANTS.largeLed),
};

const ROADSHOW_SIDE_WINDOW_GEOMETRY = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.42);
  shape.lineTo(0.43, -0.42);
  shape.lineTo(0.5, 0.08);
  shape.lineTo(0.26, 0.5);
  shape.lineTo(-0.5, 0.43);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 4);
  geometry.computeBoundingSphere();
  return geometry;
})();

const ROADSHOW_WHEEL_ARCH_GEOMETRY = new THREE.TorusGeometry(
  1,
  0.075,
  7,
  22,
  Math.PI,
);

const ROADSHOW_STEERING_WHEEL_GEOMETRY = new THREE.TorusGeometry(0.16, 0.022, 6, 16);

type RoadshowTrafficVehicle = {
  laneZ: number;
  direction: 1 | -1;
  speed: number;
  firstDelay: number;
  repeatDelay: number;
  initialProgress: number;
  screenMode: RoadshowScreenMode;
  variant: RoadshowVariant;
};

function createRoadshowTrafficVehicles(): readonly RoadshowTrafficVehicle[] {
  const random = seeded(44831);
  const out: RoadshowTrafficVehicle[] = [];

  // The two outer lanes are Roadshow-only. Two trucks may share lane 0, but
  // they use the SAME lane speed and a fixed large phase separation, so they
  // can never catch or enter each other. Lane 5 travels the opposite direction
  // at a different speed, which keeps the overall movement visually varied.
  const preferredLaneOrder = [0, 5, 0, 5] as const;
  const laneSpeedFactor: Record<number, number> = {
    0: 0.78,
    5: 0.88,
  };
  const repeatRange = ROADSHOW_REPEAT_DELAY_MAX_SECONDS - ROADSHOW_REPEAT_DELAY_MIN_SECONDS;
  const laneRepeatDelay: Record<number, number> = {
    0: ROADSHOW_REPEAT_DELAY_MIN_SECONDS + repeatRange * 0.5,
    5: ROADSHOW_REPEAT_DELAY_MIN_SECONDS + repeatRange * 0.78,
  };
  const laneSeenCount = new Map<number, number>();

  for (let i = 0; i < ROADSHOW_VEHICLE_COUNT; i += 1) {
    const laneIndex = preferredLaneOrder[i % preferredLaneOrder.length];
    const lane = ROAD_TRAFFIC_LANES[laneIndex];
    const seen = laneSeenCount.get(laneIndex) ?? 0;
    laneSeenCount.set(laneIndex, seen + 1);

    const modeRoll = random();
    const screenMode: RoadshowScreenMode = modeRoll < 0.46
      ? "led"
      : modeRoll < 0.78
        ? "adinn"
        : "hybrid";

    // Lane 0 trucks remain over half a route apart. Their equal lane speed
    // preserves that gap forever; lane 5 gets its own independent timing.
    const initialProgress = laneIndex === 0
      ? (seen === 0 ? 0.16 : 0.68)
      : 0.41;

    out.push({
      laneZ: lane.z + (random() - 0.5) * 0.035,
      direction: lane.direction,
      speed: lane.speed * ROADSHOW_TRAFFIC_SPEED_MULTIPLIER * laneSpeedFactor[laneIndex],
      firstDelay: laneIndex === 0 ? 0 : 0.6 + random() * ROADSHOW_FIRST_ARRIVAL_MAX_SECONDS * 0.45,
      repeatDelay: laneRepeatDelay[laneIndex],
      initialProgress,
      screenMode,
      variant: ROADSHOW_VARIANT_ORDER[i % ROADSHOW_VARIANT_ORDER.length],
    });
  }

  return out;
}

const ROADSHOW_TRAFFIC_VEHICLES = createRoadshowTrafficVehicles();
const ROADSHOW_WHEELS_PER_VEHICLE = 4;

function RoadshowWheel({
  position,
  radius,
  width,
  wheelIndex,
  wheelRefs,
}: {
  position: Vec3;
  radius: number;
  width: number;
  wheelIndex: number;
  wheelRefs: { current: Array<THREE.Group | null> };
}) {
  return (
    <group
      ref={(group) => {
        wheelRefs.current[wheelIndex] = group;
      }}
      position={position}
    >
      {/* Proper torus tyre + recessed metallic wheel instead of a flat disc. */}
      <mesh
        geometry={TRAFFIC_TIRE_GEOMETRY}
        material={TRAFFIC_TIRE_MATERIAL}
        scale={[radius, radius, width / 0.56]}
      />
      <mesh
        geometry={TRAFFIC_RIM_GEOMETRY}
        material={TRAFFIC_RIM_MATERIAL}
        scale={[radius * 0.54, radius * 0.54, width * 0.82]}
      />
      <mesh
        geometry={TRAFFIC_HUB_GEOMETRY}
        material={TRAFFIC_HUB_MATERIAL}
        scale={[radius * 0.18, radius * 0.18, width * 0.96]}
      />
    </group>
  );
}

function RoadshowSideScreen({
  side,
  spec,
  mode,
  brandTexture,
}: {
  side: 1 | -1;
  spec: RoadshowVariantSpec;
  mode: RoadshowScreenMode;
  brandTexture: THREE.Texture | null;
}) {
  const showBrand = mode === "adinn" || (mode === "hybrid" && side > 0);
  const bodyBaseY = 0.78;
  const bodyCenterY = bodyBaseY + spec.bodyHeight / 2;
  const screenZ = side * (spec.width / 2 + 0.018);

  return (
    <group
      position={[spec.bodyCenterX, bodyCenterY + 0.03, screenZ]}
      rotation={[0, side < 0 ? Math.PI : 0, 0]}
    >
      {/* Deep black cabinet bezel, like a real outdoor LED module enclosure. */}
      <RoundedBox
        args={[spec.screenWidth + 0.2, spec.screenHeight + 0.2, 0.085]}
        radius={0.035}
        smoothness={2}
        material={ROADSHOW_SCREEN_FRAME_MATERIAL}
      />

      {showBrand ? (
        <mesh geometry={PLANE} position={[0, 0, 0.048]} scale={[spec.screenWidth, spec.screenHeight, 1]}>
          <meshStandardMaterial
            map={brandTexture ?? undefined}
            emissiveMap={brandTexture ?? undefined}
            emissive={brandTexture ? "#ffffff" : "#111111"}
            emissiveIntensity={brandTexture ? 0.38 : 0.08}
            color={brandTexture ? "#ffffff" : "#ededeb"}
            roughness={0.28}
            metalness={0.02}
            toneMapped={false}
          />
        </mesh>
      ) : (
        <mesh
          geometry={PLANE}
          material={ROADSHOW_LED_SCREEN_MATERIAL}
          position={[0, 0, 0.048]}
          scale={[spec.screenWidth, spec.screenHeight, 1]}
        />
      )}

      {/* Cabinet edge rails and lower service/vent strip. */}
      <mesh geometry={BOX} material={ROADSHOW_TRIM_MATERIAL}
        position={[0, spec.screenHeight / 2 + 0.11, -0.015]}
        scale={[spec.screenWidth + 0.24, 0.075, 0.08]} />
      <mesh geometry={BOX} material={ROADSHOW_TRIM_MATERIAL}
        position={[0, -spec.screenHeight / 2 - 0.11, -0.015]}
        scale={[spec.screenWidth + 0.24, 0.09, 0.08]} />
    </group>
  );
}

function RoadshowRearScreen({
  spec,
  brandTexture,
}: {
  spec: RoadshowVariantSpec;
  brandTexture: THREE.Texture | null;
}) {
  if (!spec.rearScreen) return null;

  const bodyBaseY = 0.78;
  const bodyCenterY = bodyBaseY + spec.bodyHeight / 2;
  const rearX = spec.bodyCenterX - spec.bodyLength / 2 - 0.025;
  const rearW = Math.max(1.2, spec.width - 0.34);
  const rearH = Math.max(1.2, spec.bodyHeight - 0.54);

  return (
    <group position={[rearX, bodyCenterY + 0.02, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <RoundedBox
        args={[rearW + 0.14, rearH + 0.14, 0.08]}
        radius={0.03}
        smoothness={2}
        material={ROADSHOW_SCREEN_FRAME_MATERIAL}
      />
      <mesh geometry={PLANE} position={[0, 0, 0.048]} scale={[rearW, rearH, 1]}>
        <meshStandardMaterial
          map={brandTexture ?? undefined}
          emissiveMap={brandTexture ?? undefined}
          emissive={brandTexture ? "#ffffff" : "#151515"}
          emissiveIntensity={brandTexture ? 0.25 : 0.06}
          color={brandTexture ? "#ffffff" : "#e8e8e5"}
          roughness={0.32}
          metalness={0.02}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function RoadshowVehicle3D({
  index,
  vehicle,
  brandTexture,
  groupRefs,
  wheelRefs,
  isNight,
}: {
  isNight: boolean;
  index: number;
  vehicle: RoadshowTrafficVehicle;
  brandTexture: THREE.Texture | null;
  groupRefs: { current: Array<THREE.Group | null> };
  wheelRefs: { current: Array<THREE.Group | null> };
}) {
  const spec = ROADSHOW_VARIANTS[vehicle.variant];
  const wheelZ = spec.width / 2 - spec.wheelWidth * 0.42;
  const wheelY = spec.wheelRadius + 0.07;
  const bodyBaseY = 0.78;
  const bodyCenterY = bodyBaseY + spec.bodyHeight / 2;
  const cabBaseY = 0.43;
  const cabFrontX = spec.cabCenterX + spec.cabLength / 2;
  const cabRearX = spec.cabCenterX - spec.cabLength / 2;
  const cabTopY = cabBaseY + spec.cabHeight;
  const wheelBase = index * ROADSHOW_WHEELS_PER_VEHICLE;
  const mediaRearX = spec.bodyCenterX - spec.bodyLength / 2;
  const mediaFrontX = spec.bodyCenterX + spec.bodyLength / 2;
  const frontWheelX = spec.axleX[0];
  const rearWheelX = spec.axleX[1];

  return (
    <group
      ref={(group) => {
        groupRefs.current[index] = group;
        if (group && !group.userData.staticMeshesPrepared) {
          group.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.updateMatrix();
            mesh.matrixAutoUpdate = false;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
          });
          group.userData.staticMeshesPrepared = true;
        }
      }}
      name={`Adinn ${spec.label} ${index + 1}`}
      visible={false}
    >
      {/* Real ladder-frame chassis. The rails remain visible between the cab,
          wheels and media enclosure instead of reading as one black block. */}
      {[-0.54, 0.54].map((z) => (
        <mesh
          key={`chassis-rail-${z}`}
          geometry={BOX}
          material={ROADSHOW_TRIM_MATERIAL}
          position={[-0.05, 0.47, z]}
          scale={[spec.bodyLength + spec.cabLength * 0.92, 0.12, 0.11]}
        />
      ))}
      {[-2.0, -0.7, 0.7, 2.05].map((x) => (
        <mesh
          key={`chassis-cross-${x}`}
          geometry={BOX}
          material={ROADSHOW_TRIM_MATERIAL}
          position={[x, 0.47, 0]}
          scale={[0.11, 0.1, spec.width * 0.69]}
        />
      ))}

      {/* Purpose-built media cabinet: broad flat faces, recessed LED display,
          lower equipment skirt and structural edge rails just like the black
          Adinn LED roadshow vehicles in the supplied references. */}
      <RoundedBox
        args={[spec.bodyLength, spec.bodyHeight, spec.width]}
        radius={0.045}
        smoothness={2}
        position={[spec.bodyCenterX, bodyCenterY, 0]}
        material={ROADSHOW_BODY_MATERIAL}
      />
      <mesh
        geometry={BOX}
        material={ROADSHOW_PAINT_HIGHLIGHT_MATERIAL}
        position={[spec.bodyCenterX, bodyBaseY + spec.bodyHeight - 0.055, 0]}
        scale={[spec.bodyLength * 0.97, 0.065, spec.width * 0.95]}
      />
      <mesh
        geometry={BOX}
        material={ROADSHOW_TRIM_MATERIAL}
        position={[spec.bodyCenterX, 0.67, 0]}
        scale={[spec.bodyLength * 0.94, 0.2, spec.width * 0.88]}
      />
      <RoadshowSideScreen side={1} spec={spec} mode={vehicle.screenMode} brandTexture={brandTexture} />
      <RoadshowSideScreen side={-1} spec={spec} mode={vehicle.screenMode} brandTexture={brandTexture} />
      <RoadshowRearScreen spec={spec} brandTexture={brandTexture} />

      {/* Vertical cabinet edge posts and lower reflective markers keep the
          media box from looking like a single toy cube. */}
      {[mediaRearX + 0.06, mediaFrontX - 0.06].flatMap((x) =>
        [-1, 1].map((side) => (
          <mesh
            key={`media-post-${x}-${side}`}
            geometry={BOX}
            material={ROADSHOW_TRIM_MATERIAL}
            position={[x, bodyCenterY, side * (spec.width / 2 + 0.018)]}
            scale={[0.07, spec.bodyHeight * 0.94, 0.055]}
          />
        )),
      )}
      {[-1, 1].flatMap((side) => [-0.34, 0.02, 0.36].map((ratio) => (
        <mesh
          key={`body-marker-${side}-${ratio}`}
          geometry={BOX}
          material={isNight ? ROADSHOW_SIDE_MARKER_NIGHT_MATERIAL : ROADSHOW_SIDE_MARKER_MATERIAL}
          position={[
            spec.bodyCenterX + spec.bodyLength * ratio,
            0.74,
            side * (spec.width / 2 + 0.04),
          ]}
          scale={[0.13, 0.055, 0.026]}
        />
      )))}

      {/* Custom extruded cab-over shell. This replaces the stacked rounded
          cuboids that made the earlier truck look cartoonish. */}
      <mesh
        geometry={ROADSHOW_CAB_GEOMETRIES[vehicle.variant]}
        material={ROADSHOW_BODY_MATERIAL}
        position={[spec.cabCenterX, cabBaseY, 0]}
      />

      {/* Front fascia moulding and lower bumper. */}
      <RoundedBox
        args={[0.16, 0.34, spec.width * 0.9]}
        radius={0.035}
        smoothness={2}
        position={[cabFrontX + 0.035, 0.69, 0]}
        material={ROADSHOW_TRIM_MATERIAL}
      />
      <RoundedBox
        args={[0.1, 0.46, spec.width * 0.66]}
        radius={0.025}
        smoothness={2}
        position={[cabFrontX + 0.082, 0.98, 0]}
        material={ROADSHOW_GRILLE_MATERIAL}
      />
      {[-0.15, -0.05, 0.05, 0.15].map((offset) => (
        <mesh
          key={`grille-slot-${offset}`}
          geometry={BOX}
          material={ROADSHOW_TRIM_MATERIAL}
          position={[cabFrontX + 0.14, 0.98 + offset, 0]}
          scale={[0.018, 0.018, spec.width * 0.28]}
        />
      ))}

      {/* Large raked windshield with a dark surround, two real wipers and a
          faint dash/steering silhouette visible through the glass. */}
      <RoundedBox
        args={[0.045, spec.cabHeight * 0.5, spec.width * 0.7]}
        radius={0.02}
        smoothness={2}
        position={[cabFrontX - spec.cabLength * 0.115, cabBaseY + spec.cabHeight * 0.69, 0]}
        rotation={[0, 0, -0.25]}
        material={ROADSHOW_GLASS_MATERIAL}
      />
      <mesh
        geometry={BOX}
        material={ROADSHOW_TRIM_MATERIAL}
        position={[cabFrontX - spec.cabLength * 0.115, cabBaseY + spec.cabHeight * 0.69, 0]}
        rotation={[0, 0, -0.25]}
        scale={[0.035, spec.cabHeight * 0.54, spec.width * 0.735]}
      />
      <RoundedBox
        args={[0.052, spec.cabHeight * 0.46, spec.width * 0.67]}
        radius={0.015}
        smoothness={2}
        position={[cabFrontX - spec.cabLength * 0.105, cabBaseY + spec.cabHeight * 0.69, 0]}
        rotation={[0, 0, -0.25]}
        material={ROADSHOW_GLASS_MATERIAL}
      />
      {[-0.24, 0.24].map((z) => (
        <mesh
          key={`wiper-${z}`}
          geometry={BOX}
          material={ROADSHOW_TRIM_MATERIAL}
          position={[cabFrontX - spec.cabLength * 0.07, cabBaseY + spec.cabHeight * 0.58, z * spec.width]}
          rotation={[0.24, 0, 0.18]}
          scale={[0.02, spec.cabHeight * 0.21, 0.018]}
        />
      ))}

      {/* Side door windows use a trapezoidal hard-surface outline rather than
          rectangular glass blocks. */}
      {[1, -1].map((side) => (
        <group key={`cab-side-${side}`}>
          <mesh
            geometry={ROADSHOW_SIDE_WINDOW_GEOMETRY}
            material={ROADSHOW_GLASS_MATERIAL}
            position={[
              spec.cabCenterX - spec.cabLength * 0.11,
              cabBaseY + spec.cabHeight * 0.68,
              side * (spec.width * 0.472),
            ]}
            rotation={[0, side < 0 ? Math.PI : 0, 0]}
            scale={[spec.cabLength * 0.49, spec.cabHeight * 0.49, 1]}
          />
          {/* Door shut line and handle. */}
          <mesh
            geometry={BOX}
            material={ROADSHOW_TRIM_MATERIAL}
            position={[
              spec.cabCenterX - spec.cabLength * 0.12,
              cabBaseY + spec.cabHeight * 0.39,
              side * (spec.width * 0.48),
            ]}
            scale={[spec.cabLength * 0.47, 0.018, 0.02]}
          />
          <mesh
            geometry={BOX}
            material={ROADSHOW_CHROME_MATERIAL}
            position={[
              spec.cabCenterX + spec.cabLength * 0.08,
              cabBaseY + spec.cabHeight * 0.5,
              side * (spec.width * 0.487),
            ]}
            scale={[0.17, 0.03, 0.025]}
          />

          {/* Commercial mirror arm + rectangular mirror housing. */}
          <mesh
            geometry={BOX}
            material={ROADSHOW_TRIM_MATERIAL}
            position={[
              spec.cabCenterX + spec.cabLength * 0.19,
              cabBaseY + spec.cabHeight * 0.69,
              side * (spec.width * 0.56),
            ]}
            rotation={[0, 0, side * -0.12]}
            scale={[0.055, 0.055, spec.width * 0.18]}
          />
          <RoundedBox
            args={[0.28, 0.22, 0.1]}
            radius={0.035}
            smoothness={2}
            position={[
              spec.cabCenterX + spec.cabLength * 0.2,
              cabBaseY + spec.cabHeight * 0.7,
              side * (spec.width * 0.675),
            ]}
            material={ROADSHOW_TRIM_MATERIAL}
          />

          {/* Cab step and black wheel-arch moulding. */}
          <mesh
            geometry={BOX}
            material={ROADSHOW_TRIM_MATERIAL}
            position={[
              spec.cabCenterX - spec.cabLength * 0.04,
              0.47,
              side * (spec.width * 0.49),
            ]}
            scale={[spec.cabLength * 0.48, 0.1, 0.16]}
          />
          {[frontWheelX, rearWheelX].map((wheelX) => (
            <mesh
              key={`arch-${side}-${wheelX}`}
              geometry={ROADSHOW_WHEEL_ARCH_GEOMETRY}
              material={ROADSHOW_RUBBER_MATERIAL}
              position={[wheelX, wheelY + spec.wheelRadius * 0.1, side * (spec.width * 0.492)]}
              rotation={[0, side < 0 ? Math.PI : 0, 0]}
              scale={[spec.wheelRadius * 1.12, spec.wheelRadius * 1.12, 0.68]}
            />
          ))}
        </group>
      ))}

      {/* Sloped roof advertising fairing. Its wedge profile now matches the
          supplied Adinn black LED vehicle much more closely. */}
      <group
        position={[
          spec.cabCenterX - spec.cabLength * 0.12,
          cabTopY - spec.fairingHeight * 0.18,
          0,
        ]}
      >
        <mesh
          geometry={ROADSHOW_FAIRING_GEOMETRIES[vehicle.variant]}
          material={ROADSHOW_BODY_MATERIAL}
        />
        {[1, -1].map((side) => (
          <mesh
            key={`roof-brand-${side}`}
            geometry={PLANE}
            position={[
              -spec.cabLength * 0.05,
              spec.fairingHeight * 0.42,
              side * (spec.width * 0.445),
            ]}
            rotation={[0, side < 0 ? Math.PI : 0, 0]}
            scale={[spec.cabLength * 0.48, spec.fairingHeight * 0.3, 1]}
          >
            <meshStandardMaterial
              map={brandTexture ?? undefined}
              emissiveMap={brandTexture ?? undefined}
              emissive={brandTexture ? "#ffffff" : "#000000"}
              emissiveIntensity={brandTexture ? 0.12 : 0}
              color={brandTexture ? "#ffffff" : "#eeeeec"}
              roughness={0.35}
              metalness={0.02}
            />
          </mesh>
        ))}
      </group>

      {/* Headlamp/indicator clusters are recessed into darker bezels so the
          front reads as a real commercial LCV instead of glowing cubes. */}
      {[-1, 1].map((side) => (
        <group key={`front-light-${side}`}>
          <RoundedBox
            args={[0.07, 0.34, 0.3]}
            radius={0.025}
            smoothness={2}
            position={[cabFrontX + 0.11, 1.02, side * spec.width * 0.31]}
            material={ROADSHOW_TRIM_MATERIAL}
          />
          <RoundedBox
            args={[0.075, 0.2, 0.23]}
            radius={0.022}
            smoothness={2}
            position={[cabFrontX + 0.15, 0.98, side * spec.width * 0.31]}
            material={isNight ? ROADSHOW_LAMP_GLASS_NIGHT_MATERIAL : ROADSHOW_LAMP_GLASS_MATERIAL}
          />
          <RoundedBox
            args={[0.078, 0.09, 0.24]}
            radius={0.018}
            smoothness={2}
            position={[cabFrontX + 0.152, 1.16, side * spec.width * 0.31]}
            material={isNight ? ROADSHOW_INDICATOR_NIGHT_MATERIAL : ROADSHOW_INDICATOR_MATERIAL}
          />
        </group>
      ))}

      {/* Small centre badge, realistic number plate and lower air intake. */}
      <mesh
        geometry={ROAD_POLE_GEOMETRY}
        material={ROADSHOW_CHROME_MATERIAL}
        position={[cabFrontX + 0.151, 1.0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.075, 0.035, 0.075]}
      />
      <mesh
        geometry={BOX}
        material={TRAFFIC_PLATE_MATERIAL}
        position={[cabFrontX + 0.152, 0.7, 0]}
        scale={[0.025, 0.1, 0.38]}
      />
      <mesh
        geometry={BOX}
        material={ROADSHOW_GRILLE_MATERIAL}
        position={[cabFrontX + 0.12, 0.62, 0]}
        scale={[0.03, 0.08, spec.width * 0.38]}
      />

      {/* Under-body fuel/battery box and mud flaps give the wheel area depth. */}
      <RoundedBox
        args={[0.95, 0.32, 0.64]}
        radius={0.05}
        smoothness={2}
        position={[spec.bodyCenterX + spec.bodyLength * 0.23, 0.5, spec.width * 0.31]}
        material={ROADSHOW_TRIM_MATERIAL}
      />
      {[-1, 1].map((side) => (
        <mesh
          key={`mudflap-${side}`}
          geometry={BOX}
          material={ROADSHOW_RUBBER_MATERIAL}
          position={[rearWheelX - spec.wheelRadius * 0.72, wheelY - spec.wheelRadius * 0.42, side * wheelZ]}
          scale={[0.06, spec.wheelRadius * 0.85, spec.wheelWidth * 1.18]}
        />
      ))}

      {/* Two real LCV axles with proper tyres, recessed rims and hubs. */}
      {spec.axleX.flatMap((x, axleIndex) =>
        [-wheelZ, wheelZ].map((z, sideIndex) => {
          const wheelIndex = wheelBase + axleIndex * 2 + sideIndex;
          return (
            <RoadshowWheel
              key={`roadshow-wheel-${index}-${axleIndex}-${sideIndex}`}
              position={[x, wheelY, z]}
              radius={spec.wheelRadius}
              width={spec.wheelWidth}
              wheelIndex={wheelIndex}
              wheelRefs={wheelRefs}
            />
          );
        }),
      )}

      {/* Rear bumper, tail lamps and reflectors on the actual media-body tail. */}
      <mesh
        geometry={BOX}
        material={ROADSHOW_TRIM_MATERIAL}
        position={[mediaRearX - 0.06, 0.58, 0]}
        scale={[0.1, 0.16, spec.width * 0.9]}
      />
      {[-1, 1].map((side) => (
        <group key={`rear-lamp-${side}`}>
          <mesh
            geometry={BOX}
            material={isNight ? TRAFFIC_TAILLIGHT_NIGHT_MATERIAL : TRAFFIC_TAILLIGHT_MATERIAL}
            position={[mediaRearX - 0.12, 0.74, side * spec.width * 0.34]}
            scale={[0.045, 0.18, 0.15]}
          />
          <mesh
            geometry={BOX}
            material={isNight ? ROADSHOW_INDICATOR_NIGHT_MATERIAL : ROADSHOW_INDICATOR_MATERIAL}
            position={[mediaRearX - 0.125, 0.88, side * spec.width * 0.34]}
            scale={[0.045, 0.07, 0.15]}
          />
        </group>
      ))}
    </group>
  );
}

function RoadshowTrafficSystem({ isNight }: { isNight: boolean }) {
  const brandTexture = useAdinnBoardTexture();
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const wheelRefs = useRef<Array<THREE.Group | null>>([]);
  const motionRef = useRef({ time: 0, ledAccumulator: 0 });

  const spanMin = ROADSHOW_ROUTE_MIN_X;
  const spanMax = ROADSHOW_ROUTE_MAX_X;
  const span = spanMax - spanMin;

  useFrame((_, delta) => {
    const dt = Number.isFinite(delta)
      ? Math.min(Math.max(delta, 0), MOTION_MAX_DELTA)
      : 1 / 60;
    const motion = motionRef.current;
    motion.time += dt;
    motion.ledAccumulator += dt;
    const elapsed = motion.time;

    // 24fps is more than enough for a roadside LED texture at this camera
    // distance and avoids needlessly touching the texture every render frame.
    if (motion.ledAccumulator >= 1 / 24) {
      motion.ledAccumulator = 0;
      ROADSHOW_LED_TEXTURE.offset.x = (elapsed * 0.04) % 1;
      ROADSHOW_LED_TEXTURE.offset.y = Math.sin(elapsed * 0.13) * 0.025;
    }

    for (let index = 0; index < ROADSHOW_TRAFFIC_VEHICLES.length; index += 1) {
      const vehicle = ROADSHOW_TRAFFIC_VEHICLES[index];
      const group = groupRefs.current[index];
      if (!group) continue;

      const spec = ROADSHOW_VARIANTS[vehicle.variant];
      const travelSeconds = span / Math.max(vehicle.speed, 0.1);
      const afterFirstArrival = elapsed - vehicle.firstDelay;

      if (afterFirstArrival < 0) {
        group.visible = false;
        continue;
      }

      const cycleSeconds = travelSeconds + vehicle.repeatDelay;
      const shiftedTime = afterFirstArrival + vehicle.initialProgress * travelSeconds;
      const cycleTime = ((shiftedTime % cycleSeconds) + cycleSeconds) % cycleSeconds;

      if (cycleTime > travelSeconds) {
        group.visible = false;
        continue;
      }

      group.visible = true;
      const travelled = cycleTime * vehicle.speed;
      const x = vehicle.direction > 0
        ? spanMin + travelled
        : spanMax - travelled;

      group.position.x = x;
      group.position.y = 0.07;
      group.position.z = vehicle.laneZ;
      group.rotation.y = vehicle.direction > 0 ? 0 : Math.PI;

      const spin = -travelled / Math.max(spec.wheelRadius, 0.1);
      const wheelStart = index * ROADSHOW_WHEELS_PER_VEHICLE;
      const wheelEnd = wheelStart + ROADSHOW_WHEELS_PER_VEHICLE;
      for (let wheelIndex = wheelStart; wheelIndex < wheelEnd; wheelIndex += 1) {
        const wheel = wheelRefs.current[wheelIndex];
        if (wheel) wheel.rotation.z = spin;
      }
    }
  });

  return (
    <group name="Adinn3DLedRoadshowTraffic" dispose={null}>
      {ROADSHOW_TRAFFIC_VEHICLES.map((vehicle, index) => (
        <RoadshowVehicle3D
          key={`roadshow-vehicle-${index}`}
          index={index}
          vehicle={vehicle}
          brandTexture={brandTexture}
          groupRefs={groupRefs}
          wheelRefs={wheelRefs}
          isNight={isNight}
        />
      ))}
    </group>
  );
}

export function RealisticRoadSystem({
  isNight = false,
  progressRef,
}: {
  isNight?: boolean;
  progressRef?: { current: number };
}) {
  const fallbackProgressRef = useRef(7);
  return (
    <group dispose={null}>
      <RoadSidewalks />
      <AsphaltSurface />
      <RoadEdgeAndDrainage />
      <RealRoadLaneMarkings />
      <RoadMedianReal />
      <HighwayCrashBarriers />
      <RoadSurfaceHardware />
      <RoadTrafficSystem isNight={isNight} />
      <RoadshowTrafficSystem isNight={isNight} />
      <RealStreetlights isNight={isNight} />
      <MetroViaductSystem />
      <RoadUnipole isNight={isNight} progressRef={progressRef ?? fallbackProgressRef} />
    </group>
  );
}

function freezeStaticBuildingGroup(root: THREE.Group | null) {
  if (!root) return;
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
    if (!(object as THREE.SkinnedMesh).isSkinnedMesh) {
      object.updateMatrix();
      object.matrixAutoUpdate = false;
    }
  });
}

/* ========================================================================== */
/* READY-TO-DROP BUILDING SET                                                 */
/* ========================================================================== */

export function PremiumBuildingSet({ isNight = false }: { isNight?: boolean }) {
  const staticRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => freezeStaticBuildingGroup(staticRef.current), []);
  return (
    <group ref={staticRef} dispose={null}>
      {/* Foreground building: broad terraces and an asymmetrical upper tower. */}
      <PremiumTerracedOfficeTower
        position={[-55, 0, -1.2]}
        rotation={[0, 0.045, 0]}
        scale={0.72}
        isNight={isNight}
      />

      {/* Original uploaded/reference tower. Main entrance faces +Z. */}
      <PremiumReferenceBuilding
        position={[-20.5, 0, -1.5]}
        rotation={[0, 0.08, 0]}
        scale={0.62}
        isNight={isNight}
      />

      {/* Shorter, wider premium office. */}
      <PremiumWideBuildingTwo
        position={[0, 0, -3.0]}
        rotation={[0, 0, 0]}
        scale={0.68}
        isNight={isNight}
      />

      {/* Shorter, wider residential-corporate building. */}
      <PremiumWideBuildingThree
        position={[21.0, 0, -1.8]}
        rotation={[0, -0.08, 0]}
        scale={0.66}
        isNight={isNight}
      />

      {/* Farther buildings use different massing, facades and rooflines. */}
      <PremiumSteppedGlassTower
        position={[49, 0, -2.5]}
        rotation={[0, -0.035, 0]}
        scale={0.63}
        isNight={isNight}
      />

      <PremiumVerticalFinTower
        position={[76, 0, -1.0]}
        rotation={[0, 0.055, 0]}
        scale={0.58}
        isNight={isNight}
      />

      {/* Second depth layer, set slightly farther back, filling the gaps
          between the near-road buildings above with mild variation. */}
      <PremiumSteppedGlassTower
        position={[-37, 0, -4.2]}
        rotation={[0, -0.05, 0]}
        scale={0.55}
        isNight={isNight}
      />
      <PremiumVerticalFinTower
        position={[-9, 0, -4.6]}
        rotation={[0, 0.06, 0]}
        scale={0.5}
        isNight={isNight}
      />
      <PremiumTerracedOfficeTower
        position={[11, 0, -4.0]}
        rotation={[0, -0.04, 0]}
        scale={0.52}
        isNight={isNight}
      />
      <PremiumWideBuildingTwo
        position={[35, 0, -4.4]}
        rotation={[0, 0.05, 0]}
        scale={0.5}
        isNight={isNight}
      />
      <PremiumWideBuildingThree
        position={[62, 0, -4.7]}
        rotation={[0, -0.06, 0]}
        scale={0.48}
        isNight={isNight}
      />
    </group>
  );
}

/* ========================================================================== */
/* READY-TO-DROP BUILDING SET - OPPOSITE SIDE OF THE ROAD                     */
/* ========================================================================== */

// Mirrors PremiumBuildingSet onto the far side of the road so the highway
// reads as a real dense street with buildings on both sides. Rotation is
// flipped by PI so each entrance still faces the road.
export function PremiumBuildingSetNorth({ isNight = false }: { isNight?: boolean }) {
  const staticRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => freezeStaticBuildingGroup(staticRef.current), []);
  return (
    <group ref={staticRef} dispose={null}>
      <PremiumVerticalFinTower
        position={[-65, 0, -1.4]}
        rotation={[0, Math.PI + 0.05, 0]}
        scale={0.6}
        isNight={isNight}
      />
      <PremiumWideBuildingThree
        position={[-30, 0, -1.8]}
        rotation={[0, Math.PI - 0.06, 0]}
        scale={0.65}
        isNight={isNight}
      />
      <PremiumSteppedGlassTower
        position={[-5, 0, -1.2]}
        rotation={[0, Math.PI + 0.03, 0]}
        scale={0.6}
        isNight={isNight}
      />
      <PremiumTerracedOfficeTower
        position={[18, 0, -1.6]}
        rotation={[0, Math.PI - 0.04, 0]}
        scale={0.62}
        isNight={isNight}
      />
      <PremiumReferenceBuilding
        position={[42, 0, -1.1]}
        rotation={[0, Math.PI + 0.07, 0]}
        scale={0.58}
        isNight={isNight}
      />
      <PremiumWideBuildingTwo
        position={[70, 0, -1.3]}
        rotation={[0, Math.PI - 0.05, 0]}
        scale={0.6}
        isNight={isNight}
      />

      {/* Farther background layer, set back a little more for depth. */}
      <PremiumSteppedGlassTower
        position={[-48, 0, -4.6]}
        rotation={[0, Math.PI + 0.04, 0]}
        scale={0.5}
        isNight={isNight}
      />
      <PremiumVerticalFinTower
        position={[5, 0, -4.9]}
        rotation={[0, Math.PI - 0.05, 0]}
        scale={0.48}
        isNight={isNight}
      />
      <PremiumReferenceBuilding
        position={[55, 0, -4.3]}
        rotation={[0, Math.PI + 0.06, 0]}
        scale={0.5}
        isNight={isNight}
      />
    </group>
  );
}

/* ========================================================================== */
/* REALISTIC URBAN INFILL - CONTINUOUS CITY LAND / NO EMPTY GREY EDGES       */
/* ========================================================================== */

const CITY_GROUND_MAT = new THREE.MeshStandardMaterial({
  color: "#aeb3aa",
  roughness: 0.98,
  metalness: 0,
  envMapIntensity: 0.32,
});

const CITY_SERVICE_ROAD_MAT = new THREE.MeshStandardMaterial({
  color: "#555b5e",
  roughness: 0.9,
  metalness: 0,
  envMapIntensity: 0.22,
});

const CITY_PARK_GRASS_MAT = new THREE.MeshStandardMaterial({
  color: "#607b50",
  roughness: 0.98,
  metalness: 0,
});

const CITY_TREE_TRUNK_MAT = new THREE.MeshStandardMaterial({
  color: "#5a4634",
  roughness: 0.96,
});

/* All district dimensions are in ROAD-LOCAL coordinates. Building bounds
   exclude the bridge, sidewalks and both carriageways. */
type CityPlotBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
type BridgeCityPlot = {
  x: number; z: number; width: number; depth: number; height: number;
  yaw: number; style: number; palette: number; seed: number; row: number;
  bounds: CityPlotBounds;
};

const BRIDGE_CITY_SAFE_EDGE_Z = 0;
const CITY_SERVICE_CENTER_Z = -31.8;
const CITY_SERVICE_WIDTH = 7;
const BRIDGE_CITY_STYLE_NAMES = [
  'stepped-office', 'split-apartment', 'low-rise-commercial',
  'corner-office', 'terrace-residential', 'slender-fin-office',
] as const;

function cityPlotsOverlap(a: CityPlotBounds, b: CityPlotBounds, gap = 0) {
  return a.minX < b.maxX + gap && a.maxX > b.minX - gap &&
    a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;
}

function createBridgeSideCityLayout(): BridgeCityPlot[] {
  const random = seeded(512903);
  const plots: BridgeCityPlot[] = [];
  // Keep the existing premium landmarks and their entrances. New plots never
  // occupy their forecourts. No additional high-rise row is added on the right.
  const reserved: CityPlotBounds[] = [
    { minX: -82, maxX: 97, minZ: -26, maxZ: 1 },
    { minX: -ROAD_STRAIGHT_HALF, maxX: ROAD_STRAIGHT_HALF, minZ: CITY_SERVICE_CENTER_Z - CITY_SERVICE_WIDTH / 2 - 0.7,
      maxZ: CITY_SERVICE_CENTER_Z + CITY_SERVICE_WIDTH / 2 + 0.7 },
  ];
  const crossStreetX = [-930, -760, -590, -420, -255, -92, 86, 252, 418, 586, 754, 922];
  crossStreetX.forEach((x) => {
    reserved.push({ minX: x - 3.8, maxX: x + 3.8, minZ: -78, maxZ: 0.5 });
  });

  for (let row = 0; row < 4; row += 1) {
    let cursor = -ROAD_STRAIGHT_HALF + 25 + row * 7;
    let index = 0;
    let previousStyle = -1;
    while (cursor < ROAD_STRAIGHT_HALF - 25) {
      let style = Math.floor(random() * BRIDGE_CITY_STYLE_NAMES.length);
      if (style === previousStyle) style = (style + 1 + Math.floor(random() * 4)) % 6;
      previousStyle = style;
      // Different massing, NOT one cuboid stretched into a repeated wall.
      const width = style === 5 ? 9 + random() * 4.2 :
        style === 2 ? 16 + random() * 8 : 12 + random() * 8;
      const depth = 10.5 + random() * (row === 0 ? 6.2 : row === 1 ? 10.5 : row === 2 ? 8.5 : 7.5);
      const floors = row >= 2 ? 3 + Math.floor(random() * (row === 3 ? 4 : 5)) :
        style === 2 ? 2 + Math.floor(random() * 3) :
        style === 5 ? 8 + Math.floor(random() * 4) :
        style === 4 ? 4 + Math.floor(random() * 4) : 5 + Math.floor(random() * 5);
      const height = floors * (style === 1 || style === 4 ? 2.95 : 3.2);
      const yaw = (random() - 0.5) * 0.065;
      const front = (row === 0 ? -4.1 : row === 1 ? -40 : row === 2 ? -79 : -116) - random() * 1.8;
      const x = cursor + width / 2 + 2;
      const z = front - depth / 2;
      // Include balconies, canopies, roof overhangs and the surrounding plinth.
      const halfX = Math.abs(Math.cos(yaw)) * (width / 2 + 1.65) +
        Math.abs(Math.sin(yaw)) * (depth / 2 + 2.3);
      const halfZ = Math.abs(Math.cos(yaw)) * (depth / 2 + 2.3) +
        Math.abs(Math.sin(yaw)) * (width / 2 + 1.65);
      const bounds = { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ };
      const permitted = bounds.maxZ <= BRIDGE_CITY_SAFE_EDGE_Z &&
        bounds.maxX < ROAD_STRAIGHT_HALF - 15 &&
        !reserved.some((r) => cityPlotsOverlap(bounds, r, 0.6)) &&
        !plots.some((p) => cityPlotsOverlap(bounds, p.bounds, 1.2));
      if (permitted) plots.push({ x, z, width, depth, height, yaw, style,
        palette: Math.floor(random() * 4), seed: 1800 + row * 400 + index, row, bounds });
      cursor += width + 2.2 + random() * 1.8;
      index += 1;
    }
  }
  return plots;
}

/* Additional district on the OTHER side of the highway. The bridge-side
   layout above is preserved. Each front faces the road using a PI yaw, not a
   negative scale; therefore windows, canopies and normals remain correct. */
const ROAD_SIDE_SAFE_EDGE_Z = 39.5;
const ROAD_SIDE_SERVICE_CENTER_Z = ROAD_CENTER_Z * 2 - CITY_SERVICE_CENTER_Z;

function createRoadSideCityLayout(): BridgeCityPlot[] {
  const random = seeded(918437);
  const plots: BridgeCityPlot[] = [];
  const reserved: CityPlotBounds[] = [
    // Existing north-side premium buildings, terraces and entry forecourts.
    { minX: -88, maxX: 96, minZ: 35.5, maxZ: 68 },
    { minX: -ROAD_STRAIGHT_HALF, maxX: ROAD_STRAIGHT_HALF,
      minZ: ROAD_SIDE_SERVICE_CENTER_Z - CITY_SERVICE_WIDTH / 2 - 0.7,
      maxZ: ROAD_SIDE_SERVICE_CENTER_Z + CITY_SERVICE_WIDTH / 2 + 0.7 },
  ];
  const crossStreetX = [-930, -760, -590, -420, -255, -92, 86, 252, 418, 586, 754, 922];
  crossStreetX.forEach((x) => reserved.push({
    minX: x - 3.8, maxX: x + 3.8, minZ: ROAD_SIDE_SAFE_EDGE_Z, maxZ: 124,
  }));

  for (let row = 0; row < 4; row += 1) {
    let cursor = -ROAD_STRAIGHT_HALF + 27 + row * 8;
    let previousStyle = -1;
    let index = 0;
    while (cursor < ROAD_STRAIGHT_HALF - 25) {
      let style = Math.floor(random() * BRIDGE_CITY_STYLE_NAMES.length);
      if (style === previousStyle) style = (style + 2 + Math.floor(random() * 3)) % 6;
      previousStyle = style;
      const width = style === 2 ? 17 + random() * 7 :
        style === 5 ? 9.4 + random() * 4 : 12.2 + random() * 8;
      const depth = 10.8 + random() * (row === 0 ? 5.8 : row === 1 ? 9.8 : row === 2 ? 8.4 : 7.6);
      const floors = row >= 2 ? 3 + Math.floor(random() * (row === 3 ? 4 : 5)) :
        style === 2 ? 2 + Math.floor(random() * 3) :
        style === 5 ? 8 + Math.floor(random() * 4) :
        style === 4 ? 4 + Math.floor(random() * 4) : 5 + Math.floor(random() * 5);
      const height = floors * (style === 1 || style === 4 ? 2.95 : 3.2);
      const yaw = Math.PI + (random() - 0.5) * 0.06;
      const front = (row === 0 ? 44 : row === 1 ? 84.2 : row === 2 ? 124 : 163) + random() * 2.0;
      const x = cursor + width / 2 + 2;
      const z = front + depth / 2;
      const halfX = Math.abs(Math.cos(yaw)) * (width / 2 + 1.65) +
        Math.abs(Math.sin(yaw)) * (depth / 2 + 2.3);
      const halfZ = Math.abs(Math.cos(yaw)) * (depth / 2 + 2.3) +
        Math.abs(Math.sin(yaw)) * (width / 2 + 1.65);
      const bounds = { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ };
      if (bounds.minZ >= ROAD_SIDE_SAFE_EDGE_Z && bounds.maxX < ROAD_STRAIGHT_HALF - 15 &&
          !reserved.some((r) => cityPlotsOverlap(bounds, r, 0.6)) &&
          !plots.some((p) => cityPlotsOverlap(bounds, p.bounds, 1.2))) {
        plots.push({ x, z, width, depth, height, yaw, style,
          palette: Math.floor(random() * 4), seed: 8200 + row * 500 + index, row, bounds });
      }
      cursor += width + 2.3 + random() * 1.9;
      index += 1;
    }
  }
  return plots;
}

// Restrained exterior colors, opaque recessed windows and shared material
// batches. No new texture files, transparent curtain-wall stack or per-window
// light. The original landmark materials above remain unchanged.
const BRIDGE_CITY_WALLS = ['#d6d1c6', '#c6c5bf', '#e0dcd1', '#a9b2b4'].map((color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.83, metalness: 0.025,
    bumpMap: STONE_MAPS.bump, bumpScale: 0.004, envMapIntensity: 0.42 }));
const BRIDGE_CITY_ACCENT = new THREE.MeshStandardMaterial({ color: '#69777c', roughness: 0.68, metalness: 0.12 });
const BRIDGE_CITY_TRIM = new THREE.MeshStandardMaterial({ color: '#34444c', roughness: 0.39, metalness: 0.45 });
const BRIDGE_CITY_ROOF = new THREE.MeshStandardMaterial({ color: '#7d8582', roughness: 0.87 });
const BRIDGE_CITY_GLASS = {
  day: new THREE.MeshStandardMaterial({ color: '#456c80', roughness: 0.22, metalness: 0.28, envMapIntensity: 1.1 }),
  night: new THREE.MeshStandardMaterial({ color: '#344d58', roughness: 0.28, metalness: 0.2, envMapIntensity: 0.9,
    emissive: '#b87536', emissiveIntensity: 0.34, toneMapped: false }),
};
const BRIDGE_CITY_GLASS_DARK = {
  day: new THREE.MeshStandardMaterial({ color: '#304d59', roughness: 0.3, metalness: 0.24, envMapIntensity: 0.85 }),
  night: new THREE.MeshStandardMaterial({ color: '#2b404b', roughness: 0.32, metalness: 0.2, envMapIntensity: 0.82,
    emissive: '#c28649', emissiveIntensity: 0.28, toneMapped: false }),
};
const BRIDGE_CITY_LEAVES = new THREE.MeshStandardMaterial({ color: '#476444', roughness: 0.94 });
const BRIDGE_CITY_LEAVES_LIGHT = new THREE.MeshStandardMaterial({ color: '#648254', roughness: 0.94 });

type BridgeCityBatchKey = 'wall0' | 'wall1' | 'wall2' | 'wall3' | 'accent' | 'trim' |
  'roof' | 'glass' | 'glassDark' | 'paving' | 'grass' | 'road' | 'trunks' | 'leaves' | 'leavesLight' | 'tanks';
const BRIDGE_CITY_BATCH_KEYS: BridgeCityBatchKey[] = [
  'wall0', 'wall1', 'wall2', 'wall3', 'accent', 'trim', 'roof', 'glass', 'glassDark',
  'paving', 'grass', 'road', 'trunks', 'leaves', 'leavesLight', 'tanks',
];

function createBridgeCityBatches(
  plots: BridgeCityPlot[],
  side: "bridge" | "road" = "bridge",
) {
  const batches: Record<BridgeCityBatchKey, THREE.Matrix4[]> = {
    wall0: [], wall1: [], wall2: [], wall3: [], accent: [], trim: [], roof: [],
    glass: [], glassDark: [], paving: [], grass: [], road: [],
    trunks: [], leaves: [], leavesLight: [], tanks: [],
  };

  for (const plot of plots) {
    const { width: w, depth: d, height: h, style } = plot;
    const random = seeded(plot.seed);
    const distanceFromHero = Math.abs(plot.x - SHOWCASE_CAMERA_POSITION[0]);
    const distantFacade = distanceFromHero > 430 || plot.row >= 2;
    const veryDistantFacade = distanceFromHero > 680 || plot.row >= 3 ||
      (plot.row >= 2 && distanceFromHero > 260);
    const wall = `wall${plot.palette}` as BridgeCityBatchKey;
    const root = matrix([plot.x, 0.18, plot.z], [0, plot.yaw, 0]);
    const put = (key: BridgeCityBatchKey, p: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]) => {
      // Local frame applied to EVERY element: windows cannot rotate away from
      // their own facade or disappear inside a differently rotated shell.
      batches[key].push(root.clone().multiply(matrix(p, rotation, size)));
    };
    const box = (key: BridgeCityBatchKey, cx: number, bottom: number, cz: number,
      width: number, height: number, depth: number) => {
      put(key, [cx, bottom + height / 2, cz], [width, height, depth]);
    };
    const volume = (cx: number, bottom: number, cz: number, width: number,
      height: number, depth: number, key: BridgeCityBatchKey = wall) => {
      box(key, cx, bottom, cz, width, height, depth);
      // Four small coping edges define a roof, rather than a black slab cap.
      const roofY = bottom + height + 0.12;
      put('roof', [cx, roofY, cz], [width + 0.12, 0.13, depth + 0.12]);
      for (const side of [-1, 1]) {
        put(key, [cx, roofY + 0.21, cz + side * depth / 2], [width, 0.34, 0.12]);
        put(key, [cx + side * width / 2, roofY + 0.21, cz], [0.12, 0.34, depth]);
      }
    };
    const frontWindow = (x: number, y: number, z: number, width: number, height: number,
      dark = false) => {
      put('trim', [x, y, z + 0.055], [width + 0.13, height + 0.13, 0.07]);
      put(dark ? 'glassDark' : 'glass', [x, y, z + 0.105], [width, height, 0.06]);
    };
    const sideWindow = (x: number, y: number, z: number, width: number, height: number,
      sign: number, dark = true) => {
      put('trim', [x + sign * 0.055, y, z], [0.07, height + 0.13, width + 0.13]);
      put(dark ? 'glassDark' : 'glass', [x + sign * 0.105, y, z], [width, height, 0.06], [0, sign * Math.PI / 2, 0]);
    };
    const facades = (cx: number, bottom: number, cz: number, width: number,
      height: number, depth: number, mode: 'office' | 'home', sideDetail = true) => {
      const floors = Math.max(1, Math.floor(height / 3));
      const floorStep = veryDistantFacade ? 3 : distantFacade ? 2 : 1;
      for (let floor = 0; floor < floors; floor += floorStep) {
        const y = bottom + (floor + 0.57) * height / floors;
        if (mode === 'office') {
          // Recessed ribbons separated by concrete spandrels.
          frontWindow(cx, y, cz + depth / 2, width * 0.8, Math.min(1.75, height / floors * 0.6));
          for (let col = 1; col < Math.max(2, Math.round(width / 2.5)); col += 1) {
            const count = Math.max(2, Math.round(width / 2.5));
            put('trim', [cx - width * 0.4 + col * width * 0.8 / count, y, cz + depth / 2 + 0.06], [0.038, 1.75, 0.035]);
          }
        } else {
          const columns = Math.max(2, Math.min(4, Math.floor(width / 2.4)));
          for (let col = 0; col < columns; col += 1) {
            frontWindow(cx + (col - (columns - 1) / 2) * (width * 0.76 / columns), y,
              cz + depth / 2, Math.min(1.25, width * 0.52 / columns), 1.32, true);
          }
        }
        if (sideDetail && !distantFacade) {
          // Two/three chosen bays on both exposed sides. Solid stair/service
          // strips and roof rooms remain solid; no all-over window checkerboard.
          const columns = depth > 14 ? 3 : 2;
          for (const sign of [-1, 1]) {
            for (let col = 0; col < columns; col += 1) {
              const zz = cz + ((col + 1) / (columns + 1) - 0.5) * depth * 0.9;
              sideWindow(cx + sign * width / 2, y, zz,
                mode === 'office' ? 1.6 : 1.12, mode === 'office' ? 1.65 : 1.32, sign);
            }
          }
        }
      }
    };
    const garden = (x: number, y: number, z: number, width: number, depth: number) => {
      put('accent', [x, y, z], [width, 0.2, depth]);
      put('grass', [x, y + 0.12, z], [width * 0.91, 0.055, depth * 0.86]);
    };
    const canopy = (x: number, y: number, z: number, width: number) => {
      put('accent', [x, y, z], [width, 0.12, 1.25]);
      for (const sign of [-1, 1]) put('trim', [x + sign * width * 0.42, y / 2, z + 0.3], [0.075, y, 0.075]);
    };
    const balcony = (x: number, y: number, z: number, width: number) => {
      put(wall, [x, y, z + 0.4], [width, 0.13, 1.0]);
      // Slender metal rails, not an expensive transparent material per floor.
      put('trim', [x, y + 0.93, z + 0.9], [width, 0.045, 0.04]);
      put(wall, [x, y + 0.25, z + 0.9], [width, 0.42, 0.065]);
      for (const side of [-1, 1]) put('trim', [x + side * width / 2, y + 0.55, z + 0.9], [0.038, 0.88, 0.038]);
    };

    put('paving', [0, -0.04, 0], [w + 1.45, 0.16, d + 1.55]);
    if (style === 0) {
      const baseH = 3.1;
      volume(0, 0, 0, w, baseH, d);
      facades(0, 0.1, 0, w, 2.8, d, 'office');
      volume(-w * 0.11, baseH, -0.2, w * 0.76, h * 0.53, d * 0.9);
      facades(-w * 0.11, baseH, -0.2, w * 0.76, h * 0.53, d * 0.9, 'office');
      const topH = h - baseH - h * 0.53;
      volume(-w * 0.2, baseH + h * 0.53, -d * 0.15, w * 0.56, topH, d * 0.63);
      facades(-w * 0.2, baseH + h * 0.53, -d * 0.15, w * 0.56, topH, d * 0.63, 'office');
      garden(w * 0.27, baseH + 0.52, 0, w * 0.23, d * 0.67);
      canopy(-w * 0.18, 2.8, d / 2 + 0.4, w * 0.34);
    } else if (style === 1) {
      volume(0, 0, 0, w, 2.5, d);
      const wingW = w * 0.42;
      for (const side of [-1, 1]) {
        const hh = (h - 2.5) * (side < 0 ? 1 : 0.76);
        const cx = side * w * 0.27;
        volume(cx, 2.5, -d * 0.06, wingW, hh, d * 0.88);
        facades(cx, 2.5, -d * 0.06, wingW, hh, d * 0.88, 'home');
        for (let y = 5.4; y < hh + 2; y += 2.95) balcony(cx, y, d * 0.38, wingW * 0.76);
      }
      box('accent', 0, 2.5, -d * 0.27, w * 0.1, h * 0.71, d * 0.33);
      canopy(0, 2.7, d / 2 + 0.3, w * 0.36);
    } else if (style === 2) {
      const lower = Math.min(4, h * 0.46);
      volume(0, 0, 0, w, lower, d);
      facades(0, 0.18, 0, w, lower - 0.35, d, 'office');
      volume(-w * 0.13, lower, -d * 0.18, w * 0.71, h - lower, d * 0.6);
      facades(-w * 0.13, lower, -d * 0.18, w * 0.71, h - lower, d * 0.6, 'home');
      garden(0, lower + 0.38, d * 0.3, w * 0.76, d * 0.19);
      canopy(0, lower * 0.84, d / 2 + 0.24, w * 0.73);
    } else if (style === 3) {
      volume(0, 0, 0, w * 0.96, h, d * 0.94);
      facades(0, 0.2, 0, w * 0.96, h - 0.2, d * 0.94, 'office');
      box('accent', -w * 0.33, 0, -d * 0.28, w * 0.24, h * 0.9, d * 0.34);
      // Deep fins and a smaller corner crown change the silhouette.
      for (const ratio of [-0.34, 0.22, 0.39]) put(wall, [w * ratio, h * 0.5, d * 0.49], [0.15, h * 0.95, 0.44]);
      volume(w * 0.18, h + 0.22, -d * 0.15, w * 0.48, 1.2, d * 0.42, 'accent');
      canopy(w * 0.16, 3.0, d / 2 + 0.32, w * 0.35);
    } else if (style === 4) {
      volume(0, 0, -d * 0.12, w * 0.93, h * 0.65, d * 0.75);
      facades(0, 0.2, -d * 0.12, w * 0.93, h * 0.65 - 0.2, d * 0.75, 'home');
      volume(-w * 0.19, h * 0.65, -d * 0.23, w * 0.53, h * 0.35, d * 0.52);
      facades(-w * 0.19, h * 0.65, -d * 0.23, w * 0.53, h * 0.35, d * 0.52, 'home');
      for (let y = 3.0; y < h * 0.62; y += 2.95) {
        balcony(-w * 0.25, y, d * 0.255, w * 0.32);
        if (Math.round(y) % 2 === 1) balcony(w * 0.23, y, d * 0.255, w * 0.28);
      }
      garden(w * 0.26, h * 0.65 + 0.5, 0, w * 0.3, d * 0.49);
      canopy(-w * 0.2, 2.7, d * 0.29 + 0.55, w * 0.32);
    } else {
      volume(0, 0, 0, w, 3.0, d);
      volume(0, 3.0, -d * 0.1, w * 0.68, h - 3, d * 0.68);
      facades(0, 3.0, -d * 0.1, w * 0.68, h - 3, d * 0.68, 'office');
      for (const side of [-1, 1]) box(side < 0 ? wall : 'accent', side * w * 0.38, 2.8,
        -d * 0.11, w * 0.12, (h - 2.8) * (side < 0 ? 1.025 : 0.83), d * 0.75);
      garden(0, 3.35, d * 0.34, w * 0.82, d * 0.18);
      canopy(0, 2.65, d / 2 + 0.34, w * 0.51);
    }

    // Non-identical rooftop services: not a black box on every identical roof.
    if (style === 1 || style === 4) {
      const tankX = -w * (style === 1 ? 0.27 : 0.19);
      put('tanks', [tankX, h + 1.0, -d * 0.25], [0.48, 0.86, 0.48]);
    }
    // Trees remain on the parcel forecourt, not the train/road clearance.
    for (const sign of [-1, 1]) {
      const x = sign * (w / 2 - 0.85);
      const z = d / 2 + 1.15;
      const scale = 0.85 + random() * 0.65;
      put('trunks', [x, 0.75 * scale, z], [scale, 1.5 * scale, scale]);
      for (let branch = 0; branch < 3; branch += 1) {
        const angle = branch * 2.094 + random();
        put(branch === 1 ? 'leavesLight' : 'leaves',
          [x + Math.cos(angle) * 0.35 * scale, (2.0 + branch * 0.18) * scale,
            z + Math.sin(angle) * 0.28 * scale],
          [0.7 * scale, (0.7 + random() * 0.3) * scale, 0.63 * scale]);
      }
    }
  }

  // Service streets are behind each first row, never under the buildings.
  const add = (key: BridgeCityBatchKey, p: Vec3, size: Vec3) => batches[key].push(matrix(p, [0, 0, 0], size));
  const serviceZ = side === "bridge" ? CITY_SERVICE_CENTER_Z : ROAD_SIDE_SERVICE_CENTER_Z;
  const vergeZ = side === "bridge" ? 0.15 : 38.7;
  const crossZ = side === "bridge" ? -38.3 : 82.3;
  add('road', [0, 0.06, serviceZ], [ROAD_LENGTH - 30, 0.05, CITY_SERVICE_WIDTH]);
  for (const sign of [-1, 1]) {
    add('paving', [0, 0.15, serviceZ + sign * (CITY_SERVICE_WIDTH / 2 + 0.7)],
      [ROAD_LENGTH - 30, 0.18, 1.4]);
  }
  add('grass', [0, 0.06, vergeZ], [ROAD_LENGTH - 24, 0.06, 1.25]);
  const backGreenZ = side === "bridge" ? -69.5 : 113.5;
  add('grass', [0, 0.055, backGreenZ], [ROAD_LENGTH - 38, 0.055, 3.2]);
  add('paving', [0, 0.11, backGreenZ + (side === "bridge" ? 2.2 : -2.2)],
    [ROAD_LENGTH - 38, 0.12, 1.15]);
  for (const x of [-930, -760, -590, -420, -255, -92, 86, 252, 418, 586, 754, 922]) {
    add('road', [x, 0.065, crossZ], [6, 0.05, 72]);
  }
  return batches;
}

function UrbanCityInfill({ isNight }: { isNight: boolean }) {
  const batches = useMemo(() => {
    const bridge = createBridgeCityBatches(createBridgeSideCityLayout(), "bridge");
    const road = createBridgeCityBatches(createRoadSideCityLayout(), "road");
    // Combine by material: two districts do not mean two draw calls per window.
    for (const key of BRIDGE_CITY_BATCH_KEYS) bridge[key].push(...road[key]);
    return bridge;
  }, []);
  const materialFor: Record<BridgeCityBatchKey, THREE.Material> = {
    wall0: BRIDGE_CITY_WALLS[0], wall1: BRIDGE_CITY_WALLS[1],
    wall2: BRIDGE_CITY_WALLS[2], wall3: BRIDGE_CITY_WALLS[3],
    accent: BRIDGE_CITY_ACCENT, trim: BRIDGE_CITY_TRIM, roof: BRIDGE_CITY_ROOF,
    glass: BRIDGE_CITY_GLASS[isNight ? 'night' : 'day'],
    glassDark: BRIDGE_CITY_GLASS_DARK[isNight ? 'night' : 'day'],
    paving: PAVING, grass: CITY_PARK_GRASS_MAT, road: CITY_SERVICE_ROAD_MAT,
    trunks: CITY_TREE_TRUNK_MAT, leaves: BRIDGE_CITY_LEAVES,
    leavesLight: BRIDGE_CITY_LEAVES_LIGHT, tanks: ROAD_CURB,
  };
  return (
    <group name="TwoSidedCityDistricts" dispose={null}>
      {BRIDGE_CITY_BATCH_KEYS.map((key) => (
        <InstanceBatch key={key} matrices={batches[key]} material={materialFor[key]}
          geometry={key === 'trunks' ? TRUNK : key === 'leaves' || key === 'leavesLight' ? PLANT :
              key === 'tanks' ? ROAD_POLE_GEOMETRY : BOX}
          receiveShadow={key.startsWith('wall') || key === 'paving' || key === 'grass'} />
      ))}
    </group>
  );
}


/* ========================================================================== */
/* SHOWCASE RENDERING                                                         */
/* ========================================================================== */

function RendererSettings({ isNight }: { isNight: boolean }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = isNight ? 1.02 : 1.08;
    gl.shadowMap.enabled = ENABLE_REALTIME_SHADOWS;
    gl.shadowMap.type = THREE.PCFShadowMap;
  }, [gl, isNight]);

  return null;
}


/* Button zoom uses the camera projection, not mouse-wheel dolly. OrbitControls
   therefore cannot overwrite the requested zoom or fight a second animation. */
type CityZoomRequest = { steps: number };
type CityZoomState = { target: number };
const CITY_BUTTON_ZOOM_MIN = 0.62;
const CITY_BUTTON_ZOOM_MAX = 2.4;
const CITY_BUTTON_ZOOM_STEP = 1.2;

function advanceCityButtonZoom(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  state: CityZoomState,
  request: CityZoomRequest,
  delta: number,
) {
  if (request.steps !== 0) {
    state.target = THREE.MathUtils.clamp(
      state.target * Math.pow(CITY_BUTTON_ZOOM_STEP, request.steps),
      CITY_BUTTON_ZOOM_MIN,
      CITY_BUTTON_ZOOM_MAX,
    );
    request.steps = 0;
  }
  if (Math.abs(camera.zoom - state.target) < 0.0001) {
    if (camera.zoom !== state.target) {
      camera.zoom = state.target;
      camera.updateProjectionMatrix();
    }
    return;
  }
  const alpha = 1 - Math.exp(-13 * Math.min(Math.max(delta, 0), 0.1));
  camera.zoom += (state.target - camera.zoom) * alpha;
  camera.updateProjectionMatrix();
}

// Move target AND camera by the same correction. Clamping only the target
// changes the viewing direction/distance and causes a snap at the pan limit.
function clampCityPanTarget(
  controls: OrbitControlsImpl,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  correction: THREE.Vector3,
) {
  const target = controls.target;
  const origin = SHOWCASE_CAMERA_TARGET;
  const settings = SHOWCASE_CONTROL_SETTINGS;
  correction.set(
    THREE.MathUtils.clamp(target.x, origin[0] - settings.maxPanX, origin[0] + settings.maxPanX) - target.x,
    THREE.MathUtils.clamp(target.y, origin[1] - settings.maxPanY, origin[1] + settings.maxPanY) - target.y,
    THREE.MathUtils.clamp(target.z, origin[2] - settings.maxPanZ, origin[2] + settings.maxPanZ) - target.z,
  );
  if (correction.lengthSq() < 1e-18) return;
  target.add(correction);
  camera.position.add(correction);
  camera.updateMatrixWorld();
}

function ShowcaseControls({
  zoomRequestRef,
}: {
  zoomRequestRef: { current: CityZoomRequest };
}) {
  const { camera, gl } = useThree();
  const runtimeRef = useRef<{
    controls: OrbitControlsImpl;
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    zoom: CityZoomState;
    panCorrection: THREE.Vector3;
  } | null>(null);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) && !(camera instanceof THREE.OrthographicCamera)) return;

    // Initial pose only; scroll and stage changes never reset camera controls.
    camera.position.set(...SHOWCASE_CAMERA_POSITION);
    camera.lookAt(...SHOWCASE_CAMERA_TARGET);
    const element = gl.domElement;
    // OrbitControls can change touchAction in its constructor; save it first.
    const previousCursor = element.style.cursor;
    const previousTouchAction = element.style.touchAction;
    const instance = new OrbitControlsImpl(camera, element);
    instance.target.set(...SHOWCASE_CAMERA_TARGET);
    instance.enableDamping = true;
    instance.dampingFactor = SHOWCASE_CONTROL_SETTINGS.dampingFactor;
    instance.enablePan = SHOWCASE_CONTROL_SETTINGS.enablePan;
    instance.screenSpacePanning = true;
    instance.panSpeed = SHOWCASE_CONTROL_SETTINGS.panSpeed;
    instance.enableZoom = false; // Wheel, trackpad and pinch do NOT zoom.
    instance.minDistance = 42;
    instance.maxDistance = 320;
    instance.minPolarAngle = SHOWCASE_CONTROL_SETTINGS.minPolarAngle;
    instance.maxPolarAngle = SHOWCASE_CONTROL_SETTINGS.maxPolarAngle;
    const initialYaw = Math.atan2(
      camera.position.x - instance.target.x,
      camera.position.z - instance.target.z,
    );
    const yawLimit = THREE.MathUtils.degToRad(SHOWCASE_CONTROL_SETTINGS.maxYawFromInitialDegrees);
    instance.minAzimuthAngle = initialYaw - yawLimit;
    instance.maxAzimuthAngle = initialYaw + yawLimit;
    instance.rotateSpeed = SHOWCASE_CONTROL_SETTINGS.rotateSpeed;
    instance.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    // Pan is locked. Middle/right drag therefore cannot pull the camera
    // under the bridge or through the buildings.
    instance.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    instance.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    instance.touches.ONE = THREE.TOUCH.ROTATE;
    instance.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    const panCorrection = new THREE.Vector3();
    instance.update();

    element.style.cursor = 'grab';
    element.style.touchAction = 'pan-y'; // Vertical touch scrolling stays native.
    const start = () => { element.style.cursor = 'grabbing'; };
    const end = () => { element.style.cursor = 'grab'; };
    instance.addEventListener('start', start);
    instance.addEventListener('end', end);

    runtimeRef.current = {
      controls: instance,
      camera,
      zoom: { target: camera.zoom },
      panCorrection,
    };
    return () => {
      instance.removeEventListener('start', start);
      instance.removeEventListener('end', end);
      instance.dispose();
      element.style.cursor = previousCursor;
      element.style.touchAction = previousTouchAction;
      runtimeRef.current = null;
    };
  }, [camera, gl]);

  // ONE camera owner. Keep OrbitControls damping constant; changing damping
  // every frame can make movement feel different at different frame rates.
  // Pan is disabled, so there is no second clamp system fighting controls.
  useFrame((_, delta) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const dt = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), 0.1) : 0;
    runtime.controls.update();
    advanceCityButtonZoom(runtime.camera, runtime.zoom, zoomRequestRef.current, dt);
  }, -1);
  return null;
}


function StudioScene({
  isNight,
  progressRef,
}: {
  isNight: boolean;
  progressRef: { current: number };
}) {
  return (
    <>
      <RendererSettings isNight={isNight} />

      {/* Day fallback is intentionally sky-blue. If the atmospheric sky is
          ever clipped on a GPU/browser, users still see sky instead of a flat
          grey/white background. Fog remains pale near the horizon. */}
      <color attach="background" args={[isNight ? "#050b12" : "#c8dfea"]} />
      <fog attach="fog" args={[isNight ? "#111922" : "#e3e8ea", 720, 1580]} />

      {isNight ? <RealisticNightSky /> : <RealisticDaySky />}

      <Environment key={isNight ? "env-night" : "env-day"} background={false} resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={isNight ? 2.0 : 5.6}
          color={isNight ? "#7899bc" : "#ffffff"}
          position={[-18, 28, 22]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[32, 30, 1]}
        />
        <Lightformer
          form="rect"
          intensity={isNight ? 1.35 : 4.2}
          color={isNight ? "#4f708e" : "#cde9ff"}
          position={[20, 24, -12]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[30, 26, 1]}
        />
        <Lightformer
          form="rect"
          intensity={isNight ? 0.78 : 2.35}
          color={isNight ? "#6a7c8e" : "#ffd09b"}
          position={[0, 36, 26]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[28, 20, 1]}
        />
        <Lightformer
          form="rect"
          intensity={isNight ? 0.52 : 1.6}
          color={isNight ? "#263d56" : "#85b4d0"}
          position={[-3, 18, -30]}
          rotation={[0, 0, 0]}
          scale={[44, 16, 1]}
        />
      </Environment>

      <ambientLight intensity={isNight ? 0.4 : 0.34} color={isNight ? "#6f86a3" : "#fff5e6"} />
      <hemisphereLight
        args={[
          isNight ? "#6986aa" : "#d8efff",
          isNight ? "#111820" : "#82796c",
          isNight ? 0.72 : 0.92,
        ]}
      />

      {/* Preserve the original city key light. The visible sky sun is purely
          visual and does not control this light. */}
      <directionalLight
        position={[20, 34, 24]}
        intensity={isNight ? 0.55 : 3.2}
        color={isNight ? "#9ab7db" : "#ffe1b2"}
        castShadow={ENABLE_REALTIME_SHADOWS}
        shadow-mapSize-width={SHADOW_SIZE}
        shadow-mapSize-height={SHADOW_SIZE}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={38}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />

      <directionalLight
        position={[-24, 19, 10]}
        intensity={isNight ? 0.32 : 0.72}
        color={isNight ? "#6588ad" : "#b9ddff"}
      />

      <directionalLight
        position={[8, 20, -28]}
        intensity={isNight ? 0.18 : 0.42}
        color={isNight ? "#536f91" : "#ffd6a5"}
      />

      <group position={SHOWCASE_SCENE_OFFSET}>
        {/* Oversized continuous city ground: the old 260-unit plane exposed a
            hard diagonal edge from the elevated camera. Keep the terrain far
            beyond the fog range so no artificial polygon boundary is visible. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 26]} receiveShadow>
          <planeGeometry args={[ROAD_GROUND_LENGTH + 1500, 1500]} />
          <primitive object={CITY_GROUND_MAT} attach="material" />
        </mesh>

        {/* Shared local frame: road, metro and ALL building plots stay parallel.
            Both districts remain outside their respective transport clearances. */}
        <group name="RoadAndCityCoordinateFrame" rotation={[0, ROAD_LAYOUT_YAW, 0]}>
          {isNight && <NightCityAmbientRig />}
          <RealisticRoadSystem isNight={isNight} progressRef={progressRef} />
          <UrbanCityInfill isNight={isNight} />

          <group position={BUILDING_SET_OFFSET}>
            <PremiumBuildingSet isNight={isNight} />
          </group>
          <group position={BUILDING_SET_OFFSET_NORTH}>
            <PremiumBuildingSetNorth isNight={isNight} />
          </group>
        </group>

      </group>

    </>
  );
}

// Stable refs carry scroll progress. Changing the DOM stage label must NOT
// rebuild thousands of static JSX meshes or their instancing matrices.
const MemoizedStudioScene = memo(StudioScene);

export default function GroundToSkyScene({
  active,
  isNight,
  progressRef,
  zoomRequestRef,
}: {
  active: boolean;
  isNight: boolean;
  progressRef: { current: number };
  zoomRequestRef: { current: CityZoomRequest };
}) {
  return (
        <Canvas
          frameloop={active ? "always" : "never"}
          dpr={[1, DPR_MAX]}
          shadows={ENABLE_REALTIME_SHADOWS}
          camera={{ position: SHOWCASE_CAMERA_POSITION, fov: SHOWCASE_CAMERA_FOV, near: 1.0, far: 1750 }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false }}
        >
          {/* Controls remain mounted even while the existing train GLB loads. */}
          <ShowcaseControls zoomRequestRef={zoomRequestRef} />
          <Suspense fallback={null}>
            <MemoizedStudioScene isNight={isNight} progressRef={progressRef} />
            {/* Compile materials/geometries before delayed traffic enters the camera.
                This moves shader warm-up to section startup instead of causing a
                visible hitch when a Roadshow truck first appears. */}
            <Preload all />
          </Suspense>
        </Canvas>
  );
}
