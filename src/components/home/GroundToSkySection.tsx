"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox, Sky } from "@react-three/drei";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { GLTFLoader, OrbitControls as OrbitControlsImpl } from "three-stdlib";

type Vec3 = [number, number, number];
type Stage = { title: string; description: string; focus: string };
type ScrollRef = MutableRefObject<number>;

/* -------------------------------------------------------------------------- */
/*                         SAFE ADJUSTMENT SETTINGS                           */
/* -------------------------------------------------------------------------- */

const RENDER_DPR_MAX = 1.05;
const SHADOW_MAP_SIZE = 512;
const CAMERA_SCROLL_SCRUB = 1.05;
const CAMERA_IDLE_RELEASE_DELAY = 0.12;
const NEAR_BUILDING_DETAIL_DISTANCE = 28;
// Composition controls from the user's latest file.
const HERO_CAMERA_PULLBACK_RATIO = 1.12;
const NEAR_CITY_SETBACK = 3.5;

const SCROLL_ZOOM_STRENGTH = 1;
const MAX_MOTION_FRAME_DELTA = 0.12;
const CAMERA_MIN_POLAR_ANGLE = 0.98;
const CAMERA_MAX_POLAR_ANGLE = 1.52;
const CAMERA_MIN_AZIMUTH_ANGLE = -0.34;
const CAMERA_MAX_AZIMUTH_ANGLE = 0.34;
const CAMERA_MIN_DISTANCE = 13;
const CAMERA_MAX_DISTANCE = 68;
const UNIPOLE_NIGHT_LIGHT_RATIO = 1.35;
const STREET_NIGHT_LIGHT_RATIO = 1.2;
const TRAFFIC_DENSITY = 6;
const METRO_SPEED = 10.5;

const ROAD_MIN_Z = -176;
const ROAD_HORIZON_Z = -336;
const ROAD_MAX_Z = 52;
const UNIPOLE_POSITION: Vec3 = [0, 0, -6];

const STAGES: Stage[] = [
  {
    title: "Site Survey & Soil Analysis",
    description:
      "Utility clearance, total-station verification and a compact borehole investigation are completed inside the centre median.",
    focus: "Ground verification",
  },
  {
    title: "Foundation Excavation",
    description:
      "The approved footing footprint is excavated to the engineered depth while the live carriageways remain clear.",
    focus: "Excavation depth",
  },
  {
    title: "RCC Foundation & Anchor Assembly",
    description:
      "Reinforcement, formwork, anchor template and concrete plinth are aligned to the structural drawing.",
    focus: "Anchor accuracy",
  },
  {
    title: "Steel Pole Erection",
    description:
      "The tapered mast is lifted vertically, seated on the base plate and secured to the anchor assembly.",
    focus: "Mast alignment",
  },
  {
    title: "Head Frame & Catwalk Installation",
    description:
      "The engineered display frame, rear cross-bracing, maintenance catwalk and protected ladder are installed.",
    focus: "Structural head",
  },
  {
    title: "Banner Skin & Electrical Integration",
    description:
      "The display skin is tensioned across the face and weather-protected electrical routes are connected behind it.",
    focus: "Display finish",
  },
  {
    title: "Floodlights & Final Alignment",
    description:
      "Five adjustable LED fixtures are aimed across the banner for an even wash without spilling light onto traffic.",
    focus: "Lighting alignment",
  },
  {
    title: "Quality Certification & Handover",
    description:
      "Verticality, fasteners, access safety, electrical performance and illumination are verified before handover.",
    focus: "Certified completion",
  },
];

const STAGE_TITLE_LINES = [
  ["Site Survey", "& Soil Analysis"],
  ["Foundation", "Excavation"],
  ["RCC Foundation", "& Anchor Assembly"],
  ["Steel Pole", "Erection"],
  ["Head Frame", "& Catwalk Installation"],
  ["Banner Skin", "& Electrical Integration"],
  ["Floodlights", "& Final Alignment"],
  ["Quality", "Certification", "& Handover"],
] as const;

const RAW_CAMERA_POSES: Array<{ position: Vec3; target: Vec3; fov: number }> = [
  // Reference-like hero composition: broad road, metro viaduct on the left,
  // UNIPOLE centered on the median and the skyline framing both sides.
  { position: [19.4, 17.4, 33.8], target: [0.25, 8.55, -16.5], fov: 39.5 },
  { position: [11.4, 7.1, 19.1], target: [0.1, 0.8, -6.2], fov: 36.5 },
  { position: [12.0, 8.1, 20.3], target: [0.1, 2.2, -6.2], fov: 36.5 },
  { position: [14.0, 12.0, 23.9], target: [0.1, 6.3, -6.4], fov: 37.2 },
  { position: [14.8, 17.8, 25.9], target: [0.1, 12.5, -6.6], fov: 38 },
  { position: [13.9, 19.1, 24.1], target: [0.1, 14.15, -6.6], fov: 35.5 },
  { position: [14.3, 20.1, 24.9], target: [0.1, 15.15, -6.6], fov: 36.5 },
  { position: [19.4, 17.4, 33.8], target: [0.25, 8.55, -16.5], fov: 39.5 },
];

const CAMERA_POSES = RAW_CAMERA_POSES.map(({ position, target, fov }) => ({
  position: [
    target[0] + (position[0] - target[0]) * HERO_CAMERA_PULLBACK_RATIO,
    target[1] + (position[1] - target[1]) * HERO_CAMERA_PULLBACK_RATIO,
    target[2] + (position[2] - target[2]) * HERO_CAMERA_PULLBACK_RATIO,
  ] as Vec3,
  target,
  fov,
}));

/* -------------------------------------------------------------------------- */
/*                            TEXTURE GENERATION                              */
/* -------------------------------------------------------------------------- */

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function noiseTexture(
  size: number,
  base: [number, number, number],
  variation: number,
  repeat: [number, number],
  seed: number,
) {
  const random = seeded(seed);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const grain = (random() - 0.5) * variation;
    data[i * 4] = THREE.MathUtils.clamp(base[0] + grain, 0, 255);
    data[i * 4 + 1] = THREE.MathUtils.clamp(base[1] + grain, 0, 255);
    data[i * 4 + 2] = THREE.MathUtils.clamp(base[2] + grain, 0, 255);
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}


function asphaltSurfaceTexture(size: number, seed: number) {
  const random = seeded(seed);
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const aggregate = (random() - 0.5) * 20;
      const fineNoise = Math.sin(x * 0.61 + y * 0.29) * 4.5;
      const laneWear =
        Math.exp(-Math.pow(((x / size) - 0.28) / 0.055, 2)) * -7 +
        Math.exp(-Math.pow(((x / size) - 0.72) / 0.055, 2)) * -7;
      const subtlePatch =
        Math.sin(y * 0.035 + Math.sin(x * 0.08) * 1.8) * 2.2;
      const value = THREE.MathUtils.clamp(
        104 + aggregate + fineNoise + laneWear + subtlePatch,
        58,
        142,
      );

      data[i] = value;
      data[i + 1] = value + 1;
      data[i + 2] = value + 2;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 58);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function structuralConcreteTexture(size: number, seed: number) {
  const random = seeded(seed);
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const grain = (random() - 0.5) * 17;
      const verticalStain =
        -10 * Math.max(0, Math.sin(x * 0.095 + seed) * 0.5 + 0.5) *
        Math.pow(y / size, 1.65);
      const formworkBand = Math.abs((y % 52) - 26) > 24.6 ? -12 : 0;
      const fine = Math.sin(x * 0.12 + y * 0.17) * 2.2;
      const base = THREE.MathUtils.clamp(
        172 + grain + verticalStain + formworkBand + fine,
        118,
        202,
      );

      data[i] = base;
      data[i + 1] = base + 1;
      data[i + 2] = base - 1;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 9);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}


function facadeTextures(
  seed: number,
  wall: [number, number, number],
  glass: [number, number, number],
  pattern: number,
) {
  const width = 128;
  const height = 256;
  const random = seeded(seed);
  const colorData = new Uint8Array(width * height * 4);
  const glowData = new Uint8Array(width * height * 4);
  const litWindows = Array.from({ length: 144 }, () => random() > 0.84);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;

      let cellWidth = 20;
      let cellHeight = 28;
      if (pattern === 0) {
        cellWidth = 18;
        cellHeight = 30;
      } else if (pattern === 1) {
        cellWidth = 24;
        cellHeight = 32;
      } else if (pattern === 2) {
        cellWidth = 22;
        cellHeight = 30;
      } else if (pattern === 3) {
        cellWidth = 16;
        cellHeight = 30;
      } else if (pattern === 4) {
        cellWidth = 28;
        cellHeight = 34;
      } else {
        cellWidth = 14;
        cellHeight = 31;
      }

      const cellX = x % cellWidth;
      const cellY = y % cellHeight;
      const col = Math.floor(x / cellWidth);
      const row = Math.floor(y / cellHeight);

      const sideFrame = pattern === 5 ? 1 : 2;
      const topFrame = 2;
      const bottomSpandrel = pattern === 4 ? 6 : 4;

      let isGlass =
        cellX > sideFrame &&
        cellX < cellWidth - sideFrame &&
        cellY > topFrame &&
        cellY < cellHeight - bottomSpandrel;

      const centralMullion =
        (pattern === 1 || pattern === 4) &&
        Math.abs(cellX - cellWidth * 0.5) < 1.1;

      if (centralMullion) isGlass = false;

      const isFrame =
        cellX <= sideFrame ||
        cellX >= cellWidth - sideFrame ||
        centralMullion;

      const isSpandrel = cellY >= cellHeight - bottomSpandrel;
      const isHighlight =
        (pattern === 0 || pattern === 3 || pattern === 5) &&
        (cellX === sideFrame + 1 || cellX === cellWidth - sideFrame - 2);

      const subtleGrain = (Math.sin(x * 0.12 + y * 0.075 + seed) + 1) * 1.8;

      if (isGlass) {
        const reflection =
          Math.max(0, 20 - Math.abs(cellX - cellWidth * 0.5) * 1.75) +
          Math.max(0, 9 - Math.abs(cellY - cellHeight * 0.3) * 0.8);
        const skyLift = Math.floor((1 - y / height) * 12);
        const verticalVariation = Math.sin((x / width) * Math.PI * 5 + seed) * 5;

        colorData[i] = THREE.MathUtils.clamp(
          glass[0] + reflection * 0.45 + skyLift + verticalVariation,
          0,
          255,
        );
        colorData[i + 1] = THREE.MathUtils.clamp(
          glass[1] + reflection * 0.75 + skyLift + verticalVariation,
          0,
          255,
        );
        colorData[i + 2] = THREE.MathUtils.clamp(
          glass[2] + reflection + skyLift + 10 + verticalVariation,
          0,
          255,
        );

        const lit = litWindows[(row * 17 + col) % litWindows.length];
        glowData[i] = lit ? 255 : 0;
        glowData[i + 1] = lit ? 203 : 0;
        glowData[i + 2] = lit ? 118 : 0;
      } else {
        const shade = isHighlight ? 1.18 : isFrame ? 0.9 : isSpandrel ? 0.72 : 1;
        colorData[i] = THREE.MathUtils.clamp(wall[0] * shade + subtleGrain, 0, 255);
        colorData[i + 1] = THREE.MathUtils.clamp(wall[1] * shade + subtleGrain, 0, 255);
        colorData[i + 2] = THREE.MathUtils.clamp(wall[2] * shade + subtleGrain, 0, 255);
        glowData[i] = glowData[i + 1] = glowData[i + 2] = 0;
      }

      colorData[i + 3] = 255;
      glowData[i + 3] = 255;
    }
  }

  const color = new THREE.DataTexture(colorData, width, height, THREE.RGBAFormat);
  const emissive = new THREE.DataTexture(glowData, width, height, THREE.RGBAFormat);

  for (const texture of [color, emissive]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }

  return { color, emissive };
}

function cloudTexture() {
  const size = 128;
  const random = seeded(57);
  const centers = Array.from({ length: 14 }, () => ({
    x: 0.18 + random() * 0.64,
    y: 0.3 + random() * 0.4,
    radius: 0.12 + random() * 0.18,
  }));
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      let density = 0;
      for (const center of centers) {
        const distance = Math.hypot(nx - center.x, (ny - center.y) * 1.25);
        density = Math.max(density, 1 - distance / center.radius);
      }
      density = THREE.MathUtils.smoothstep(density, 0.05, 0.82);
      const i = (y * size + x) * 4;
      data[i] = 247;
      data[i + 1] = 249;
      data[i + 2] = 252;
      data[i + 3] = Math.round(density * 220);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const ASPHALT_MAP = asphaltSurfaceTexture(256, 11);
const CONCRETE_MAP = noiseTexture(192, [166, 166, 160], 18, [4, 10], 23);
const STRUCTURAL_CONCRETE_MAP = structuralConcreteTexture(256, 723);
const STEEL_MAP = noiseTexture(160, [118, 123, 126], 16, [4, 4], 31);
const BANNER_GRAIN = noiseTexture(128, [232, 225, 208], 14, [3, 2], 79);
const CLOUD_MAP = cloudTexture();

type BuildingStyleDefinition = {
  wall: [number, number, number];
  glass: [number, number, number];
  glassColor: string;
  roofColor: string;
  accentColor: string;
  facadeRoughness: number;
  facadeMetalness: number;
  parapetHeight: number;
  hasBalconies: boolean;
  hasSunshades: boolean;
  hasCanopy: boolean;
  hasFins: boolean;
};

// Six reusable present-day Chennai building languages. Geometry remains
// deliberately anonymous: no generated names, signs or logos are applied.
const BUILDING_STYLES: BuildingStyleDefinition[] = [
  {
    wall: [111, 126, 136],
    glass: [76, 135, 171],
    glassColor: "#79a8c4",
    roofColor: "#818d93",
    accentColor: "#bac7cd",
    facadeRoughness: 0.14,
    facadeMetalness: 0.24,
    parapetHeight: 0.54,
    hasBalconies: false,
    hasSunshades: false,
    hasCanopy: true,
    hasFins: true,
  },
  {
    wall: [91, 107, 118],
    glass: [67, 120, 155],
    glassColor: "#6b99b5",
    roofColor: "#76838a",
    accentColor: "#aebdc5",
    facadeRoughness: 0.13,
    facadeMetalness: 0.28,
    parapetHeight: 0.5,
    hasBalconies: false,
    hasSunshades: false,
    hasCanopy: true,
    hasFins: true,
  },
  {
    wall: [126, 137, 144],
    glass: [89, 143, 176],
    glassColor: "#86afc7",
    roofColor: "#899397",
    accentColor: "#c3ccd0",
    facadeRoughness: 0.15,
    facadeMetalness: 0.22,
    parapetHeight: 0.5,
    hasBalconies: false,
    hasSunshades: false,
    hasCanopy: true,
    hasFins: true,
  },
  {
    wall: [76, 91, 104],
    glass: [55, 106, 143],
    glassColor: "#5d8eae",
    roofColor: "#69777e",
    accentColor: "#a8b8c0",
    facadeRoughness: 0.12,
    facadeMetalness: 0.3,
    parapetHeight: 0.48,
    hasBalconies: false,
    hasSunshades: false,
    hasCanopy: true,
    hasFins: true,
  },
  {
    wall: [162, 163, 157],
    glass: [82, 125, 153],
    glassColor: "#7698ad",
    roofColor: "#93958f",
    accentColor: "#d0d2cd",
    facadeRoughness: 0.18,
    facadeMetalness: 0.18,
    parapetHeight: 0.58,
    hasBalconies: true,
    hasSunshades: true,
    hasCanopy: false,
    hasFins: false,
  },
  {
    wall: [80, 96, 108],
    glass: [63, 128, 169],
    glassColor: "#68a0c3",
    roofColor: "#71808a",
    accentColor: "#b7c8d2",
    facadeRoughness: 0.12,
    facadeMetalness: 0.3,
    parapetHeight: 0.58,
    hasBalconies: false,
    hasSunshades: false,
    hasCanopy: true,
    hasFins: true,
  },
];

const FACADE_MAPS = BUILDING_STYLES.map((style, index) =>
  facadeTextures(index + 1, style.wall, style.glass, index),
);

// These resources contain no browser globals, so they are safe to create while
// Next.js evaluates the client module on the server. The scene opts out of R3F's
// automatic disposal for the shared resources at the owning groups.
const SHARED_UNIT_PLANE_GEOMETRY = new THREE.PlaneGeometry(1, 1);
const SHARED_UNIT_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const SHARED_UNIT_CIRCLE_GEOMETRY = new THREE.CircleGeometry(1, 16);
const DEFAULT_BEAM_COLOR = "#737b80";
const SHARED_BEAM_MATERIALS = new Map(
  [
    DEFAULT_BEAM_COLOR,
    "#4b5356",
    "#141b1e",
    "#343b40",
    "#d6aa37",
    "#d3a329",
    "#d3a029",
    "#555b5d",
    "#2f3234",
  ].map((color): [string, THREE.MeshStandardMaterial] => [
    color,
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.72,
      roughness: 0.34,
      map: STEEL_MAP,
    }),
  ]),
);

function sharedBeamMaterial(color: string) {
  return SHARED_BEAM_MATERIALS.get(color) ?? SHARED_BEAM_MATERIALS.get(DEFAULT_BEAM_COLOR)!;
}
const VEHICLE_WHEEL_GEOMETRY = new THREE.CylinderGeometry(0.29, 0.29, 0.18, 16);
const VEHICLE_WHEEL_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#171a1d",
  roughness: 0.76,
  metalness: 0.1,
});

const PLANT_STEM_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 7);
const PLANT_LEAF_GEOMETRY = new THREE.ConeGeometry(1, 2, 5);
const PLANT_FLOWER_GEOMETRY = new THREE.DodecahedronGeometry(1, 0);
const PLANT_STEM_MATERIAL = new THREE.MeshStandardMaterial({ color: "#345a2d", roughness: 0.92 });
const PLANT_LEAF_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#456e38",
  roughness: 0.92,
  side: THREE.DoubleSide,
});
const PLANT_FLOWER_MATERIAL = new THREE.MeshStandardMaterial({ color: "#d66b3d", roughness: 0.86 });

const BUILDING_FACADE_MATERIALS = {
  day: BUILDING_STYLES.map(
    (style) =>
      new THREE.MeshPhysicalMaterial({
        color: style.glassColor,
        roughness: style.facadeRoughness,
        metalness: style.facadeMetalness,
        clearcoat: 0.94,
        clearcoatRoughness: 0.09,
        envMapIntensity: 2.15,
      }),
  ),
  night: BUILDING_STYLES.map(
    (style, index) =>
      new THREE.MeshPhysicalMaterial({
        color: style.glassColor,
        emissiveMap: FACADE_MAPS[index].emissive,
        emissive: new THREE.Color("#e5b57d"),
        emissiveIntensity: 0.34,
        roughness: Math.min(0.22, style.facadeRoughness + 0.04),
        metalness: style.facadeMetalness,
        clearcoat: 0.82,
        clearcoatRoughness: 0.14,
        envMapIntensity: 1.15,
      }),
  ),
};

const BUILDING_LOBBY_GLASS_MATERIALS = {
  day: new THREE.MeshPhysicalMaterial({
    color: "#6d9bb3",
    roughness: 0.1,
    metalness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    envMapIntensity: 2.2,
  }),
  night: new THREE.MeshPhysicalMaterial({
    color: "#456978",
    roughness: 0.13,
    metalness: 0.16,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.15,
    emissive: new THREE.Color("#8ab4c5"),
    emissiveIntensity: 0.16,
  }),
};

const BUILDING_CORE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#65747c",
  roughness: 0.36,
  metalness: 0.26,
  envMapIntensity: 1.1,
});

const BUILDING_ACCENT_MATERIALS = BUILDING_STYLES.map(
  (style) =>
    new THREE.MeshStandardMaterial({
      color: style.accentColor,
      metalness: 0.54,
      roughness: 0.24,
      envMapIntensity: 1.05,
    }),
);

const BUILDING_FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#aebbc2",
  metalness: 0.62,
  roughness: 0.2,
  envMapIntensity: 1.28,
});

const BUILDING_DARK_FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#465965",
  metalness: 0.46,
  roughness: 0.28,
  envMapIntensity: 1.02,
});

const BUILDING_ROOF_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#aeb6bb",
  map: CONCRETE_MAP,
  roughness: 0.8,
  metalness: 0.08,
});
const BUILDING_ROOFTOP_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#28353f",
  roughness: 0.54,
  metalness: 0.2,
});
const BUILDING_BALCONY_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#c7c6bf",
  map: CONCRETE_MAP,
  roughness: 0.88,
});
const BUILDING_RAIL_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#5c666b",
  metalness: 0.62,
  roughness: 0.35,
});
const BUILDING_STOREFRONT_MATERIALS = {
  day: new THREE.MeshStandardMaterial({
    color: "#183845",
    roughness: 0.14,
    metalness: 0.42,
    envMapIntensity: 1.1,
  }),
  night: new THREE.MeshStandardMaterial({
    color: "#17323d",
    roughness: 0.17,
    metalness: 0.38,
    emissive: new THREE.Color("#5d8491"),
    emissiveIntensity: 0.2,
    envMapIntensity: 0.7,
  }),
};

const BUILDING_STOREFRONT_DIVIDER_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#5a6468",
  metalness: 0.68,
  roughness: 0.34,
});
const BUILDING_AC_MATERIAL = new THREE.MeshStandardMaterial({ color: "#d3d4ce", roughness: 0.72 });
const BUILDING_AC_FAN_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#727b7e",
  metalness: 0.36,
  roughness: 0.48,
});


function signatureGlassTexture(
  seed: number,
  top: [number, number, number],
  bottom: [number, number, number],
  warm = false,
) {
  const width = 128;
  const height = 256;
  const random = seeded(seed);
  const data = new Uint8Array(width * height * 4);
  const reflectionCenter = 26 + random() * 70;
  const reflectionWidth = 16 + random() * 14;

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const floorLine = y % 19 <= 1;
      const mullion = x % 10 <= 1;
      const reflection = Math.max(
        0,
        1 - Math.abs(x - reflectionCenter) / reflectionWidth,
      );
      const softSky = 1 - v;
      const baseR = THREE.MathUtils.lerp(top[0], bottom[0], v);
      const baseG = THREE.MathUtils.lerp(top[1], bottom[1], v);
      const baseB = THREE.MathUtils.lerp(top[2], bottom[2], v);
      const grain = (Math.sin(x * 0.1 + y * 0.045 + seed) + 1) * 1.4;
      const frameShade = mullion ? 0.54 : floorLine ? 0.72 : 1;
      const warmLift = warm ? reflection * 28 : reflection * 10;

      data[i] = THREE.MathUtils.clamp(
        baseR * frameShade + reflection * 18 + softSky * 8 + warmLift + grain,
        0,
        255,
      );
      data[i + 1] = THREE.MathUtils.clamp(
        baseG * frameShade + reflection * 24 + softSky * 12 + warmLift * 0.65 + grain,
        0,
        255,
      );
      data[i + 2] = THREE.MathUtils.clamp(
        baseB * frameShade + reflection * 34 + softSky * 16 + grain,
        0,
        255,
      );
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const SIGNATURE_GLASS_MAPS = {
  blue: signatureGlassTexture(441, [118, 171, 204], [38, 82, 108], false),
  dark: signatureGlassTexture(552, [92, 132, 159], [28, 57, 76], false),
  bronze: signatureGlassTexture(663, [192, 148, 98], [83, 58, 42], true),
};

const SIGNATURE_GLASS_MATERIALS = {
  blue: {
    day: new THREE.MeshPhysicalMaterial({
      color: "#b2d2e5",
      map: SIGNATURE_GLASS_MAPS.blue,
      roughness: 0.1,
      metalness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.075,
      envMapIntensity: 2.15,
    }),
    night: new THREE.MeshPhysicalMaterial({
      color: "#628aa3",
      map: SIGNATURE_GLASS_MAPS.blue,
      roughness: 0.17,
      metalness: 0.3,
      clearcoat: 0.78,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.15,
      emissive: new THREE.Color("#173347"),
      emissiveIntensity: 0.2,
    }),
  },
  dark: {
    day: new THREE.MeshPhysicalMaterial({
      color: "#8fabbc",
      map: SIGNATURE_GLASS_MAPS.dark,
      roughness: 0.11,
      metalness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 2.05,
    }),
    night: new THREE.MeshPhysicalMaterial({
      color: "#48687b",
      map: SIGNATURE_GLASS_MAPS.dark,
      roughness: 0.18,
      metalness: 0.33,
      clearcoat: 0.82,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.05,
      emissive: new THREE.Color("#152b38"),
      emissiveIntensity: 0.18,
    }),
  },
  bronze: {
    day: new THREE.MeshPhysicalMaterial({
      color: "#c99a69",
      map: SIGNATURE_GLASS_MAPS.bronze,
      roughness: 0.12,
      metalness: 0.22,
      clearcoat: 0.98,
      clearcoatRoughness: 0.09,
      envMapIntensity: 1.95,
    }),
    night: new THREE.MeshPhysicalMaterial({
      color: "#825b43",
      map: SIGNATURE_GLASS_MAPS.bronze,
      roughness: 0.19,
      metalness: 0.3,
      clearcoat: 0.74,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1,
      emissive: new THREE.Color("#392318"),
      emissiveIntensity: 0.16,
    }),
  },
};

const SIGNATURE_GLASS_MATERIAL_SET = new Set<THREE.Material>([
  SIGNATURE_GLASS_MATERIALS.blue.day,
  SIGNATURE_GLASS_MATERIALS.blue.night,
  SIGNATURE_GLASS_MATERIALS.dark.day,
  SIGNATURE_GLASS_MATERIALS.dark.night,
  SIGNATURE_GLASS_MATERIALS.bronze.day,
  SIGNATURE_GLASS_MATERIALS.bronze.night,
]);

const PREMIUM_CITY_MODEL_URL = "/models/premium_city_buildings.glb";


const SIGNATURE_CORE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#53656f",
  roughness: 0.3,
  metalness: 0.36,
  envMapIntensity: 1.08,
});
const SIGNATURE_FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#b7c2c8",
  roughness: 0.2,
  metalness: 0.68,
  envMapIntensity: 1.35,
});
const SIGNATURE_WARM_FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#866548",
  roughness: 0.28,
  metalness: 0.46,
});
const SIGNATURE_STONE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#b6b2aa",
  map: CONCRETE_MAP,
  roughness: 0.82,
  metalness: 0.06,
});
const SIGNATURE_LIGHT_STONE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#d8d7d2",
  map: CONCRETE_MAP,
  roughness: 0.76,
  metalness: 0.04,
});
const CITY_GRASS_MAP = noiseTexture(96, [88, 118, 67], 34, [5, 5], 991);
const CITY_GRASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#668451",
  map: CITY_GRASS_MAP,
  roughness: 1,
});
const CITY_PATH_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#b6b4ad",
  map: CONCRETE_MAP,
  roughness: 0.95,
});
const CITY_TREE_TRUNK_GEOMETRY = new THREE.CylinderGeometry(0.08, 0.12, 1.2, 7);
const CITY_TREE_CROWN_GEOMETRY = new THREE.IcosahedronGeometry(0.72, 1);
const CITY_TREE_TRUNK_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#5d4631",
  roughness: 0.96,
});
const CITY_TREE_CROWN_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#42663d",
  roughness: 0.95,
});

const STREETLIGHT_BASE_GEOMETRY = new THREE.CylinderGeometry(0.25, 0.3, 0.16, 12);
const STREETLIGHT_POLE_GEOMETRY = new THREE.CylinderGeometry(0.065, 0.14, 6.5, 12);
const STREETLIGHT_BASE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#6e7374",
  metalness: 0.62,
  roughness: 0.42,
});
const STREETLIGHT_METAL_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#757b7c",
  metalness: 0.7,
  roughness: 0.36,
});
const STREETLIGHT_LAMP_MATERIALS = {
  day: new THREE.MeshStandardMaterial({ color: "#c8c9c2" }),
  night: new THREE.MeshStandardMaterial({
    color: "#fff2c8",
    emissive: new THREE.Color("#ffd88c"),
    emissiveIntensity: 2.8 * STREET_NIGHT_LIGHT_RATIO,
  }),
};

const METRO_DECK_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#b7b3aa",
  map: STRUCTURAL_CONCRETE_MAP,
  bumpMap: STRUCTURAL_CONCRETE_MAP,
  bumpScale: 0.022,
  roughness: 0.92,
});
const METRO_PARAPET_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#c0bcb3",
  map: STRUCTURAL_CONCRETE_MAP,
  bumpMap: STRUCTURAL_CONCRETE_MAP,
  bumpScale: 0.018,
  roughness: 0.9,
});
const METRO_RAIL_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#4c5052",
  metalness: 0.82,
  roughness: 0.28,
});
const METRO_SLEEPER_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#5b5550",
  roughness: 0.78,
  metalness: 0.18,
});
const METRO_COLUMN_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#aaa79f",
  map: STRUCTURAL_CONCRETE_MAP,
  bumpMap: STRUCTURAL_CONCRETE_MAP,
  bumpScale: 0.026,
  roughness: 0.94,
});
const METRO_COLUMN_CAP_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#b0aca3",
  map: STRUCTURAL_CONCRETE_MAP,
  bumpMap: STRUCTURAL_CONCRETE_MAP,
  bumpScale: 0.02,
  roughness: 0.92,
});

const METRO_PIER_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const METRO_FOOTING_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const METRO_BEARING_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#3a3e40",
  roughness: 0.56,
  metalness: 0.38,
});
const METRO_EXPANSION_JOINT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#4a4b49",
  roughness: 0.72,
  metalness: 0.22,
});

const METRO_EDGE_BEAM_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#a19e96",
  map: STRUCTURAL_CONCRETE_MAP,
  bumpMap: STRUCTURAL_CONCRETE_MAP,
  bumpScale: 0.024,
  roughness: 0.93,
});

const UNIPOLE_POLE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#8e9699",
  map: STEEL_MAP,
  roughness: 0.34,
  metalness: 0.66,
  envMapIntensity: 1.1,
});
const UNIPOLE_FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#6f777b",
  map: STEEL_MAP,
  roughness: 0.32,
  metalness: 0.72,
  envMapIntensity: 1.08,
});
const UNIPOLE_DARK_STEEL_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#474f53",
  map: STEEL_MAP,
  roughness: 0.35,
  metalness: 0.7,
});
const UNIPOLE_BASE_PLATE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#5d6467",
  map: STEEL_MAP,
  roughness: 0.3,
  metalness: 0.78,
});
const UNIPOLE_CONCRETE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#aaa9a4",
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.025,
  roughness: 0.94,
});


/* -------------------------------------------------------------------------- */
/*                              MATH HELPERS                                  */
/* -------------------------------------------------------------------------- */

function clamp01(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function positiveModulo(value: number, length: number) {
  return ((value % length) + length) % length;
}

function motionAlpha(delta: number, response = 18) {
  return 1 - Math.exp(-response * Math.min(delta, MAX_MOTION_FRAME_DELTA));
}

function smoothAngle(current: number, target: number, alpha: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * alpha;
}

function smooth(value: number, from: number, to: number) {
  return THREE.MathUtils.smoothstep(value, from, to);
}

function windowed(value: number, enter: [number, number], leave: [number, number]) {
  return smooth(value, enter[0], enter[1]) * (1 - smooth(value, leave[0], leave[1]));
}

function roadBend(z: number) {
  const nearT = clamp01((-z - 28) / 148);
  const nearEase = nearT * nearT * (3 - 2 * nearT);

  const farT = clamp01((-z - 176) / 160);
  const farEase = farT * farT * (3 - 2 * farT);

  return nearEase * 18 + farEase * 7;
}

function roadElevation(z: number) {
  const t = clamp01((-z - 88) / 248);
  const eased = t * t * (3 - 2 * t);
  return eased * 2.65;
}

function roadYaw(z: number) {
  const step = 0.35;
  return Math.atan2(roadBend(z + step) - roadBend(z - step), step * 2);
}

function roadPitch(z: number) {
  const step = 0.5;
  const slope =
    (roadElevation(z + step) - roadElevation(z - step)) / (step * 2);
  return -Math.atan(slope);
}

function roadPosition(z: number, lateralOffset: number, y = 0): Vec3 {
  const yaw = roadYaw(z);
  return [
    roadBend(z) + Math.cos(yaw) * lateralOffset,
    roadElevation(z) + y,
    z - Math.sin(yaw) * lateralOffset,
  ];
}

const METRO_CURVE = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-16.2, 8.45, 58),
    new THREE.Vector3(-16.3, 8.45, 24),
    new THREE.Vector3(-16.8, 8.45, -14),
    new THREE.Vector3(-15.4, 8.45, -50),
    new THREE.Vector3(-11.4, 8.45, -85),
    new THREE.Vector3(-3.2, 8.45, -124),
    new THREE.Vector3(8.5, 8.45, -180),
  ],
  false,
  "catmullrom",
  0.32,
);
const METRO_CURVE_LENGTH = METRO_CURVE.getLength();

function metroFrame(t: number) {
  const safeT = THREE.MathUtils.clamp(t, 0.001, 0.999);
  const point = METRO_CURVE.getPointAt(safeT);
  const tangent = METRO_CURVE.getTangentAt(safeT).normalize();
  return { point, tangent, yaw: Math.atan2(tangent.x, tangent.z) };
}

/* -------------------------------------------------------------------------- */
/*                              CAMERA SYSTEM                                 */
/* -------------------------------------------------------------------------- */

function resolveCameraPose(progress: number, position: THREE.Vector3, target: THREE.Vector3) {
  const stageValue = clamp01(progress) * (CAMERA_POSES.length - 1);
  const fromIndex = Math.min(Math.floor(stageValue), CAMERA_POSES.length - 1);
  const toIndex = Math.min(fromIndex + 1, CAMERA_POSES.length - 1);
  const mix = THREE.MathUtils.smoothstep(stageValue - fromIndex, 0, 1);
  const fromPose = CAMERA_POSES[fromIndex];
  const toPose = CAMERA_POSES[toIndex];

  position.set(
    THREE.MathUtils.lerp(fromPose.position[0], toPose.position[0], mix),
    THREE.MathUtils.lerp(fromPose.position[1], toPose.position[1], mix),
    THREE.MathUtils.lerp(fromPose.position[2], toPose.position[2], mix),
  );
  target.set(
    THREE.MathUtils.lerp(fromPose.target[0], toPose.target[0], mix),
    THREE.MathUtils.lerp(fromPose.target[1], toPose.target[1], mix),
    THREE.MathUtils.lerp(fromPose.target[2], toPose.target[2], mix),
  );

  const zoomScale = THREE.MathUtils.lerp(1, 0.92, SCROLL_ZOOM_STRENGTH);
  position.set(
    target.x + (position.x - target.x) * zoomScale,
    target.y + (position.y - target.y) * zoomScale,
    target.z + (position.z - target.z) * zoomScale,
  );

  return THREE.MathUtils.lerp(fromPose.fov, toPose.fov, mix);
}

function StableScrollCamera({
  scrollRef,
  resetRef,
  controlsRef,
}: {
  scrollRef: ScrollRef;
  resetRef: MutableRefObject<number>;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
}) {
  const sceneCamera = useThree((state) => state.camera as THREE.PerspectiveCamera);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const owner = useRef<"scroll" | "controls">("scroll");
  const lastScrollProgress = useRef(-1);
  const lastScrollMotionAt = useRef(0);
  const lastReset = useRef(0);
  const pathPosition = useMemo(() => new THREE.Vector3(), []);
  const pathTarget = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    cameraRef.current = sceneCamera;
    return () => {
      if (cameraRef.current === sceneCamera) cameraRef.current = null;
    };
  }, [sceneCamera]);

  useFrame((state) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const requested = clamp01(scrollRef.current);
    const now = state.clock.elapsedTime;
    const controls = controlsRef.current;
    const resetRequested = resetRef.current !== lastReset.current;
    const progressChanged = Math.abs(requested - lastScrollProgress.current) > 0.000001;

    if (resetRequested) {
      lastReset.current = resetRef.current;
      owner.current = "scroll";
      lastScrollMotionAt.current = now;
    }

    if (progressChanged) {
      owner.current = "scroll";
      lastScrollMotionAt.current = now;
      lastScrollProgress.current = requested;
    }

    if (owner.current !== "scroll") return;

    if (controls) {
      controls.enabled = false;
      controls.enableDamping = false;
      controls.enablePan = false;
      controls.enableRotate = false;
    }

    const fov = resolveCameraPose(requested, pathPosition, pathTarget);
    camera.position.copy(pathPosition);
    if (Math.abs(camera.fov - fov) > 0.000001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(pathTarget);

    if (controls && now - lastScrollMotionAt.current >= CAMERA_IDLE_RELEASE_DELAY) {
      controls.target.copy(pathTarget);
      controls.minAzimuthAngle = CAMERA_MIN_AZIMUTH_ANGLE;
      controls.maxAzimuthAngle = CAMERA_MAX_AZIMUTH_ANGLE;
      controls.maxDistance = CAMERA_MAX_DISTANCE;
      controls.enablePan = true;
      controls.enableRotate = true;
      controls.enableDamping = false;
      controls.enabled = true;
      owner.current = "controls";
    }
  });
  return null;
}

function StaticSceneCamera() {
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera);

  useLayoutEffect(() => {
    const pose = CAMERA_POSES[0];
    camera.position.set(...pose.position);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(new THREE.Vector3(...pose.target));
  }, [camera]);

  return null;
}

function SmoothCinematicControls({
  onStart,
  onEnd,
}: {
  onStart: () => void;
  onEnd: () => void;
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const restingTarget = useMemo(
    () => new THREE.Vector3(...CAMERA_POSES[0].target),
    [],
  );

  useEffect(() => {
    const controls = new OrbitControlsImpl(camera, gl.domElement);
    controlsRef.current = controls;

    controls.target.copy(restingTarget);
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = false;

    // The important change: rotation, tilt and panning keep a small amount of
    // inertia after the pointer stops, instead of snapping to each drag event.
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.rotateSpeed = 0.28;
    controls.panSpeed = 0.32;
    controls.zoomSpeed = 0.45;
    controls.screenSpacePanning = true;

    const initialAzimuth = Math.atan2(
      camera.position.x - restingTarget.x,
      camera.position.z - restingTarget.z,
    );

    // Enough freedom to inspect the structure, but not enough to lose the
    // reference composition or expose unfinished backsides of the skyline.
    controls.minAzimuthAngle = initialAzimuth - 0.46;
    controls.maxAzimuthAngle = initialAzimuth + 0.46;
    controls.minPolarAngle = 1.005;
    controls.maxPolarAngle = 1.43;
    controls.minDistance = 18;
    controls.maxDistance = 48;

    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

    const clampTarget = () => {
      // Limited panning keeps the same road / bridge / UNIPOLE layout visible.
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -2.25, 2.8);
      controls.target.y = THREE.MathUtils.clamp(controls.target.y, 6.9, 10.5);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z, -21.5, -10.2);
    };

    const handleStart = () => onStart();
    const handleEnd = () => {
      clampTarget();
      onEnd();
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);
    controls.update();

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
      controls.dispose();
      if (controlsRef.current === controls) controlsRef.current = null;
    };
  }, [camera, gl, onEnd, onStart, restingTarget]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Clamp continuously while panning and then let OrbitControls perform its
    // damped interpolation. This is what makes both drag and tilt feel soft.
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -2.25, 2.8);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 6.9, 10.5);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -21.5, -10.2);
    controls.update();
  }, -5);

  return null;
}

function ManagedOrbitControls({
  controlsRef,
  onStart,
  onEnd,
}: {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  onStart: () => void;
  onEnd: () => void;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const controls = new OrbitControlsImpl(camera, gl.domElement);
    controls.target.set(0, 1.2, -6);
    controls.enableDamping = false;
    controls.enabled = false;
    controls.enablePan = false;
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.zoomSpeed = 0.55;
    controls.panSpeed = 0.48;
    controls.rotateSpeed = 0.42;
    controls.screenSpacePanning = true;
    controls.minPolarAngle = CAMERA_MIN_POLAR_ANGLE;
    controls.maxPolarAngle = CAMERA_MAX_POLAR_ANGLE;
    controls.minAzimuthAngle = CAMERA_MIN_AZIMUTH_ANGLE;
    controls.maxAzimuthAngle = CAMERA_MAX_AZIMUTH_ANGLE;
    controls.minDistance = CAMERA_MIN_DISTANCE;
    controls.maxDistance = CAMERA_MAX_DISTANCE;

    const handleStart = () => onStart();
    const handleEnd = () => {
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -2.4, 2.4);
      controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.2, 16.8);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z, -15, -2.5);
      controls.update();
      onEnd();
    };

    controls.addEventListener("start", handleStart);
    controls.addEventListener("end", handleEnd);
    controlsRef.current = controls;

    return () => {
      controls.removeEventListener("start", handleStart);
      controls.removeEventListener("end", handleEnd);
      controls.dispose();
      if (controlsRef.current === controls) controlsRef.current = null;
    };
  }, [camera, controlsRef, gl, onEnd, onStart]);

  return null;
}

function RendererController({ isNight }: { isNight: boolean }) {
  const renderer = useThree((state) => state.gl);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useLayoutEffect(() => {
    rendererRef.current = renderer;
    return () => {
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [renderer]);

  useEffect(() => {
    const gl = rendererRef.current;
    if (!gl) return;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = isNight ? 0.84 : 1.14;
  }, [isNight]);
  return null;
}

/* -------------------------------------------------------------------------- */
/*                           REUSABLE 3D PARTS                                */
/* -------------------------------------------------------------------------- */

function Beam({
  start,
  end,
  width = 0.1,
  color = "#737b80",
  castShadow = true,
}: {
  start: Vec3;
  end: Vec3;
  width?: number;
  color?: string;
  castShadow?: boolean;
}) {
  const { midpoint, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    return {
      midpoint: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
      length: direction.length(),
    };
  }, [end, start]);
  return (
    <mesh
      geometry={SHARED_UNIT_BOX_GEOMETRY}
      material={sharedBeamMaterial(color)}
      position={midpoint}
      quaternion={quaternion}
      scale={[width, length, width]}
      castShadow={castShadow}
      receiveShadow
      dispose={null}
    />
  );
}

function Person({ position, shirt = "#f2a43b" }: { position: Vec3; shirt?: string }) {
  return (
    <group position={position} scale={0.82}>
      <mesh position={[0, 1.64, 0]} castShadow>
        <sphereGeometry args={[0.17, 18, 14]} />
        <meshStandardMaterial color="#7d5038" roughness={0.9} />
      </mesh>
      <RoundedBox
        args={[0.48, 0.72, 0.25]}
        radius={0.1}
        smoothness={3}
        position={[0, 1.14, 0]}
        castShadow
      >
        <meshStandardMaterial color={shirt} roughness={0.72} />
      </RoundedBox>
      <mesh position={[0, 1.14, 0.132]}>
        <planeGeometry args={[0.36, 0.64]} />
        <meshStandardMaterial
          color="#e9be43"
          emissive="#574313"
          emissiveIntensity={0.08}
          roughness={0.65}
        />
      </mesh>
      {[-0.15, 0.15].map((x) => (
        <mesh key={`leg-${x}`} position={[x, 0.43, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.52, 5, 9]} />
          <meshStandardMaterial color="#28323d" roughness={0.9} />
        </mesh>
      ))}
      {[-0.32, 0.32].map((x) => (
        <mesh
          key={`arm-${x}`}
          position={[x, 1.13, 0]}
          rotation={[0, 0, x < 0 ? -0.14 : 0.14]}
          castShadow
        >
          <capsuleGeometry args={[0.055, 0.48, 5, 9]} />
          <meshStandardMaterial color={shirt} roughness={0.76} />
        </mesh>
      ))}
      {[-0.15, 0.15].map((x) => (
        <mesh key={`boot-${x}`} position={[x, 0.08, 0.08]} castShadow>
          <boxGeometry args={[0.15, 0.1, 0.28]} />
          <meshStandardMaterial color="#161b1f" roughness={0.84} />
        </mesh>
      ))}
      <mesh position={[0, 1.83, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.23, 0.1, 18]} />
        <meshStandardMaterial color="#f0c337" roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.86, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.21, 0.21, 0.06, 18, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#f0c337" roughness={0.62} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                         ROAD AND LANDSCAPING                               */
/* -------------------------------------------------------------------------- */

const LANE_MARKING_OFFSETS = [-8.8, -4.8, 5.2, 9.6, 14.1];

function LaneMarkings() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const marks = useMemo(() => {
    const result: Array<{ offset: number; z: number }> = [];
    for (const offset of LANE_MARKING_OFFSETS) {
      for (let z = ROAD_MAX_Z; z >= ROAD_MIN_Z; z -= 7.2) result.push({ offset, z });
    }
    return result;
  }, []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    marks.forEach((mark, index) => {
      dummy.position.set(...roadPosition(mark.z, mark.offset, 0.036));
      dummy.rotation.set(0, roadYaw(mark.z), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [marks]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, marks.length]} receiveShadow>
      <boxGeometry args={[0.12, 0.025, 3.4]} />
      <meshStandardMaterial color="#e8e7df" roughness={0.78} />
    </instancedMesh>
  );
}


function RoadEdgeLines() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const marks = useMemo(() => {
    const result: Array<{ offset: number; z: number }> = [];
    const offsets = [-12.9, -1.45, 1.45, 18.9];
    for (let z = ROAD_MAX_Z; z >= ROAD_MIN_Z; z -= 5.4) {
      for (const offset of offsets) result.push({ offset, z });
    }
    return result;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    marks.forEach((mark, index) => {
      dummy.position.set(...roadPosition(mark.z, mark.offset, 0.042));
      dummy.rotation.set(0, roadYaw(mark.z), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [marks]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, marks.length]}>
      <boxGeometry args={[0.1, 0.02, 5.55]} />
      <meshStandardMaterial color="#f1f0e9" roughness={0.72} />
    </instancedMesh>
  );
}

function Curbs() {
  const whiteRef = useRef<THREE.InstancedMesh>(null);
  const blackRef = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    const white: Array<{ offset: number; z: number }> = [];
    const black: Array<{ offset: number; z: number }> = [];
    const edges = [-13.5, -1.05, 1.05, 19.5];
    let index = 0;
    for (let z = ROAD_MIN_Z; z <= ROAD_MAX_Z; z += 2) {
      for (const offset of edges) (index % 2 === 0 ? white : black).push({ offset, z });
      index += 1;
    }
    return { white, black };
  }, []);
  useLayoutEffect(() => {
    const apply = (
      mesh: THREE.InstancedMesh | null,
      values: Array<{ offset: number; z: number }>,
    ) => {
      if (!mesh) return;
      const dummy = new THREE.Object3D();
      values.forEach((item, index) => {
        dummy.position.set(...roadPosition(item.z, item.offset, 0.14));
        dummy.rotation.set(0, roadYaw(item.z), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    apply(whiteRef.current, positions.white);
    apply(blackRef.current, positions.black);
  }, [positions]);
  return (
    <>
      <instancedMesh
        ref={whiteRef}
        args={[undefined, undefined, positions.white.length]}
        receiveShadow
      >
        <boxGeometry args={[0.32, 0.28, 2.02]} />
        <meshStandardMaterial color="#e6e4dc" roughness={0.8} />
      </instancedMesh>
      <instancedMesh
        ref={blackRef}
        args={[undefined, undefined, positions.black.length]}
        receiveShadow
      >
        <boxGeometry args={[0.32, 0.28, 2.02]} />
        <meshStandardMaterial color="#22272a" roughness={0.88} />
      </instancedMesh>
    </>
  );
}

function MedianPlanting() {
  const stemsRef = useRef<THREE.InstancedMesh>(null);
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const flowersRef = useRef<THREE.InstancedMesh>(null);
  const plants = useMemo(() => {
    const random = seeded(120);
    const stems: Array<{ offset: number; z: number; y: number; s: Vec3 }> = [];
    const leaves: Array<{ offset: number; z: number; y: number; tilt: number; s: Vec3 }> = [];
    const flowers: Array<{ offset: number; z: number; y: number; s: Vec3 }> = [];
    for (let z = 38; z >= ROAD_MIN_Z + 8; z -= 4.2) {
      if (Math.abs(z + 6) < 6) continue;
      const centerX = (random() - 0.5) * 0.75;
      const height = 0.3 + random() * 0.2;
      stems.push({ offset: centerX, z, y: 0.36 + height / 2, s: [0.025, height, 0.025] });
      for (let i = 0; i < 7; i += 1) {
        const angle = (i / 7) * Math.PI * 2 + random() * 0.3;
        const radius = 0.12 + random() * 0.18;
        leaves.push({
          offset: centerX + Math.cos(angle) * radius,
          z: z + Math.sin(angle) * radius,
          y: 0.39 + random() * 0.22,
          tilt: angle,
          s: [0.07, 0.25 + random() * 0.12, 0.035],
        });
      }
      if (random() > 0.36) {
        flowers.push({ offset: centerX, z, y: 0.72 + random() * 0.12, s: [0.07, 0.08, 0.07] });
      }
    }
    return { stems, leaves, flowers };
  }, []);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    plants.stems.forEach((item, index) => {
      dummy.position.set(...roadPosition(item.z, item.offset, item.y));
      dummy.rotation.set(0, roadYaw(item.z), 0);
      dummy.scale.set(...item.s);
      dummy.updateMatrix();
      stemsRef.current?.setMatrixAt(index, dummy.matrix);
    });
    plants.leaves.forEach((item, index) => {
      dummy.position.set(...roadPosition(item.z, item.offset, item.y));
      dummy.rotation.set(Math.sin(item.tilt) * 0.5, roadYaw(item.z), -Math.cos(item.tilt) * 0.5);
      dummy.scale.set(...item.s);
      dummy.updateMatrix();
      leavesRef.current?.setMatrixAt(index, dummy.matrix);
    });
    plants.flowers.forEach((item, index) => {
      dummy.position.set(...roadPosition(item.z, item.offset, item.y));
      dummy.rotation.set(0, roadYaw(item.z), 0);
      dummy.scale.set(...item.s);
      dummy.updateMatrix();
      flowersRef.current?.setMatrixAt(index, dummy.matrix);
    });
    if (stemsRef.current) stemsRef.current.instanceMatrix.needsUpdate = true;
    if (leavesRef.current) leavesRef.current.instanceMatrix.needsUpdate = true;
    if (flowersRef.current) flowersRef.current.instanceMatrix.needsUpdate = true;
  }, [plants]);
  return (
    <>
      <instancedMesh
        ref={stemsRef}
        args={[undefined, undefined, plants.stems.length]}
        geometry={PLANT_STEM_GEOMETRY}
        material={PLANT_STEM_MATERIAL}
      />
      <instancedMesh
        ref={leavesRef}
        args={[undefined, undefined, plants.leaves.length]}
        geometry={PLANT_LEAF_GEOMETRY}
        material={PLANT_LEAF_MATERIAL}
      />
      <instancedMesh
        ref={flowersRef}
        args={[undefined, undefined, plants.flowers.length]}
        geometry={PLANT_FLOWER_GEOMETRY}
        material={PLANT_FLOWER_MATERIAL}
      />
    </>
  );
}

function CurvedRoadDeck() {
  const roadRef = useRef<THREE.InstancedMesh>(null);
  const leftWalkRef = useRef<THREE.InstancedMesh>(null);
  const rightWalkRef = useRef<THREE.InstancedMesh>(null);
  const medianRef = useRef<THREE.InstancedMesh>(null);
  const segments = useMemo(() => {
    const values: number[] = [];
    for (let z = ROAD_MAX_Z; z >= ROAD_MIN_Z; z -= 3.8) values.push(z);
    return values;
  }, []);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const setSegment = (
      mesh: THREE.InstancedMesh | null,
      index: number,
      z: number,
      offset: number,
      y: number,
      scale: Vec3,
    ) => {
      if (!mesh) return;
      dummy.position.set(...roadPosition(z, offset, y));
      dummy.rotation.set(roadPitch(z), roadYaw(z), 0);
      dummy.scale.set(...scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    };
    segments.forEach((z, index) => {
      setSegment(roadRef.current, index, z, 3, -0.015, [33, 0.12, 4.05]);
      setSegment(leftWalkRef.current, index, z, -15.4, 0.16, [3.5, 0.3, 4.05]);
      setSegment(rightWalkRef.current, index, z, 21.3, 0.16, [3.6, 0.3, 4.05]);
      setSegment(medianRef.current, index, z, 0, 0.17, [1.8, 0.32, 4.05]);
    });
    [roadRef, leftWalkRef, rightWalkRef, medianRef].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    });
  }, [segments]);
  return (
    <>
      <instancedMesh ref={roadRef} args={[undefined, undefined, segments.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#66696b"
          map={ASPHALT_MAP}
          bumpMap={ASPHALT_MAP}
          bumpScale={0.018}
          roughness={0.82}
          metalness={0.01}
          envMapIntensity={0.26}
        />
      </instancedMesh>
      <instancedMesh ref={leftWalkRef} args={[undefined, undefined, segments.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#aaa9a3" map={CONCRETE_MAP} roughness={0.95} />
      </instancedMesh>
      <instancedMesh
        ref={rightWalkRef}
        args={[undefined, undefined, segments.length]}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#aaa9a3" map={CONCRETE_MAP} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={medianRef} args={[undefined, undefined, segments.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8f918b" map={CONCRETE_MAP} roughness={0.94} />
      </instancedMesh>
    </>
  );
}


function DistantRoadContinuation() {
  const roadRef = useRef<THREE.InstancedMesh>(null);
  const leftWalkRef = useRef<THREE.InstancedMesh>(null);
  const rightWalkRef = useRef<THREE.InstancedMesh>(null);
  const medianRef = useRef<THREE.InstancedMesh>(null);
  const laneRef = useRef<THREE.InstancedMesh>(null);
  const edgeRef = useRef<THREE.InstancedMesh>(null);
  const barrierRef = useRef<THREE.InstancedMesh>(null);

  const segments = useMemo(() => {
    const values: number[] = [];
    for (let z = ROAD_MIN_Z - 5; z >= ROAD_HORIZON_Z; z -= 7.6) {
      values.push(z);
    }
    return values;
  }, []);

  const laneMarks = useMemo(() => {
    const marks: Array<{ z: number; offset: number }> = [];
    for (let z = ROAD_MIN_Z - 7; z >= ROAD_HORIZON_Z + 12; z -= 14.4) {
      for (const offset of LANE_MARKING_OFFSETS) {
        marks.push({ z, offset });
      }
    }
    return marks;
  }, []);

  const edgeMarks = useMemo(() => {
    const marks: Array<{ z: number; offset: number }> = [];
    for (let z = ROAD_MIN_Z - 5; z >= ROAD_HORIZON_Z + 8; z -= 7.2) {
      for (const offset of [-12.9, -1.45, 1.45, 18.9]) {
        marks.push({ z, offset });
      }
    }
    return marks;
  }, []);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();

    const placeSegment = (
      mesh: THREE.InstancedMesh | null,
      index: number,
      z: number,
      offset: number,
      y: number,
      scale: Vec3,
    ) => {
      if (!mesh) return;
      dummy.position.set(...roadPosition(z, offset, y));
      dummy.rotation.set(roadPitch(z), roadYaw(z), 0);
      dummy.scale.set(...scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    };

    segments.forEach((z, index) => {
      placeSegment(roadRef.current, index, z, 3, -0.015, [33, 0.12, 8.05]);
      placeSegment(leftWalkRef.current, index, z, -15.4, 0.16, [3.5, 0.3, 8.05]);
      placeSegment(rightWalkRef.current, index, z, 21.3, 0.16, [3.6, 0.3, 8.05]);
      placeSegment(medianRef.current, index, z, 0, 0.17, [1.8, 0.32, 8.05]);

      placeSegment(
        barrierRef.current,
        index * 2,
        z,
        -13.28,
        0.52,
        [0.18, 0.72, 8.02],
      );
      placeSegment(
        barrierRef.current,
        index * 2 + 1,
        z,
        19.28,
        0.52,
        [0.18, 0.72, 8.02],
      );
    });

    laneMarks.forEach((mark, index) => {
      dummy.position.set(...roadPosition(mark.z, mark.offset, 0.041));
      dummy.rotation.set(roadPitch(mark.z), roadYaw(mark.z), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      laneRef.current?.setMatrixAt(index, dummy.matrix);
    });

    edgeMarks.forEach((mark, index) => {
      dummy.position.set(...roadPosition(mark.z, mark.offset, 0.043));
      dummy.rotation.set(roadPitch(mark.z), roadYaw(mark.z), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      edgeRef.current?.setMatrixAt(index, dummy.matrix);
    });

    [
      roadRef,
      leftWalkRef,
      rightWalkRef,
      medianRef,
      laneRef,
      edgeRef,
      barrierRef,
    ].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    });
  }, [edgeMarks, laneMarks, segments]);

  return (
    <group dispose={null}>
      <instancedMesh
        ref={roadRef}
        args={[undefined, undefined, segments.length]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
      >
        <meshStandardMaterial
          color="#696c6e"
          map={ASPHALT_MAP}
          bumpMap={ASPHALT_MAP}
          bumpScale={0.016}
          roughness={0.83}
          metalness={0.01}
          envMapIntensity={0.3}
        />
      </instancedMesh>

      <instancedMesh
        ref={leftWalkRef}
        args={[undefined, undefined, segments.length]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
      >
        <meshStandardMaterial
          color="#b8b5ae"
          map={CONCRETE_MAP}
          bumpMap={CONCRETE_MAP}
          bumpScale={0.012}
          roughness={0.92}
        />
      </instancedMesh>

      <instancedMesh
        ref={rightWalkRef}
        args={[undefined, undefined, segments.length]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
      >
        <meshStandardMaterial
          color="#b8b5ae"
          map={CONCRETE_MAP}
          bumpMap={CONCRETE_MAP}
          bumpScale={0.012}
          roughness={0.92}
        />
      </instancedMesh>

      <instancedMesh
        ref={medianRef}
        args={[undefined, undefined, segments.length]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
      >
        <meshStandardMaterial
          color="#8d8f89"
          map={CONCRETE_MAP}
          roughness={0.94}
        />
      </instancedMesh>

      <instancedMesh
        ref={laneRef}
        args={[undefined, undefined, laneMarks.length]}
      >
        <boxGeometry args={[0.11, 0.022, 5.6]} />
        <meshStandardMaterial color="#e8e7df" roughness={0.68} />
      </instancedMesh>

      <instancedMesh
        ref={edgeRef}
        args={[undefined, undefined, edgeMarks.length]}
      >
        <boxGeometry args={[0.1, 0.022, 7.4]} />
        <meshStandardMaterial color="#f2f0e8" roughness={0.7} />
      </instancedMesh>

      <instancedMesh
        ref={barrierRef}
        args={[undefined, undefined, segments.length * 2]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
      >
        <meshStandardMaterial
          color="#a8a7a1"
          map={STRUCTURAL_CONCRETE_MAP}
          bumpMap={STRUCTURAL_CONCRETE_MAP}
          bumpScale={0.018}
          roughness={0.94}
        />
      </instancedMesh>
    </group>
  );
}

function DistantRoadsideLandscape() {
  const treeTrunkRef = useRef<THREE.InstancedMesh>(null);
  const treeCrownRef = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(() => {
    const random = seeded(884);
    return Array.from({ length: 34 }, (_, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const z = -185 - Math.floor(index / 2) * 8.7 - random() * 4;
      const offset =
        side < 0
          ? -18.8 - random() * 5.2
          : 24.5 + random() * 5.6;
      const scale = 0.48 + random() * 0.55;
      return { z, offset, scale };
    });
  }, []);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();

    trees.forEach((tree, index) => {
      const base = roadPosition(tree.z, tree.offset, 0);

      dummy.position.set(base[0], base[1] + 0.48 * tree.scale, base[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(tree.scale, tree.scale, tree.scale);
      dummy.updateMatrix();
      treeTrunkRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(base[0], base[1] + 1.55 * tree.scale, base[2]);
      dummy.scale.set(
        tree.scale * 1.05,
        tree.scale * 1.15,
        tree.scale * 1.05,
      );
      dummy.updateMatrix();
      treeCrownRef.current?.setMatrixAt(index, dummy.matrix);
    });

    if (treeTrunkRef.current) treeTrunkRef.current.instanceMatrix.needsUpdate = true;
    if (treeCrownRef.current) treeCrownRef.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  return (
    <group dispose={null}>
      <instancedMesh
        ref={treeTrunkRef}
        args={[undefined, undefined, trees.length]}
        geometry={CITY_TREE_TRUNK_GEOMETRY}
        material={CITY_TREE_TRUNK_MATERIAL}
      />
      <instancedMesh
        ref={treeCrownRef}
        args={[undefined, undefined, trees.length]}
        geometry={CITY_TREE_CROWN_GEOMETRY}
        material={CITY_TREE_CROWN_MATERIAL}
      />
    </group>
  );
}

function RoadSurface() {
  return (
    <group dispose={null}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, -0.18, -132]} receiveShadow>
        <planeGeometry args={[760, 760]} />
        <meshStandardMaterial color="#6d756a" roughness={1} />
      </mesh>
      <CurvedRoadDeck />
      <DistantRoadContinuation />
      <DistantRoadsideLandscape />
      <LaneMarkings />
      <RoadEdgeLines />
      <Curbs />
      <MedianPlanting />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                              STREETLIGHTS                                  */
/* -------------------------------------------------------------------------- */

const STREETLIGHT_ARM_GEOMETRY = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 6.45, 0),
    new THREE.Vector3(0.22, 6.82, 0),
    new THREE.Vector3(0.72, 7.02, 0),
    new THREE.Vector3(1.45, 7.02, 0),
  ]),
  18,
  0.055,
  8,
  false,
);

function worldPartMatrix(
  rootPosition: Vec3,
  rootYaw: number,
  localPosition: Vec3,
  localRotation: Vec3 = [0, 0, 0],
  localScale: Vec3 = [1, 1, 1],
) {
  const root = new THREE.Matrix4().compose(
    new THREE.Vector3(...rootPosition),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rootYaw, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(...localPosition),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...localRotation)),
    new THREE.Vector3(...localScale),
  );
  return root.multiply(local);
}

function createStreetlightInstances() {
  const bases: THREE.Matrix4[] = [];
  const poles: THREE.Matrix4[] = [];
  const accessPanels: THREE.Matrix4[] = [];
  const leftArms: THREE.Matrix4[] = [];
  const rightArms: THREE.Matrix4[] = [];
  const heads: THREE.Matrix4[] = [];
  const lampFaces: THREE.Matrix4[] = [];
  const liveLights: Vec3[] = [];

  for (let z = 36; z >= ROAD_MIN_Z + 12; z -= 12) {
    ([{ z, side: -1 }, { z: z - 5.6, side: 1 }] as Array<{ z: number; side: -1 | 1 }>).forEach(
      (spec) => {
        const inward = spec.side === -1 ? 1 : -1;
        const offset = spec.side === -1 ? -13.1 : 19.1;
        const root = roadPosition(spec.z, offset, 0.2);
        const yaw = roadYaw(spec.z);
        bases.push(worldPartMatrix(root, yaw, [0, 0.08, 0]));
        poles.push(worldPartMatrix(root, yaw, [0, 3.3, 0]));
        accessPanels.push(
          worldPartMatrix(root, yaw, [0, 0.72, inward * 0.115], [0, inward < 0 ? Math.PI : 0, 0], [0.13, 0.28, 0.035]),
        );
        (inward > 0 ? leftArms : rightArms).push(
          worldPartMatrix(root, yaw, [0, 0, 0], [0, inward > 0 ? 0 : Math.PI, 0]),
        );
        heads.push(
          worldPartMatrix(root, yaw, [inward * 1.62, 6.95, 0], [0, 0, -0.08 * inward], [0.9, 0.14, 0.38]),
        );
        lampFaces.push(
          worldPartMatrix(root, yaw, [inward * 1.62, 6.874, 0], [Math.PI / 2, 0, -0.08 * inward], [0.7, 0.24, 1]),
        );
        if (spec.z > -8 && spec.z < 14) {
          liveLights.push(roadPosition(spec.z, offset + inward * 1.58, 6.9));
        }
      },
    );
  }

  return { bases, poles, accessPanels, leftArms, rightArms, heads, lampFaces, liveLights };
}

const STREETLIGHT_INSTANCES = createStreetlightInstances();

function Streetlights({ isNight }: { isNight: boolean }) {
  return (
    <group dispose={null}>
      <BuildingInstanceBatch matrices={STREETLIGHT_INSTANCES.bases} geometry={STREETLIGHT_BASE_GEOMETRY} material={STREETLIGHT_BASE_MATERIAL} />
      <BuildingInstanceBatch matrices={STREETLIGHT_INSTANCES.poles} geometry={STREETLIGHT_POLE_GEOMETRY} material={STREETLIGHT_METAL_MATERIAL} />
      <BuildingInstanceBatch matrices={STREETLIGHT_INSTANCES.accessPanels} geometry={SHARED_UNIT_BOX_GEOMETRY} material={STREETLIGHT_METAL_MATERIAL} />
      <BuildingInstanceBatch matrices={STREETLIGHT_INSTANCES.leftArms} geometry={STREETLIGHT_ARM_GEOMETRY} material={STREETLIGHT_METAL_MATERIAL} />
      <BuildingInstanceBatch matrices={STREETLIGHT_INSTANCES.rightArms} geometry={STREETLIGHT_ARM_GEOMETRY} material={STREETLIGHT_METAL_MATERIAL} />
      <BuildingInstanceBatch matrices={STREETLIGHT_INSTANCES.heads} geometry={SHARED_UNIT_BOX_GEOMETRY} material={STREETLIGHT_METAL_MATERIAL} />
      <BuildingInstanceBatch
        matrices={STREETLIGHT_INSTANCES.lampFaces}
        geometry={SHARED_UNIT_PLANE_GEOMETRY}
        material={isNight ? STREETLIGHT_LAMP_MATERIALS.night : STREETLIGHT_LAMP_MATERIALS.day}
      />
      {isNight &&
        STREETLIGHT_INSTANCES.liveLights.map((position, index) => (
          <pointLight
            key={index}
            position={position}
            color="#ffe5b6"
            intensity={11 * STREET_NIGHT_LIGHT_RATIO}
            distance={16}
            decay={2}
          />
        ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 CITY                                       */
/* -------------------------------------------------------------------------- */

type BuildingSpec = {
  side: "left" | "right";
  position: Vec3;
  width: number;
  height: number;
  depth: number;
  facade: number;
  balconies: boolean;
};

function createBuildings(): BuildingSpec[] {
  const random = seeded(341);
  const result: BuildingSpec[] = [];

  // Secondary skyline buildings only. Large gaps are deliberate so the city
  // reads like a real business district instead of a wall of repeated boxes.
  for (const side of ["left", "right"] as const) {
    for (let i = 0; i < 7; i += 1) {
      const z = 31 - i * 27 + (random() - 0.5) * 4.2;
      const width = 8.2 + random() * 5.8;
      const depth = 8.8 + random() * 6.2;
      const height =
        i % 3 === 0
          ? 22 + random() * 12
          : i % 2 === 0
            ? 16 + random() * 9
            : 12 + random() * 7;

      const setback = 7.5 + random() * 8.5;
      const x = side === "left" ? -29.5 - setback : 30 - 0 + setback;
      const facadeRoll = random();
      const facade =
        facadeRoll > 0.84
          ? 4
          : facadeRoll > 0.66
            ? 5
            : facadeRoll > 0.48
              ? 0
              : facadeRoll > 0.3
                ? 2
                : facadeRoll > 0.14
                  ? 1
                  : 3;

      result.push({
        side,
        position: [x, height / 2 + 0.32, z],
        width,
        height,
        depth,
        facade,
        balconies: facade === 4 && random() > 0.68 && z > -38,
      });
    }
  }

  return result;
}

const BUILDINGS = createBuildings();

const NEAR_BUILDINGS = BUILDINGS.filter(
  (spec) => spec.position[2] > -NEAR_BUILDING_DETAIL_DISTANCE,
);

function buildingPartMatrix(
  spec: BuildingSpec,
  localPosition: Vec3,
  localRotation: Vec3,
  localScale: Vec3,
) {
  const z = spec.position[2];
  const rootPosition = new THREE.Vector3(spec.position[0] + roadBend(z), spec.position[1], z);
  const rootMatrix = new THREE.Matrix4().compose(
    rootPosition,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, roadYaw(z), 0)),
    new THREE.Vector3(1, 1, 1),
  );
  const localMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...localPosition),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...localRotation)),
    new THREE.Vector3(...localScale),
  );
  return rootMatrix.multiply(localMatrix);
}

function createBuildingShellInstances() {
  const glassMasses = Array.from({ length: BUILDING_STYLES.length }, () => [] as THREE.Matrix4[]);
  const podiums: THREE.Matrix4[] = [];
  const structuralFrames: THREE.Matrix4[] = [];
  const floorBands: THREE.Matrix4[] = [];
  const cores: THREE.Matrix4[] = [];
  const groundGlass: THREE.Matrix4[] = [];
  const canopies: THREE.Matrix4[] = [];
  const roofCaps: THREE.Matrix4[] = [];
  const rooftopDetails: THREE.Matrix4[] = [];

  BUILDINGS.forEach((spec, buildingIndex) => {
    const style = BUILDING_STYLES[spec.facade];
    const detailSide = spec.side === "left" ? 1 : -1;
    const frontZ = spec.depth / 2 + 0.012;
    const sideX = detailSide * (spec.width / 2 + 0.012);
    const wallBottom = -spec.height / 2;
    const wallTop = spec.height / 2;

    // Proper volumetric glass tower. Instanced boxes are still very cheap.
    glassMasses[spec.facade].push(
      buildingPartMatrix(
        spec,
        [0, 0, 0],
        [0, 0, 0],
        [spec.width, spec.height, spec.depth],
      ),
    );

    // Solid podium anchors the tower to the street instead of letting the
    // glass mass visually float.
    podiums.push(
      buildingPartMatrix(
        spec,
        [0, wallBottom + 1.55, 0],
        [0, 0, 0],
        [spec.width * 1.08, 3.1, spec.depth * 1.08],
      ),
    );

    // Glass lobby layer.
    groundGlass.push(
      buildingPartMatrix(
        spec,
        [0, wallBottom + 1.55, frontZ + 0.055],
        [0, 0, 0],
        [spec.width * 0.86, 2.2, 0.055],
      ),
      buildingPartMatrix(
        spec,
        [sideX + detailSide * 0.055, wallBottom + 1.55, 0],
        [0, 0, 0],
        [0.055, 2.2, spec.depth * 0.82],
      ),
    );

    // Slim mullions. More numerous than before, but still instanced in a
    // single draw call and far thinner than the previous white grid.
    const frontMullions = THREE.MathUtils.clamp(Math.round(spec.width / 1.35), 5, 10);
    for (let fin = 1; fin <= frontMullions; fin += 1) {
      const ratio = fin / (frontMullions + 1) - 0.5;
      structuralFrames.push(
        buildingPartMatrix(
          spec,
          [ratio * spec.width, 0, frontZ + 0.035],
          [0, 0, 0],
          [0.038, spec.height * 0.965, 0.05],
        ),
      );
    }

    const sideMullions = THREE.MathUtils.clamp(Math.round(spec.depth / 1.55), 4, 8);
    for (let fin = 1; fin <= sideMullions; fin += 1) {
      const ratio = fin / (sideMullions + 1) - 0.5;
      structuralFrames.push(
        buildingPartMatrix(
          spec,
          [sideX + detailSide * 0.035, 0, ratio * spec.depth],
          [0, 0, 0],
          [0.05, spec.height * 0.965, 0.038],
        ),
      );
    }

    // Realistic floor/spandrel rhythm instead of the previous oversized grid.
    const floorCount = THREE.MathUtils.clamp(Math.round(spec.height / 3.1), 5, 13);
    for (let floor = 1; floor < floorCount; floor += 1) {
      const y = wallBottom + (floor / floorCount) * spec.height;
      floorBands.push(
        buildingPartMatrix(
          spec,
          [0, y, frontZ + 0.031],
          [0, 0, 0],
          [spec.width * 0.985, 0.045, 0.045],
        ),
        buildingPartMatrix(
          spec,
          [sideX + detailSide * 0.031, y, 0],
          [0, 0, 0],
          [0.045, 0.045, spec.depth * 0.985],
        ),
      );
    }

    // Every few towers gets an architectural core / service strip so the
    // skyline does not read as cloned glass cuboids.
    if (buildingIndex % 3 !== 1) {
      const coreWidth = Math.max(0.7, spec.width * 0.11);
      cores.push(
        buildingPartMatrix(
          spec,
          [
            detailSide * (spec.width * 0.37),
            -0.2,
            -spec.depth * 0.34,
          ],
          [0, 0, 0],
          [coreWidth, spec.height * 0.92, spec.depth * 0.22],
        ),
      );
    }

    if (style.hasCanopy) {
      canopies.push(
        buildingPartMatrix(
          spec,
          [0, wallBottom + 2.75, frontZ + 0.72],
          [0, 0, 0],
          [spec.width * 0.58, 0.1, 1.42],
        ),
      );
    }

    // Thin crown / roof edge gives the silhouette a finished real-building look.
    roofCaps.push(
      buildingPartMatrix(
        spec,
        [0, wallTop - 0.18, frontZ + 0.035],
        [0, 0, 0],
        [spec.width * 0.985, 0.16, 0.055],
      ),
      buildingPartMatrix(
        spec,
        [sideX + detailSide * 0.035, wallTop - 0.18, 0],
        [0, 0, 0],
        [0.055, 0.16, spec.depth * 0.985],
      ),
    );

    if (spec.height > 18) {
      rooftopDetails.push(
        buildingPartMatrix(
          spec,
          [0, wallTop + 0.62, -spec.depth * 0.14],
          [0, 0, 0],
          [
            Math.min(2.8, spec.width * 0.24),
            1.1,
            Math.min(3.1, spec.depth * 0.3),
          ],
        ),
      );
    }
  });

  return {
    glassMasses,
    podiums,
    structuralFrames,
    floorBands,
    cores,
    groundGlass,
    canopies,
    roofCaps,
    rooftopDetails,
  };
}

const BUILDING_SHELL_INSTANCES = createBuildingShellInstances();

function BuildingInstanceBatch({
  matrices,
  geometry,
  material,
}: {
  matrices: THREE.Matrix4[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  if (matrices.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, matrices.length]}
      geometry={geometry}
      material={material}
    />
  );
}

function DistantBuildingFacades({ isNight }: { isNight: boolean }) {
  const facadeMaterials = isNight
    ? BUILDING_FACADE_MATERIALS.night
    : BUILDING_FACADE_MATERIALS.day;

  return (
    <group dispose={null}>
      {BUILDING_SHELL_INSTANCES.glassMasses.map((matrices, facade) => (
        <BuildingInstanceBatch
          key={`glass-${facade}`}
          matrices={matrices}
          geometry={SHARED_UNIT_BOX_GEOMETRY}
          material={facadeMaterials[facade]}
        />
      ))}

      <BuildingInstanceBatch
        matrices={BUILDING_SHELL_INSTANCES.podiums}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={SIGNATURE_STONE_MATERIAL}
      />

      <BuildingInstanceBatch
        matrices={BUILDING_SHELL_INSTANCES.structuralFrames}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={BUILDING_FRAME_MATERIAL}
      />

      <BuildingInstanceBatch
        matrices={BUILDING_SHELL_INSTANCES.floorBands}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={BUILDING_DARK_FRAME_MATERIAL}
      />

      <BuildingInstanceBatch
        matrices={BUILDING_SHELL_INSTANCES.cores}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={BUILDING_CORE_MATERIAL}
      />

      <BuildingInstanceBatch
        matrices={BUILDING_SHELL_INSTANCES.groundGlass}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={
          isNight
            ? BUILDING_LOBBY_GLASS_MATERIALS.night
            : BUILDING_LOBBY_GLASS_MATERIALS.day
        }
      />

      <BuildingInstanceBatch
        matrices={BUILDING_SHELL_INSTANCES.canopies}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={BUILDING_FRAME_MATERIAL}
      />

      <BuildingInstanceBatch
        matrices={BUILDING_SHELL_INSTANCES.roofCaps}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={BUILDING_FRAME_MATERIAL}
      />

      <BuildingInstanceBatch
        matrices={BUILDING_SHELL_INSTANCES.rooftopDetails}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={BUILDING_ROOFTOP_MATERIAL}
      />
    </group>
  );
}

function Building({ spec, isNight }: { spec: BuildingSpec; isNight: boolean }) {
  const innerX = spec.side === "left" ? spec.width / 2 + 0.012 : -spec.width / 2 - 0.012;
  const sideRotation = spec.side === "left" ? Math.PI / 2 : -Math.PI / 2;
  const detailSide = spec.side === "left" ? 1 : -1;
  const balconyLevels = spec.balconies
    ? Array.from({ length: Math.min(2, Math.max(1, Math.floor(spec.height / 5))) }, (_, i) => 2.8 + i * 4.2)
    : [];
  const z = spec.position[2];
  const position: Vec3 = [spec.position[0] + roadBend(z), spec.position[1], z];
  return (
    <group position={position} rotation={[0, roadYaw(z), 0]} dispose={null}>
      {balconyLevels.map((y) => (
        <group key={y} position={[detailSide * (spec.width / 2 + 0.32), y - spec.height / 2, 0]}>
          <mesh
            geometry={SHARED_UNIT_BOX_GEOMETRY}
            material={BUILDING_BALCONY_MATERIAL}
            scale={[0.62, 0.12, spec.depth * 0.78]}
          />
          <mesh
            geometry={SHARED_UNIT_BOX_GEOMETRY}
            material={BUILDING_RAIL_MATERIAL}
            position={[detailSide * 0.29, 0.32, 0]}
            scale={[0.045, 0.55, spec.depth * 0.76]}
          />
        </group>
      ))}
      {spec.position[2] > -NEAR_BUILDING_DETAIL_DISTANCE && (
        <group
          position={[innerX + detailSide * 0.035, -spec.height / 2 + 1.25, 0]}
          rotation={[0, sideRotation, 0]}
        >
          <mesh
            geometry={SHARED_UNIT_PLANE_GEOMETRY}
            material={
              isNight ? BUILDING_STOREFRONT_MATERIALS.night : BUILDING_STOREFRONT_MATERIALS.day
            }
            scale={[spec.depth * 0.88, 2.1, 1]}
          />
          {[-0.3, 0, 0.3].map((ratio) => (
            <mesh
              key={ratio}
              geometry={SHARED_UNIT_BOX_GEOMETRY}
              material={BUILDING_STOREFRONT_DIVIDER_MATERIAL}
              position={[ratio * spec.depth, 0, 0.025]}
              scale={[0.045, 2.05, 0.04]}
            />
          ))}
        </group>
      )}
      {spec.position[2] > -26 &&
        [-0.24, 0.24].map((ratio) => (
          <group
            key={ratio}
            position={[detailSide * (spec.width / 2 + 0.2), spec.height * ratio, spec.depth * 0.27]}
          >
            <mesh
              geometry={SHARED_UNIT_BOX_GEOMETRY}
              material={BUILDING_AC_MATERIAL}
              scale={[0.34, 0.58, 0.82]}
            />
            <mesh
              geometry={SHARED_UNIT_CIRCLE_GEOMETRY}
              material={BUILDING_AC_FAN_MATERIAL}
              position={[detailSide * 0.18, 0, 0]}
              rotation={[0, Math.PI / 2, 0]}
              scale={[0.13, 0.13, 1]}
            />
          </group>
        ))}
    </group>
  );
}


type SignatureTowerKind =
  | "slender-residential"
  | "twin-glass"
  | "stepped-terrace"
  | "bronze-office"
  | "offset-skyline"
  | "atrium-campus";

type SignatureTowerSpec = {
  kind: SignatureTowerKind;
  side: "left" | "right";
  z: number;
  offset: number;
  scale: number;
  yawOffset?: number;
};

const SIGNATURE_TOWERS: SignatureTowerSpec[] = [
  { kind: "slender-residential", side: "left", z: 24, offset: 34, scale: 1.02, yawOffset: 0.03 },
  { kind: "twin-glass", side: "right", z: 4, offset: 37, scale: 1.08, yawOffset: -0.04 },
  { kind: "stepped-terrace", side: "left", z: -48, offset: 37, scale: 1.0, yawOffset: 0.05 },
  { kind: "bronze-office", side: "right", z: -72, offset: 40, scale: 1.04, yawOffset: -0.03 },
  { kind: "offset-skyline", side: "left", z: -112, offset: 43, scale: 1.04, yawOffset: 0.02 },
  { kind: "atrium-campus", side: "right", z: -132, offset: 42, scale: 1.0, yawOffset: -0.02 },
];

function signatureMaterial(
  type: "blue" | "dark" | "bronze",
  isNight: boolean,
) {
  return SIGNATURE_GLASS_MATERIALS[type][isNight ? "night" : "day"];
}

function TowerMass({
  position,
  size,
  material,
}: {
  position: Vec3;
  size: Vec3;
  material: THREE.Material;
}) {
  const isGlass = SIGNATURE_GLASS_MATERIAL_SET.has(material);
  const mullionCount = isGlass
    ? Math.min(8, Math.max(4, Math.round(size[0] / 1.45)))
    : 0;
  const sideMullionCount = isGlass
    ? Math.min(5, Math.max(2, Math.round(size[2] / 2.1)))
    : 0;
  const floorBandCount = isGlass
    ? Math.min(11, Math.max(4, Math.floor(size[1] / 4.1)))
    : 0;

  return (
    <group position={position}>
      <RoundedBox
        args={size}
        radius={
          isGlass
            ? Math.min(0.42, Math.max(0.16, Math.min(size[0], size[2]) * 0.045))
            : 0.08
        }
        smoothness={3}
        material={material}
        castShadow={false}
        receiveShadow={false}
      />

      {isGlass && (
        <>
          {Array.from({ length: mullionCount }, (_, index) => {
            const ratio = (index + 1) / (mullionCount + 1) - 0.5;
            return (
              <mesh
                key={`front-m-${index}`}
                geometry={SHARED_UNIT_BOX_GEOMETRY}
                material={SIGNATURE_FRAME_MATERIAL}
                position={[ratio * size[0], 0, size[2] / 2 + 0.025]}
                scale={[0.045, size[1] * 0.965, 0.04]}
              />
            );
          })}

          {Array.from({ length: sideMullionCount }, (_, index) => {
            const ratio = (index + 1) / (sideMullionCount + 1) - 0.5;
            return (
              <mesh
                key={`side-m-${index}`}
                geometry={SHARED_UNIT_BOX_GEOMETRY}
                material={SIGNATURE_FRAME_MATERIAL}
                position={[size[0] / 2 + 0.025, 0, ratio * size[2]]}
                scale={[0.04, size[1] * 0.965, 0.045]}
              />
            );
          })}

          {Array.from({ length: floorBandCount - 1 }, (_, index) => {
            const ratio = (index + 1) / floorBandCount - 0.5;
            return (
              <group key={`floor-${index}`}>
                <mesh
                  geometry={SHARED_UNIT_BOX_GEOMETRY}
                  material={BUILDING_DARK_FRAME_MATERIAL}
                  position={[0, ratio * size[1], size[2] / 2 + 0.022]}
                  scale={[size[0] * 0.98, 0.045, 0.038]}
                />
                <mesh
                  geometry={SHARED_UNIT_BOX_GEOMETRY}
                  material={BUILDING_DARK_FRAME_MATERIAL}
                  position={[size[0] / 2 + 0.022, ratio * size[1], 0]}
                  scale={[0.038, 0.045, size[2] * 0.98]}
                />
              </group>
            );
          })}
        </>
      )}
    </group>
  );
}

function RoofGarden({
  position,
  size,
}: {
  position: Vec3;
  size: [number, number];
}) {
  return (
    <group position={position}>
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={SIGNATURE_STONE_MATERIAL}
        scale={[size[0], 0.18, size[1]]}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={CITY_GRASS_MATERIAL}
        position={[0, 0.12, 0]}
        scale={[size[0] * 0.86, 0.08, size[1] * 0.8]}
      />
    </group>
  );
}

function SignatureBuilding({
  spec,
  isNight,
}: {
  spec: SignatureTowerSpec;
  isNight: boolean;
}) {
  const roadZ = spec.z;
  const x = spec.side === "left" ? -spec.offset : spec.offset;
  const rootPosition: Vec3 = [roadBend(roadZ) + x, 0.18, roadZ];
  const rootYaw = roadYaw(roadZ) + (spec.yawOffset ?? 0);
  const blue = signatureMaterial("blue", isNight);
  const dark = signatureMaterial("dark", isNight);
  const bronze = signatureMaterial("bronze", isNight);

  return (
    <group position={rootPosition} rotation={[0, rootYaw, 0]} scale={spec.scale} dispose={null}>
      {spec.kind === "slender-residential" && (
        <>
          <TowerMass position={[0, 17, 0]} size={[6.2, 34, 7.2]} material={dark} />
          <TowerMass position={[2.3, 14.5, 0.55]} size={[2.1, 29, 7.65]} material={blue} />
          <TowerMass position={[-2.45, 12, -0.25]} size={[1.1, 24, 7.35]} material={SIGNATURE_CORE_MATERIAL} />
          {[-11, -6.2, -1.4, 3.4, 8.2].map((y) => (
            <mesh
              key={y}
              geometry={SHARED_UNIT_BOX_GEOMETRY}
              material={SIGNATURE_LIGHT_STONE_MATERIAL}
              position={[3.55, 17 + y, 0.62]}
              scale={[0.75, 0.14, 6.55]}
            />
          ))}
          <TowerMass position={[0, 1.65, 0.25]} size={[8.2, 3.3, 9.1]} material={SIGNATURE_STONE_MATERIAL} />
          <RoofGarden position={[0, 3.42, 0.15]} size={[7.5, 8.1]} />
          <TowerMass position={[0, 35.3, -0.35]} size={[4.8, 1.15, 5.2]} material={SIGNATURE_CORE_MATERIAL} />
        </>
      )}

      {spec.kind === "twin-glass" && (
        <>
          <TowerMass position={[-2.45, 16.5, 0.5]} size={[6.5, 33, 8.4]} material={blue} />
          <TowerMass position={[2.65, 20.2, -0.8]} size={[5.8, 40.4, 7.3]} material={dark} />
          <TowerMass position={[0.3, 2.1, 0.4]} size={[11.8, 4.2, 10.6]} material={SIGNATURE_STONE_MATERIAL} />
          <TowerMass position={[0.35, 6.3, 4.35]} size={[8.4, 2.2, 1.4]} material={SIGNATURE_FRAME_MATERIAL} />
          <RoofGarden position={[-1.6, 4.32, 0.55]} size={[7.6, 8.4]} />
          <TowerMass position={[2.65, 41.15, -0.8]} size={[4.5, 1.1, 5.7]} material={SIGNATURE_CORE_MATERIAL} />
        </>
      )}

      {spec.kind === "stepped-terrace" && (
        <>
          <TowerMass position={[-1.9, 8.2, 0]} size={[8.2, 16.4, 9]} material={blue} />
          <TowerMass position={[2.2, 12.2, -0.3]} size={[6.7, 24.4, 7.8]} material={dark} />
          <TowerMass position={[-3.05, 16.3, -0.7]} size={[4.7, 32.6, 6.4]} material={blue} />
          <RoofGarden position={[-1.95, 16.55, 0.1]} size={[7.2, 7.8]} />
          <RoofGarden position={[2.1, 24.55, -0.2]} size={[5.8, 6.9]} />
          <TowerMass position={[0, 1.45, 0.65]} size={[11.6, 2.9, 10.8]} material={SIGNATURE_LIGHT_STONE_MATERIAL} />
          <TowerMass position={[0, 3.3, 5.05]} size={[7.8, 0.18, 1.2]} material={SIGNATURE_FRAME_MATERIAL} />
        </>
      )}

      {spec.kind === "bronze-office" && (
        <>
          <TowerMass position={[-1.25, 15.2, 0]} size={[8.6, 30.4, 8.8]} material={bronze} />
          <TowerMass position={[3.5, 12.7, -0.6]} size={[3.1, 25.4, 7.4]} material={dark} />
          <TowerMass position={[-3.8, 15.2, 0.3]} size={[0.22, 28.7, 8.15]} material={SIGNATURE_WARM_FRAME_MATERIAL} />
          <TowerMass position={[0.1, 2.1, 0.5]} size={[11, 4.2, 10.3]} material={SIGNATURE_STONE_MATERIAL} />
          <TowerMass position={[0.1, 5.1, 5.1]} size={[7.5, 0.2, 1.4]} material={SIGNATURE_WARM_FRAME_MATERIAL} />
          <RoofGarden position={[0.4, 4.25, -0.1]} size={[8.4, 8.2]} />
        </>
      )}

      {spec.kind === "offset-skyline" && (
        <>
          <TowerMass position={[-2.4, 13.2, 0.4]} size={[6.6, 26.4, 7.6]} material={blue} />
          <TowerMass position={[1.25, 20.4, -0.65]} size={[7.2, 40.8, 8.2]} material={dark} />
          <TowerMass position={[3.5, 29.2, -0.1]} size={[3.4, 16.8, 6.7]} material={blue} />
          <TowerMass position={[-0.5, 2, 0.6]} size={[11.4, 4, 10.2]} material={SIGNATURE_STONE_MATERIAL} />
          <TowerMass position={[1.2, 41.35, -0.7]} size={[5.6, 1.15, 6.4]} material={SIGNATURE_CORE_MATERIAL} />
        </>
      )}

      {spec.kind === "atrium-campus" && (
        <>
          <TowerMass position={[-3.45, 8.4, 0]} size={[5.2, 16.8, 8.4]} material={dark} />
          <TowerMass position={[3.45, 8.4, 0]} size={[5.2, 16.8, 8.4]} material={blue} />
          <TowerMass position={[0, 2.15, 0.2]} size={[12.4, 4.3, 10.2]} material={SIGNATURE_STONE_MATERIAL} />
          <TowerMass position={[0, 9.2, -3.55]} size={[3.1, 2.4, 1.1]} material={SIGNATURE_FRAME_MATERIAL} />
          <RoofGarden position={[0, 4.38, 0]} size={[10.5, 8.6]} />
          <TowerMass position={[0, 7.9, 4.2]} size={[7.4, 0.2, 1.25]} material={SIGNATURE_FRAME_MATERIAL} />
        </>
      )}
    </group>
  );
}

const CITY_GREEN_PLOTS = [
  { side: "left" as const, z: 2, offset: 47, width: 17, depth: 23, seed: 21 },
  { side: "right" as const, z: -28, offset: 49, width: 20, depth: 26, seed: 32 },
  { side: "left" as const, z: -78, offset: 51, width: 22, depth: 30, seed: 43 },
  { side: "right" as const, z: -108, offset: 52, width: 18, depth: 24, seed: 54 },
];

function CityGreenPlots() {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(() => {
    const result: Array<{ position: Vec3; yaw: number; scale: number }> = [];
    CITY_GREEN_PLOTS.forEach((plot) => {
      const random = seeded(plot.seed);
      const x = plot.side === "left" ? -plot.offset : plot.offset;
      const rootX = roadBend(plot.z) + x;
      const yaw = roadYaw(plot.z);
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);

      for (let i = 0; i < 9; i += 1) {
        const localX = (random() - 0.5) * plot.width * 0.82;
        const localZ = (random() - 0.5) * plot.depth * 0.82;
        result.push({
          position: [
            rootX + cos * localX + sin * localZ,
            0.68,
            plot.z - sin * localX + cos * localZ,
          ],
          yaw,
          scale: 0.75 + random() * 0.45,
        });
      }
    });
    return result;
  }, []);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    trees.forEach((tree, index) => {
      dummy.position.set(tree.position[0], tree.position[1], tree.position[2]);
      dummy.rotation.set(0, tree.yaw, 0);
      dummy.scale.set(tree.scale, tree.scale, tree.scale);
      dummy.updateMatrix();
      trunkRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(tree.position[0], tree.position[1] + 1.05 * tree.scale, tree.position[2]);
      dummy.scale.set(tree.scale * 1.1, tree.scale * 0.95, tree.scale * 1.1);
      dummy.updateMatrix();
      crownRef.current?.setMatrixAt(index, dummy.matrix);
    });
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true;
    if (crownRef.current) crownRef.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  return (
    <group dispose={null}>
      {CITY_GREEN_PLOTS.map((plot, index) => {
        const x = plot.side === "left" ? -plot.offset : plot.offset;
        return (
          <group
            key={index}
            position={[roadBend(plot.z) + x, 0.05, plot.z]}
            rotation={[0, roadYaw(plot.z), 0]}
          >
            <mesh
              geometry={SHARED_UNIT_BOX_GEOMETRY}
              material={CITY_GRASS_MATERIAL}
              scale={[plot.width, 0.12, plot.depth]}
            />
            <mesh
              geometry={SHARED_UNIT_BOX_GEOMETRY}
              material={CITY_PATH_MATERIAL}
              position={[0, 0.11, 0]}
              scale={[plot.width * 0.12, 0.05, plot.depth * 0.9]}
            />
            <mesh
              geometry={SHARED_UNIT_BOX_GEOMETRY}
              material={CITY_PATH_MATERIAL}
              position={[plot.width * 0.26, 0.11, -plot.depth * 0.13]}
              scale={[plot.width * 0.38, 0.05, plot.depth * 0.1]}
            />
          </group>
        );
      })}

      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, trees.length]}
        geometry={CITY_TREE_TRUNK_GEOMETRY}
        material={CITY_TREE_TRUNK_MATERIAL}
      />
      <instancedMesh
        ref={crownRef}
        args={[undefined, undefined, trees.length]}
        geometry={CITY_TREE_CROWN_GEOMETRY}
        material={CITY_TREE_CROWN_MATERIAL}
      />
    </group>
  );
}

function preparePremiumCityScene(scene: THREE.Group) {
  scene.traverse((object) => {
    object.updateMatrix();
    object.matrixAutoUpdate = false;

    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    const material = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;

    if (material?.name && !mesh.userData.premiumMaterialRole) {
      mesh.userData.premiumMaterialRole = material.name;
    }
  });
}

function applyPremiumCityMaterials(scene: THREE.Group, isNight: boolean) {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    const role = String(mesh.userData.premiumMaterialRole ?? "");

    if (role.includes("GlassBlue")) {
      mesh.material = signatureMaterial("blue", isNight);
    } else if (role.includes("GlassDark")) {
      mesh.material = signatureMaterial("dark", isNight);
    } else if (role.includes("GlassBronze")) {
      mesh.material = signatureMaterial("bronze", isNight);
    } else if (role.includes("MetalFrame")) {
      mesh.material = SIGNATURE_FRAME_MATERIAL;
    } else if (role.includes("Core")) {
      mesh.material = SIGNATURE_CORE_MATERIAL;
    } else if (role.includes("Stone")) {
      mesh.material = SIGNATURE_STONE_MATERIAL;
    } else if (role.includes("RoofGreen")) {
      mesh.material = CITY_GRASS_MATERIAL;
    }
  });
}

function PremiumHeroCityModelV1({ isNight }: { isNight: boolean }) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();

    loader.load(
      PREMIUM_CITY_MODEL_URL,
      (gltf) => {
        if (cancelled) return;
        preparePremiumCityScene(gltf.scene);
        applyPremiumCityMaterials(gltf.scene, isNight);
        setScene(gltf.scene);
        setFailed(false);
      },
      undefined,
      () => {
        if (!cancelled) setFailed(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scene) return;
    applyPremiumCityMaterials(scene, isNight);
  }, [isNight, scene]);

  // No hard dependency: if the GLB has not been copied yet, the existing
  // procedural skyline remains visible and the page never crashes.
  if (!scene || failed) {
    return <SignatureSkyline isNight={isNight} />;
  }

  return <primitive object={scene} />;
}

function SignatureSkyline({ isNight }: { isNight: boolean }) {
  return (
    <group dispose={null}>
      {SIGNATURE_TOWERS.map((spec) => (
        <SignatureBuilding
          key={`${spec.kind}-${spec.side}-${spec.z}`}
          spec={spec}
          isNight={isNight}
        />
      ))}
    </group>
  );
}

function City({ isNight }: { isNight: boolean }) {
  return (
    <group dispose={null}>
      <CityGreenPlots />
      <PremiumHeroCityModelV1 isNight={isNight} />
      {NEAR_BUILDINGS.slice(0, 2).map((spec, index) => (
        <Building key={`${spec.side}-${index}`} spec={spec} isNight={isNight} />
      ))}
      <DistantBuildingFacades isNight={isNight} />
    </group>
  );
}


/* -------------------------------------------------------------------------- */
/*                    REAL ARCHITECTURAL CITY V3                             */
/* -------------------------------------------------------------------------- */

/*
  This skyline is intentionally self-contained. It does NOT depend on an
  external building GLB, so replacing this single file immediately changes the
  visible city. The old procedural/GLB city remains above only as an unused
  fallback reference and is not mounted by Scene anymore.
*/

function realGlassReflectionMapV3(
  seed: number,
  top: [number, number, number],
  bottom: [number, number, number],
) {
  const width = 256;
  const height = 512;
  const random = seeded(seed);
  const data = new Uint8Array(width * height * 4);
  const bands = Array.from({ length: 5 }, () => ({
    center: 0.08 + random() * 0.84,
    width: 0.05 + random() * 0.12,
    strength: 10 + random() * 32,
  }));

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    const horizon = Math.exp(-Math.pow((v - 0.56) / 0.1, 2));

    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const i = (y * width + x) * 4;
      let reflection = 0;

      for (const band of bands) {
        reflection +=
          Math.exp(-Math.pow((u - band.center) / band.width, 2)) *
          band.strength;
      }

      const sky = Math.pow(1 - v, 0.7) * 18;
      const cloud =
        Math.max(0, Math.sin(u * 18 + v * 4.5 + seed) * 0.5 + 0.5) *
        Math.max(0, Math.sin(v * 13 + seed * 0.3)) *
        8;
      const grain = (random() - 0.5) * 3.2;

      data[i] = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(top[0], bottom[0], v) +
          reflection * 0.55 +
          horizon * 12 +
          sky +
          cloud +
          grain,
        0,
        255,
      );
      data[i + 1] = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(top[1], bottom[1], v) +
          reflection * 0.72 +
          horizon * 16 +
          sky +
          cloud +
          grain,
        0,
        255,
      );
      data[i + 2] = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(top[2], bottom[2], v) +
          reflection +
          horizon * 22 +
          sky * 1.25 +
          cloud +
          grain,
        0,
        255,
      );
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const REAL_GLASS_BLUE_MAP_V3 = realGlassReflectionMapV3(
  1901,
  [150, 199, 225],
  [55, 100, 128],
);
const REAL_GLASS_STEEL_MAP_V3 = realGlassReflectionMapV3(
  1917,
  [139, 176, 197],
  [47, 76, 94],
);
const REAL_GLASS_AQUA_MAP_V3 = realGlassReflectionMapV3(
  1933,
  [142, 206, 217],
  [50, 112, 129],
);
const REAL_GLASS_BRONZE_MAP_V3 = realGlassReflectionMapV3(
  1949,
  [205, 169, 124],
  [92, 65, 49],
);

function createRealGlassMaterialV3(
  map: THREE.Texture,
  color: string,
  nightColor: string,
  isNight: boolean,
) {
  return new THREE.MeshPhysicalMaterial({
    color: isNight ? nightColor : color,
    map,
    roughness: isNight ? 0.2 : 0.11,
    metalness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: isNight ? 0.13 : 0.055,
    ior: 1.48,
    reflectivity: 0.72,
    envMapIntensity: isNight ? 1.25 : 2.45,
    emissive: new THREE.Color(isNight ? '#17313f' : '#000000'),
    emissiveIntensity: isNight ? 0.16 : 0,
  });
}

const REAL_CITY_GLASS_V3 = {
  day: {
    blue: createRealGlassMaterialV3(
      REAL_GLASS_BLUE_MAP_V3,
      '#a6cce1',
      '#52758a',
      false,
    ),
    steel: createRealGlassMaterialV3(
      REAL_GLASS_STEEL_MAP_V3,
      '#92adbd',
      '#496477',
      false,
    ),
    aqua: createRealGlassMaterialV3(
      REAL_GLASS_AQUA_MAP_V3,
      '#9fd0d8',
      '#4a737e',
      false,
    ),
    bronze: createRealGlassMaterialV3(
      REAL_GLASS_BRONZE_MAP_V3,
      '#c7a075',
      '#72513e',
      false,
    ),
  },
  night: {
    blue: createRealGlassMaterialV3(
      REAL_GLASS_BLUE_MAP_V3,
      '#a6cce1',
      '#52758a',
      true,
    ),
    steel: createRealGlassMaterialV3(
      REAL_GLASS_STEEL_MAP_V3,
      '#92adbd',
      '#496477',
      true,
    ),
    aqua: createRealGlassMaterialV3(
      REAL_GLASS_AQUA_MAP_V3,
      '#9fd0d8',
      '#4a737e',
      true,
    ),
    bronze: createRealGlassMaterialV3(
      REAL_GLASS_BRONZE_MAP_V3,
      '#c7a075',
      '#72513e',
      true,
    ),
  },
};


/* -------------------------------------------------------------------------- */
/*               CURVED RIBBON GLASS BUILDING - REFERENCE V6                 */
/* -------------------------------------------------------------------------- */

function referenceCurvedGlassTextureV6() {
  const width = 256;
  const height = 512;
  const data = new Uint8Array(width * height * 4);
  const random = seeded(6021);

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    const sunset = Math.exp(-Math.pow((v - 0.80) / 0.075, 2));
    const horizon = Math.exp(-Math.pow((v - 0.69) / 0.16, 2));

    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const i = (y * width + x) * 4;
      const broadReflection = Math.exp(-Math.pow((u - 0.30) / 0.17, 2));
      const narrowReflection = Math.exp(-Math.pow((u - 0.72) / 0.075, 2));
      const sky = Math.pow(1 - v, 0.72);
      const cloud =
        Math.max(0, Math.sin(u * 11.5 + v * 7.5) * 0.5 + 0.5) *
        Math.max(0, Math.sin(v * 10.2 + 1.4)) *
        10;
      const grain = (random() - 0.5) * 3;

      data[i] = THREE.MathUtils.clamp(
        18 + sky * 24 + broadReflection * 16 + sunset * 120 + horizon * 20 + grain,
        0,
        255,
      );
      data[i + 1] = THREE.MathUtils.clamp(
        84 + sky * 70 + broadReflection * 44 + narrowReflection * 22 + sunset * 43 + cloud + grain,
        0,
        255,
      );
      data[i + 2] = THREE.MathUtils.clamp(
        132 + sky * 88 + broadReflection * 68 + narrowReflection * 45 + sunset * 8 + cloud + grain,
        0,
        255,
      );
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.2, 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createDShapeFootprintV6(width: number, depth: number, segments = 32) {
  const points: THREE.Vector2[] = [];
  points.push(new THREE.Vector2(-width / 2, depth / 2));
  points.push(new THREE.Vector2(width / 2, depth / 2));
  points.push(new THREE.Vector2(width / 2, 0));

  for (let i = 0; i <= segments; i += 1) {
    const theta = Math.PI / 2 - (i / segments) * Math.PI;
    points.push(
      new THREE.Vector2(
        Math.sin(theta) * (width / 2),
        -Math.cos(theta) * (depth / 2),
      ),
    );
  }

  points.push(new THREE.Vector2(-width / 2, depth / 2));
  return new THREE.Shape(points);
}

function createDExtrudeGeometryV6(
  width: number,
  depth: number,
  height: number,
  segments = 32,
) {
  const geometry = new THREE.ExtrudeGeometry(
    createDShapeFootprintV6(width, depth, segments),
    {
      depth: height,
      steps: 1,
      bevelEnabled: false,
      curveSegments: segments,
    },
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

const CURVED_REFERENCE_GLASS_MAP_V6 = referenceCurvedGlassTextureV6();
const CURVED_REFERENCE_SHELL_GEOMETRY_V6 = createDExtrudeGeometryV6(13.4, 10.8, 20.4, 40);
const CURVED_REFERENCE_INNER_GEOMETRY_V6 = createDExtrudeGeometryV6(12.6, 10, 19.5, 40);
const CURVED_REFERENCE_BAND_GEOMETRY_V6 = createDExtrudeGeometryV6(13.85, 11.22, 0.18, 40);
const CURVED_REFERENCE_TOP_GEOMETRY_V6 = createDExtrudeGeometryV6(14.15, 11.5, 0.42, 40);
const CURVED_REFERENCE_SLAB_GEOMETRY_V6 = createDExtrudeGeometryV6(12.9, 10.25, 0.085, 40);

const CURVED_REFERENCE_GLASS_V6 = {
  day: new THREE.MeshPhysicalMaterial({
    color: "#1c78a8",
    map: CURVED_REFERENCE_GLASS_MAP_V6,
    roughness: 0.075,
    metalness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    ior: 1.47,
    reflectivity: 0.96,
    transparent: true,
    opacity: 0.9,
    depthWrite: true,
    envMapIntensity: 3,
  }),
  night: new THREE.MeshPhysicalMaterial({
    color: "#17455d",
    map: CURVED_REFERENCE_GLASS_MAP_V6,
    roughness: 0.14,
    metalness: 0.05,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    ior: 1.47,
    reflectivity: 0.88,
    transparent: true,
    opacity: 0.91,
    depthWrite: true,
    envMapIntensity: 1.35,
    emissive: new THREE.Color("#0d2633"),
    emissiveIntensity: 0.16,
  }),
};

const CURVED_REFERENCE_INTERIOR_V6 = new THREE.MeshStandardMaterial({
  color: "#18262d",
  roughness: 0.64,
  metalness: 0.03,
});
const CURVED_REFERENCE_FRAME_V6 = new THREE.MeshStandardMaterial({
  color: "#495760",
  roughness: 0.25,
  metalness: 0.72,
  envMapIntensity: 1.45,
});
const CURVED_REFERENCE_BAND_V6 = new THREE.MeshStandardMaterial({
  color: "#4b5358",
  roughness: 0.3,
  metalness: 0.62,
  envMapIntensity: 1.25,
});
const CURVED_REFERENCE_CLADDING_V6 = new THREE.MeshStandardMaterial({
  color: "#bdc4c7",
  roughness: 0.27,
  metalness: 0.42,
  envMapIntensity: 1.3,
});
const CURVED_REFERENCE_ROOF_V6 = new THREE.MeshStandardMaterial({
  color: "#30383e",
  roughness: 0.3,
  metalness: 0.68,
  envMapIntensity: 1.35,
});
const CURVED_REFERENCE_WARM_INTERIOR_V6 = new THREE.MeshStandardMaterial({
  color: "#d69b61",
  emissive: new THREE.Color("#f2a35e"),
  emissiveIntensity: 0.7,
  roughness: 0.52,
});

const CURVED_REFERENCE_FLOORS_V6 = 6;
const CURVED_REFERENCE_HEIGHT_V6 = 20.4;
const CURVED_REFERENCE_WIDTH_V6 = 13.4;
const CURVED_REFERENCE_DEPTH_V6 = 10.8;

function ReferenceCurvedRibbonBuildingV6({
  isNight,
  side,
  z,
  offset,
  scale = 1,
}: {
  isNight: boolean;
  side: "left" | "right";
  z: number;
  offset: number;
  scale?: number;
}) {
  const x = side === "left" ? -offset : offset;
  const inwardRotation = side === "left" ? Math.PI / 2 : -Math.PI / 2;
  const glass = CURVED_REFERENCE_GLASS_V6[isNight ? "night" : "day"];

  const frontMullions = useMemo(() => {
    const values: Array<{ position: Vec3; yaw: number }> = [];
    const count = 13;

    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1);
      const theta = -Math.PI / 2 + t * Math.PI;
      const px = Math.sin(theta) * (CURVED_REFERENCE_WIDTH_V6 / 2 + 0.06);
      const pz = Math.cos(theta) * (CURVED_REFERENCE_DEPTH_V6 / 2 + 0.06);
      const dx = Math.cos(theta) * (CURVED_REFERENCE_WIDTH_V6 / 2);
      const dz = -Math.sin(theta) * (CURVED_REFERENCE_DEPTH_V6 / 2);
      values.push({
        position: [px, CURVED_REFERENCE_HEIGHT_V6 / 2, pz],
        yaw: Math.atan2(dx, dz),
      });
    }

    return values;
  }, []);

  const sideMullions = useMemo(() => {
    const values: Array<{ position: Vec3; yaw: number }> = [];
    const sideZ = [-4.4, -3.25, -2.1, -0.95];
    for (const xSide of [-1, 1]) {
      for (const zPos of sideZ) {
        values.push({
          position: [
            xSide * (CURVED_REFERENCE_WIDTH_V6 / 2 + 0.055),
            CURVED_REFERENCE_HEIGHT_V6 / 2,
            zPos,
          ],
          yaw: Math.PI / 2,
        });
      }
    }
    return values;
  }, []);

  const floorLevels = useMemo(
    () =>
      Array.from({ length: CURVED_REFERENCE_FLOORS_V6 - 1 }, (_, index) =>
        ((index + 1) / CURVED_REFERENCE_FLOORS_V6) * CURVED_REFERENCE_HEIGHT_V6,
      ),
    [],
  );

  const warmPanels = useMemo(
    () => [
      [-2.15, 2.45, 4.55] as Vec3,
      [-0.55, 2.45, 5.0] as Vec3,
      [1.15, 2.45, 4.82] as Vec3,
      [2.72, 2.45, 4.05] as Vec3,
    ],
    [],
  );

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.12, z]}
      rotation={[0, roadYaw(z) + inwardRotation + (side === "left" ? -0.06 : 0.06), 0]}
      scale={scale}
      dispose={null}
    >
      <RealBuildingPlazaV3 width={18.6} depth={16.4} />

      {/* Subtle stone podium, recessed so the glass remains the hero. */}
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_STONE_V3}
        position={[0, 0.62, -1.2]}
        scale={[12.8, 1.1, 8.5]}
        castShadow
        receiveShadow
      />

      {/* Interior building volume behind the transparent curtain wall. */}
      <mesh
        geometry={CURVED_REFERENCE_INNER_GEOMETRY_V6}
        material={CURVED_REFERENCE_INTERIOR_V6}
        position={[0, 0.72, 0]}
        castShadow
        receiveShadow
      />

      {/* The actual D-shaped curved glass envelope. */}
      <mesh
        geometry={CURVED_REFERENCE_SHELL_GEOMETRY_V6}
        material={glass}
        position={[0, 0.72, 0]}
        castShadow={false}
        receiveShadow={false}
      />

      {/* Repeated horizontal ribbons from the supplied architectural reference. */}
      {floorLevels.map((level) => (
        <mesh
          key={`band-${level}`}
          geometry={CURVED_REFERENCE_BAND_GEOMETRY_V6}
          material={CURVED_REFERENCE_BAND_V6}
          position={[0, 0.72 + level - 0.09, 0]}
          castShadow
        />
      ))}

      {/* Thin vertical curtain-wall mullions around the curved front. */}
      {frontMullions.map((mullion, index) => (
        <mesh
          key={`front-mullion-${index}`}
          geometry={SHARED_UNIT_BOX_GEOMETRY}
          material={CURVED_REFERENCE_FRAME_V6}
          position={[
            mullion.position[0],
            0.72 + mullion.position[1],
            mullion.position[2],
          ]}
          rotation={[0, mullion.yaw, 0]}
          scale={[0.045, CURVED_REFERENCE_HEIGHT_V6 * 0.965, 0.085]}
        />
      ))}

      {/* Straight side-wall curtain mullions. */}
      {sideMullions.map((mullion, index) => (
        <mesh
          key={`side-mullion-${index}`}
          geometry={SHARED_UNIT_BOX_GEOMETRY}
          material={CURVED_REFERENCE_FRAME_V6}
          position={[
            mullion.position[0],
            0.72 + mullion.position[1],
            mullion.position[2],
          ]}
          rotation={[0, mullion.yaw, 0]}
          scale={[0.045, CURVED_REFERENCE_HEIGHT_V6 * 0.965, 0.075]}
        />
      ))}

      {/* Real floor plates visible through the glass. */}
      {floorLevels.map((level) => (
        <mesh
          key={`slab-${level}`}
          geometry={CURVED_REFERENCE_SLAB_GEOMETRY_V6}
          material={REAL_CITY_INTERIOR_V3}
          position={[0, 0.72 + level - 0.06, 0]}
        />
      ))}

      {/* Silver rear/side cladding seen in the reference. */}
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={CURVED_REFERENCE_CLADDING_V6}
        position={[CURVED_REFERENCE_WIDTH_V6 / 2 + 0.12, 0.72 + 10.0, -2.7]}
        scale={[0.22, 19.3, 4.65]}
        castShadow
      />
      {[3.2, 6.6, 10, 13.4, 16.8].map((y) => (
        <mesh
          key={`cladding-rib-${y}`}
          geometry={SHARED_UNIT_BOX_GEOMETRY}
          material={CURVED_REFERENCE_FRAME_V6}
          position={[CURVED_REFERENCE_WIDTH_V6 / 2 + 0.245, 0.72 + y, -2.7]}
          scale={[0.05, 0.07, 4.55]}
        />
      ))}

      {/* Warm reflected lower-floor zone: gives the glass the sunset depth of the reference. */}
      {warmPanels.map((panel, index) => (
        <mesh
          key={`warm-panel-${index}`}
          geometry={SHARED_UNIT_BOX_GEOMETRY}
          material={CURVED_REFERENCE_WARM_INTERIOR_V6}
          position={[panel[0], 0.72 + panel[1], panel[2]]}
          rotation={[0, (panel[0] / CURVED_REFERENCE_WIDTH_V6) * -0.72, 0]}
          scale={[1.2, 1.25, 0.035]}
        />
      ))}

      {/* Strong dark roof overhang / crown. */}
      <mesh
        geometry={CURVED_REFERENCE_TOP_GEOMETRY_V6}
        material={CURVED_REFERENCE_ROOF_V6}
        position={[0, 0.72 + CURVED_REFERENCE_HEIGHT_V6, 0]}
        castShadow
      />
      <mesh
        geometry={CURVED_REFERENCE_BAND_GEOMETRY_V6}
        material={CURVED_REFERENCE_BAND_V6}
        position={[0, 0.72, 0]}
        castShadow
      />

      {/* Small roof plant room kept behind the curved crown. */}
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[0, 0.72 + CURVED_REFERENCE_HEIGHT_V6 + 0.65, -2.15]}
        scale={[5.4, 0.82, 3.4]}
        castShadow
      />
    </group>
  );
}

const REAL_CITY_MULLION_V3 = new THREE.MeshStandardMaterial({
  color: '#9eabb2',
  metalness: 0.7,
  roughness: 0.2,
  envMapIntensity: 1.45,
});
const REAL_CITY_DARK_MULLION_V3 = new THREE.MeshStandardMaterial({
  color: '#334852',
  metalness: 0.5,
  roughness: 0.28,
  envMapIntensity: 1.1,
});
const REAL_CITY_SPANDREL_V3 = new THREE.MeshStandardMaterial({
  color: '#526872',
  metalness: 0.32,
  roughness: 0.34,
  envMapIntensity: 1,
});
const REAL_CITY_CORE_V3 = new THREE.MeshStandardMaterial({
  color: '#5f6e74',
  map: CONCRETE_MAP,
  roughness: 0.66,
  metalness: 0.08,
});
const REAL_CITY_STONE_V3 = new THREE.MeshStandardMaterial({
  color: '#c1bdb4',
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.014,
  roughness: 0.82,
  metalness: 0.03,
});
const REAL_CITY_WHITE_STONE_V3 = new THREE.MeshStandardMaterial({
  color: '#d7d5cf',
  map: CONCRETE_MAP,
  roughness: 0.75,
  metalness: 0.02,
});
const REAL_CITY_BALCONY_GLASS_V3 = new THREE.MeshPhysicalMaterial({
  color: '#8eb7c6',
  roughness: 0.12,
  metalness: 0.08,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
  transparent: true,
  opacity: 0.58,
  depthWrite: false,
  envMapIntensity: 1.7,
});
const REAL_CITY_INTERIOR_V3 = new THREE.MeshStandardMaterial({
  color: '#26373f',
  roughness: 0.48,
  metalness: 0.08,
});
const REAL_CITY_WINDOW_WARM_V3 = new THREE.MeshStandardMaterial({
  color: '#f7e6c3',
  emissive: new THREE.Color('#ffc879'),
  emissiveIntensity: 1.4,
  roughness: 0.5,
});
const REAL_CITY_PLAZA_V3 = new THREE.MeshStandardMaterial({
  color: '#b7b4ac',
  map: CONCRETE_MAP,
  roughness: 0.9,
});
const REAL_CITY_SHADOW_V3 = new THREE.MeshBasicMaterial({
  color: '#071014',
  transparent: true,
  opacity: 0.13,
  depthWrite: false,
});
const REAL_CITY_PLANTER_V3 = new THREE.MeshStandardMaterial({
  color: '#4f6f45',
  roughness: 0.95,
});

const CURVED_FLOOR_GEOMETRY_V3 = new THREE.CylinderGeometry(1, 1, 1, 48);

function localMatrixV3(
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

function RealBuildingPlazaV3({
  width,
  depth,
}: {
  width: number;
  depth: number;
}) {
  return (
    <group>
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_PLAZA_V3}
        position={[0, 0.06, 0]}
        scale={[width, 0.12, depth]}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.014, 0]}
        material={REAL_CITY_SHADOW_V3}
      >
        <planeGeometry args={[width * 0.86, depth * 0.86]} />
      </mesh>
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_PLANTER_V3}
        position={[-width * 0.36, 0.16, depth * 0.37]}
        scale={[width * 0.18, 0.2, depth * 0.13]}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_PLANTER_V3}
        position={[width * 0.31, 0.16, -depth * 0.38]}
        scale={[width * 0.24, 0.2, depth * 0.11]}
      />
    </group>
  );
}

function FacadeGridBatchV3({
  width,
  height,
  depth,
  center = [0, 0, 0],
  floors = 10,
  frontMullions = 8,
  sideMullions = 5,
  mullionMaterial = REAL_CITY_MULLION_V3,
  bandMaterial = REAL_CITY_DARK_MULLION_V3,
}: {
  width: number;
  height: number;
  depth: number;
  center?: Vec3;
  floors?: number;
  frontMullions?: number;
  sideMullions?: number;
  mullionMaterial?: THREE.Material;
  bandMaterial?: THREE.Material;
}) {
  const verticalMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    const cy = center[1];

    for (let i = 1; i <= frontMullions; i += 1) {
      const ratio = i / (frontMullions + 1) - 0.5;
      const x = center[0] + ratio * width;
      values.push(
        localMatrixV3(
          [x, cy, center[2] + depth / 2 + 0.035],
          [0, 0, 0],
          [0.042, height * 0.96, 0.055],
        ),
        localMatrixV3(
          [x, cy, center[2] - depth / 2 - 0.035],
          [0, 0, 0],
          [0.042, height * 0.96, 0.055],
        ),
      );
    }

    for (let i = 1; i <= sideMullions; i += 1) {
      const ratio = i / (sideMullions + 1) - 0.5;
      const z = center[2] + ratio * depth;
      values.push(
        localMatrixV3(
          [center[0] + width / 2 + 0.035, cy, z],
          [0, 0, 0],
          [0.055, height * 0.96, 0.042],
        ),
        localMatrixV3(
          [center[0] - width / 2 - 0.035, cy, z],
          [0, 0, 0],
          [0.055, height * 0.96, 0.042],
        ),
      );
    }

    return values;
  }, [center, depth, frontMullions, height, sideMullions, width]);

  const floorMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    const baseY = center[1] - height / 2;

    for (let floor = 1; floor < floors; floor += 1) {
      const y = baseY + (floor / floors) * height;
      values.push(
        localMatrixV3(
          [center[0], y, center[2] + depth / 2 + 0.03],
          [0, 0, 0],
          [width * 0.985, 0.047, 0.05],
        ),
        localMatrixV3(
          [center[0], y, center[2] - depth / 2 - 0.03],
          [0, 0, 0],
          [width * 0.985, 0.047, 0.05],
        ),
        localMatrixV3(
          [center[0] + width / 2 + 0.03, y, center[2]],
          [0, 0, 0],
          [0.05, 0.047, depth * 0.985],
        ),
        localMatrixV3(
          [center[0] - width / 2 - 0.03, y, center[2]],
          [0, 0, 0],
          [0.05, 0.047, depth * 0.985],
        ),
      );
    }

    return values;
  }, [center, depth, floors, height, width]);

  return (
    <group dispose={null}>
      <BuildingInstanceBatch
        matrices={verticalMatrices}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={mullionMaterial}
      />
      <BuildingInstanceBatch
        matrices={floorMatrices}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={bandMaterial}
      />
    </group>
  );
}

function InternalSlabBatchV3({
  width,
  height,
  depth,
  center = [0, 0, 0],
  floors = 10,
}: {
  width: number;
  height: number;
  depth: number;
  center?: Vec3;
  floors?: number;
}) {
  const matrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    const baseY = center[1] - height / 2;

    for (let floor = 1; floor < floors; floor += 1) {
      const y = baseY + (floor / floors) * height;
      values.push(
        localMatrixV3(
          [center[0], y - 0.03, center[2]],
          [0, 0, 0],
          [width * 0.91, 0.07, depth * 0.9],
        ),
      );
    }

    return values;
  }, [center, depth, floors, height, width]);

  return (
    <BuildingInstanceBatch
      matrices={matrices}
      geometry={SHARED_UNIT_BOX_GEOMETRY}
      material={REAL_CITY_INTERIOR_V3}
    />
  );
}

function RealGlassBlockV3({
  width,
  height,
  depth,
  position = [0, 0, 0],
  glass,
  floors,
  frontMullions,
  sideMullions,
  radius = 0.36,
}: {
  width: number;
  height: number;
  depth: number;
  position?: Vec3;
  glass: THREE.Material;
  floors: number;
  frontMullions: number;
  sideMullions: number;
  radius?: number;
}) {
  const center: Vec3 = [position[0], position[1] + height / 2, position[2]];

  return (
    <group>
      <RoundedBox
        args={[width, height, depth]}
        radius={radius}
        smoothness={5}
        position={center}
        castShadow={false}
        receiveShadow={false}
      >
        <primitive object={glass} attach="material" />
      </RoundedBox>
      <InternalSlabBatchV3
        width={width}
        height={height}
        depth={depth}
        center={center}
        floors={floors}
      />
      <FacadeGridBatchV3
        width={width}
        height={height}
        depth={depth}
        center={center}
        floors={floors}
        frontMullions={frontMullions}
        sideMullions={sideMullions}
      />
    </group>
  );
}

function CurvedTowerDetailsV3({
  width,
  height,
  depth,
  floors,
}: {
  width: number;
  height: number;
  depth: number;
  floors: number;
}) {
  const finMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      values.push(
        localMatrixV3(
          [
            Math.cos(angle) * (width / 2 + 0.035),
            height / 2,
            Math.sin(angle) * (depth / 2 + 0.035),
          ],
          [0, -angle, 0],
          [0.055, height * 0.96, 0.1],
        ),
      );
    }
    return values;
  }, [depth, height, width]);

  const floorMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    for (let floor = 1; floor < floors; floor += 1) {
      const y = (floor / floors) * height;
      values.push(
        localMatrixV3(
          [0, y, 0],
          [0, 0, 0],
          [width * 0.49, 0.06, depth * 0.49],
        ),
      );
    }
    return values;
  }, [depth, floors, height, width]);

  return (
    <group dispose={null}>
      <BuildingInstanceBatch
        matrices={finMatrices}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_MULLION_V3}
      />
      <BuildingInstanceBatch
        matrices={floorMatrices}
        geometry={CURVED_FLOOR_GEOMETRY_V3}
        material={REAL_CITY_SPANDREL_V3}
      />
    </group>
  );
}

function CurvedExecutiveTowerV3({
  isNight,
  side,
  z,
  offset,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
}) {
  const glass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].blue;
  const x = side === 'left' ? -offset : offset;
  const height = 39;
  const width = 9.2;
  const depth = 7.4;

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.2, z]}
      rotation={[0, roadYaw(z) + 0.05, 0]}
    >
      <RealBuildingPlazaV3 width={16.5} depth={15.2} />
      <RoundedBox
        args={[13.6, 3.25, 11.8]}
        radius={0.42}
        smoothness={5}
        position={[0, 1.73, 0.35]}
      >
        <primitive object={REAL_CITY_WHITE_STONE_V3} attach="material" />
      </RoundedBox>
      <mesh position={[0, 3.35 + height / 2, 0]} scale={[width / 2, 1, depth / 2]}>
        <cylinderGeometry args={[1, 1, height, 48]} />
        <primitive object={glass} attach="material" />
      </mesh>
      <group position={[0, 3.35, 0]}>
        <CurvedTowerDetailsV3
          width={width}
          height={height}
          depth={depth}
          floors={13}
        />
      </group>
      <mesh position={[0, 3.35 + height * 0.49, -depth * 0.16]}>
        <boxGeometry args={[1.5, height * 0.88, depth * 0.2]} />
        <primitive object={REAL_CITY_CORE_V3} attach="material" />
      </mesh>
      <mesh
        position={[0, 3.35 + height + 0.5, 0]}
        scale={[width * 0.43, 0.55, depth * 0.42]}
      >
        <cylinderGeometry args={[1, 1, 1, 48]} />
        <primitive object={REAL_CITY_MULLION_V3} attach="material" />
      </mesh>
    </group>
  );
}

function TerracedGlassTowerV3({
  isNight,
  side,
  z,
  offset,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
}) {
  const glass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].aqua;
  const steelGlass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].steel;
  const x = side === 'left' ? -offset : offset;

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.18, z]}
      rotation={[0, roadYaw(z) - 0.035, 0]}
    >
      <RealBuildingPlazaV3 width={18.5} depth={16.5} />
      <RoundedBox
        args={[15.6, 3.2, 12.8]}
        radius={0.38}
        smoothness={5}
        position={[0, 1.7, 0]}
      >
        <primitive object={REAL_CITY_STONE_V3} attach="material" />
      </RoundedBox>

      <RealGlassBlockV3
        width={12.4}
        height={12.5}
        depth={10.4}
        position={[-1.3, 3.3, 0]}
        glass={steelGlass}
        floors={4}
        frontMullions={8}
        sideMullions={5}
        radius={0.42}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={CITY_GRASS_MATERIAL}
        position={[-1.3, 15.95, 0.2]}
        scale={[10.8, 0.14, 8.8]}
      />

      <RealGlassBlockV3
        width={10.5}
        height={12.8}
        depth={9.2}
        position={[0.2, 15.95, -0.35]}
        glass={glass}
        floors={4}
        frontMullions={7}
        sideMullions={4}
        radius={0.42}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={CITY_GRASS_MATERIAL}
        position={[0.2, 28.88, -0.2]}
        scale={[8.9, 0.14, 7.5]}
      />

      <RealGlassBlockV3
        width={8.2}
        height={11.2}
        depth={7.8}
        position={[1.15, 28.92, -0.65]}
        glass={steelGlass}
        floors={4}
        frontMullions={6}
        sideMullions={4}
        radius={0.4}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[-5.1, 20.5, -2.9]}
        scale={[1.2, 33, 2.4]}
      />
    </group>
  );
}

function TwinCorporateTowerV3({
  isNight,
  side,
  z,
  offset,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
}) {
  const blue = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].blue;
  const steel = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].steel;
  const x = side === 'left' ? -offset : offset;

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.18, z]}
      rotation={[0, roadYaw(z) + 0.025, 0]}
    >
      <RealBuildingPlazaV3 width={19.5} depth={15.8} />
      <RoundedBox
        args={[17, 3.4, 12.7]}
        radius={0.38}
        smoothness={5}
        position={[0, 1.8, 0]}
      >
        <primitive object={REAL_CITY_STONE_V3} attach="material" />
      </RoundedBox>

      <RealGlassBlockV3
        width={6.6}
        height={31}
        depth={8.2}
        position={[-3.75, 3.45, 0.15]}
        glass={steel}
        floors={10}
        frontMullions={5}
        sideMullions={4}
        radius={0.46}
      />
      <RealGlassBlockV3
        width={6.9}
        height={38}
        depth={8.5}
        position={[3.65, 3.45, -0.25]}
        glass={blue}
        floors={12}
        frontMullions={5}
        sideMullions={4}
        radius={0.46}
      />

      <RoundedBox
        args={[7.1, 2.35, 5.2]}
        radius={0.3}
        smoothness={4}
        position={[0, 24.5, 0.1]}
      >
        <primitive object={blue} attach="material" />
      </RoundedBox>
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_MULLION_V3}
        position={[0, 24.5, 2.72]}
        scale={[6.7, 0.13, 0.08]}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={CITY_GRASS_MATERIAL}
        position={[-3.75, 34.6, 0.15]}
        scale={[5.4, 0.12, 6.7]}
      />
    </group>
  );
}

function ResidentialBalconyTowerV3({
  isNight,
  side,
  z,
  offset,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
}) {
  const glass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].blue;
  const x = side === 'left' ? -offset : offset;
  const floors = 11;
  const balconyMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    for (let i = 1; i < floors; i += 1) {
      const y = 4.2 + i * 2.65;
      const shift = i % 2 === 0 ? -0.42 : 0.42;
      values.push(
        localMatrixV3(
          [shift, y, 4.15],
          [0, 0, 0],
          [7.4, 0.13, 1.25],
        ),
      );
    }
    return values;
  }, []);
  const railMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    for (let i = 1; i < floors; i += 1) {
      const y = 4.2 + i * 2.65 + 0.48;
      const shift = i % 2 === 0 ? -0.42 : 0.42;
      values.push(
        localMatrixV3(
          [shift, y, 4.75],
          [0, 0, 0],
          [7.1, 0.74, 0.045],
        ),
      );
    }
    return values;
  }, []);

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.16, z]}
      rotation={[0, roadYaw(z) - 0.04, 0]}
    >
      <RealBuildingPlazaV3 width={15} depth={15.5} />
      <RoundedBox
        args={[12.4, 3.1, 12]}
        radius={0.36}
        smoothness={4}
        position={[0, 1.65, 0]}
      >
        <primitive object={REAL_CITY_WHITE_STONE_V3} attach="material" />
      </RoundedBox>
      <RealGlassBlockV3
        width={8.1}
        height={32.5}
        depth={7.5}
        position={[0, 3.2, 0]}
        glass={glass}
        floors={11}
        frontMullions={6}
        sideMullions={4}
        radius={0.5}
      />
      <BuildingInstanceBatch
        matrices={balconyMatrices}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_WHITE_STONE_V3}
      />
      <BuildingInstanceBatch
        matrices={railMatrices}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_BALCONY_GLASS_V3}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[-3.35, 19.2, -2.6]}
        scale={[1.3, 30.8, 2.1]}
      />
    </group>
  );
}

function BronzeFeatureTowerV3({
  isNight,
  side,
  z,
  offset,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
}) {
  const glass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].bronze;
  const x = side === 'left' ? -offset : offset;

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.18, z]}
      rotation={[0, roadYaw(z) + 0.11, 0]}
    >
      <RealBuildingPlazaV3 width={16.8} depth={14.8} />
      <RoundedBox
        args={[14.5, 3.15, 11.6]}
        radius={0.36}
        smoothness={4}
        position={[0, 1.68, 0]}
      >
        <primitive object={REAL_CITY_STONE_V3} attach="material" />
      </RoundedBox>
      <RealGlassBlockV3
        width={9.8}
        height={34}
        depth={8.8}
        position={[-0.8, 3.25, 0]}
        glass={glass}
        floors={11}
        frontMullions={8}
        sideMullions={5}
        radius={0.48}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[4.3, 19.2, -0.8]}
        scale={[1.45, 31.5, 7.2]}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_MULLION_V3}
        position={[-0.8, 37.75, 0]}
        rotation={[0, 0, -0.055]}
        scale={[8.8, 1.1, 7.4]}
      />
    </group>
  );
}

function LowRiseAtriumV3({
  isNight,
  side,
  z,
  offset,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
}) {
  const glass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].aqua;
  const x = side === 'left' ? -offset : offset;

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.16, z]}
      rotation={[0, roadYaw(z) - 0.02, 0]}
    >
      <RealBuildingPlazaV3 width={21.5} depth={17.8} />
      <RoundedBox
        args={[18.8, 2.9, 14.4]}
        radius={0.4}
        smoothness={4}
        position={[0, 1.55, 0]}
      >
        <primitive object={REAL_CITY_STONE_V3} attach="material" />
      </RoundedBox>
      <RealGlassBlockV3
        width={6.4}
        height={15.5}
        depth={9.2}
        position={[-5.2, 3.05, 0]}
        glass={glass}
        floors={5}
        frontMullions={5}
        sideMullions={4}
        radius={0.48}
      />
      <RealGlassBlockV3
        width={6.4}
        height={15.5}
        depth={9.2}
        position={[5.2, 3.05, 0]}
        glass={glass}
        floors={5}
        frontMullions={5}
        sideMullions={4}
        radius={0.48}
      />
      <RoundedBox
        args={[5.2, 9.8, 8.7]}
        radius={0.46}
        smoothness={5}
        position={[0, 8.2, 0.1]}
      >
        <primitive object={REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].steel} attach="material" />
      </RoundedBox>
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={CITY_GRASS_MATERIAL}
        position={[0, 16.08, 0]}
        scale={[15.5, 0.15, 8.2]}
      />
    </group>
  );
}

function BackgroundGlassTowerV3({
  isNight,
  side,
  z,
  offset,
  width,
  height,
  depth,
  tone,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
  width: number;
  height: number;
  depth: number;
  tone: 'blue' | 'steel' | 'aqua';
}) {
  const glass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'][tone];
  const x = side === 'left' ? -offset : offset;
  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.14, z]}
      rotation={[0, roadYaw(z), 0]}
    >
      <RealGlassBlockV3
        width={width}
        height={height}
        depth={depth}
        glass={glass}
        floors={Math.max(5, Math.round(height / 3.25))}
        frontMullions={Math.max(4, Math.round(width / 1.6))}
        sideMullions={Math.max(3, Math.round(depth / 2))}
        radius={0.38}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[
          side === 'left' ? width * 0.36 : -width * 0.36,
          height * 0.48,
          -depth * 0.3,
        ]}
        scale={[width * 0.12, height * 0.86, depth * 0.2]}
      />
    </group>
  );
}


function CityInfillOfficeV7({
  isNight,
  side,
  z,
  offset,
  width,
  height,
  depth,
  tone,
  yawOffset = 0,
}: {
  isNight: boolean;
  side: "left" | "right";
  z: number;
  offset: number;
  width: number;
  height: number;
  depth: number;
  tone: "blue" | "steel" | "aqua";
  yawOffset?: number;
}) {
  const glass = REAL_CITY_GLASS_V3[isNight ? "night" : "day"][tone];
  const x = side === "left" ? -offset : offset;
  const floors = Math.max(4, Math.round(height / 3.1));

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.15, z]}
      rotation={[0, roadYaw(z) + yawOffset, 0]}
    >
      <RealBuildingPlazaV3 width={width + 5.4} depth={depth + 5.2} />

      <RoundedBox
        args={[width + 2.4, 2.85, depth + 2]}
        radius={0.28}
        smoothness={4}
        position={[0, 1.5, 0]}
        castShadow
        receiveShadow
      >
        <primitive object={REAL_CITY_STONE_V3} attach="material" />
      </RoundedBox>

      <RealGlassBlockV3
        width={width}
        height={height}
        depth={depth}
        position={[0, 2.95, 0]}
        glass={glass}
        floors={floors}
        frontMullions={Math.max(5, Math.round(width / 1.35))}
        sideMullions={Math.max(3, Math.round(depth / 1.7))}
        radius={0.3}
      />

      {/* Recessed structural/core strip breaks the plain box silhouette. */}
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[
          side === "left" ? -width * 0.38 : width * 0.38,
          2.95 + height * 0.47,
          -depth * 0.33,
        ]}
        scale={[Math.max(0.7, width * 0.11), height * 0.88, depth * 0.18]}
        castShadow
      />

      {/* Ground-floor entrance canopy. */}
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_MULLION_V3}
        position={[0, 3.1, depth / 2 + 0.72]}
        scale={[width * 0.52, 0.12, 1.35]}
        castShadow
      />

      {/* Small rooftop mechanical crown. */}
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[0, 2.95 + height + 0.55, -depth * 0.08]}
        scale={[width * 0.34, 0.8, depth * 0.42]}
        castShadow
      />
    </group>
  );
}

function SkygardenResidentialTowerV9({
  isNight,
  side,
  z,
  offset,
  scale = 1,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
  scale?: number;
}) {
  const x = side === 'left' ? -offset : offset;
  const glassPrimary = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].steel;
  const glassAccent = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].blue;
  const width = 10.8 * scale;
  const depth = 9.2 * scale;
  const towerHeight = 63 * scale;
  const towerBaseY = 7.15 * scale;
  const floors = 23;

  const balconySlabs = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    const levelHeight = towerHeight / floors;
    for (let floor = 1; floor < floors; floor += 1) {
      const y = towerBaseY + floor * levelHeight;
      const expand = floor % 3 === 0 ? 0.42 * scale : 0.18 * scale;
      values.push(
        localMatrixV3([0, y, depth / 2 + 0.65 * scale], [0, 0, 0], [width * 0.94 + expand, 0.11 * scale, 1.02 * scale]),
        localMatrixV3([0, y, -depth / 2 - 0.65 * scale], [0, 0, 0], [width * 0.94 + expand, 0.11 * scale, 1.02 * scale]),
        localMatrixV3([width / 2 + 0.65 * scale, y, 0], [0, 0, 0], [1.02 * scale, 0.11 * scale, depth * 0.92 + expand]),
        localMatrixV3([-width / 2 - 0.65 * scale, y, 0], [0, 0, 0], [1.02 * scale, 0.11 * scale, depth * 0.92 + expand]),
      );
    }
    return values;
  }, [depth, floors, scale, towerBaseY, towerHeight, width]);

  const balconyRails = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    const levelHeight = towerHeight / floors;
    for (let floor = 1; floor < floors; floor += 1) {
      const y = towerBaseY + floor * levelHeight + 0.48 * scale;
      values.push(
        localMatrixV3([0, y, depth / 2 + 1.08 * scale], [0, 0, 0], [width * 0.9, 0.72 * scale, 0.05 * scale]),
        localMatrixV3([0, y, -depth / 2 - 1.08 * scale], [0, 0, 0], [width * 0.9, 0.72 * scale, 0.05 * scale]),
        localMatrixV3([width / 2 + 1.08 * scale, y, 0], [0, 0, 0], [0.05 * scale, 0.72 * scale, depth * 0.88]),
        localMatrixV3([-width / 2 - 1.08 * scale, y, 0], [0, 0, 0], [0.05 * scale, 0.72 * scale, depth * 0.88]),
      );
    }
    return values;
  }, [depth, floors, scale, towerBaseY, towerHeight, width]);

  const verticalFrameFins = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    for (const sideX of [-1, 1]) {
      values.push(
        localMatrixV3([sideX * (width / 2 + 0.22 * scale), towerBaseY + towerHeight / 2, depth * 0.12], [0, 0, 0], [0.22 * scale, towerHeight * 0.98, depth * 0.94]),
      );
    }
    return values;
  }, [depth, scale, towerBaseY, towerHeight, width]);

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.15, z]}
      rotation={[0, roadYaw(z) + (side === 'left' ? 0.055 : -0.055), 0]}
      dispose={null}
    >
      <RealBuildingPlazaV3 width={22 * scale} depth={20 * scale} />

      <RoundedBox
        args={[16.2 * scale, 5.8 * scale, 13.8 * scale]}
        radius={0.48 * scale}
        smoothness={5}
        position={[0, 2.95 * scale, 0]}
        castShadow
        receiveShadow
      >
        <primitive object={REAL_CITY_WHITE_STONE_V3} attach="material" />
      </RoundedBox>

      <RealGlassBlockV3
        width={12.4 * scale}
        height={7.5 * scale}
        depth={9.6 * scale}
        position={[0, 2.25 * scale, 0.2 * scale]}
        glass={glassPrimary}
        floors={2}
        frontMullions={9}
        sideMullions={6}
        radius={0.42 * scale}
      />

      <RealGlassBlockV3
        width={width}
        height={towerHeight}
        depth={depth}
        position={[0, towerBaseY, 0]}
        glass={glassAccent}
        floors={floors}
        frontMullions={9}
        sideMullions={6}
        radius={0.78 * scale}
      />

      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[0, towerBaseY + towerHeight * 0.5, -depth * 0.26]}
        scale={[2.05 * scale, towerHeight * 0.96, 1.7 * scale]}
        castShadow
      />

      <BuildingInstanceBatch
        matrices={balconySlabs}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_WHITE_STONE_V3}
      />
      <BuildingInstanceBatch
        matrices={balconyRails}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_BALCONY_GLASS_V3}
      />
      <BuildingInstanceBatch
        matrices={verticalFrameFins}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_MULLION_V3}
      />

      <mesh position={[0, towerBaseY + towerHeight + 1.5 * scale, 0]} scale={[width * 0.73, 0.86 * scale, depth * 0.73]} castShadow>
        <cylinderGeometry args={[1, 1, 1, 48]} />
        <primitive object={REAL_CITY_MULLION_V3} attach="material" />
      </mesh>
      <mesh position={[0, towerBaseY + towerHeight + 1.83 * scale, 0]} scale={[width * 0.6, 0.2 * scale, depth * 0.6]}>
        <cylinderGeometry args={[1, 1, 1, 48]} />
        <primitive object={CITY_GRASS_MATERIAL} attach="material" />
      </mesh>

      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_MULLION_V3}
        position={[0, 5.9 * scale, depth / 2 + 1.0 * scale]}
        scale={[7.6 * scale, 0.12 * scale, 1.4 * scale]}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_MULLION_V3}
        position={[0, 0.32 * scale, 0]}
        scale={[9.5 * scale, 0.28 * scale, 9.0 * scale]}
      />
    </group>
  );
}

const ENHANCED_BACKGROUND_TOWERS_V9 = [
  { side: 'left' as const, z: 52, offset: 44, width: 6.8, height: 14, depth: 6.5, tone: 'aqua' as const },
  { side: 'right' as const, z: 48, offset: 45, width: 6.6, height: 13, depth: 6.3, tone: 'steel' as const },
  { side: 'left' as const, z: 18, offset: 46, width: 7.4, height: 17, depth: 6.7, tone: 'blue' as const },
  { side: 'right' as const, z: 14, offset: 47, width: 7.2, height: 16, depth: 6.8, tone: 'aqua' as const },
  { side: 'left' as const, z: -196, offset: 56, width: 8.6, height: 30, depth: 7.8, tone: 'blue' as const },
  { side: 'right' as const, z: -206, offset: 58, width: 8.2, height: 29, depth: 7.5, tone: 'steel' as const },
  { side: 'left' as const, z: -220, offset: 60, width: 7.4, height: 26, depth: 7.0, tone: 'aqua' as const },
  { side: 'right' as const, z: -230, offset: 61, width: 7.6, height: 27, depth: 7.1, tone: 'blue' as const },
];
const REAL_BACKGROUND_TOWERS_V7 = [
  { side: "left" as const,  z: 38,   offset: 40, width: 7.4, height: 16, depth: 7.0, tone: "steel" as const },
  { side: "right" as const, z: 35,   offset: 41, width: 8.0, height: 18, depth: 7.3, tone: "aqua" as const },
  { side: "left" as const,  z: 8,    offset: 43, width: 7.0, height: 19, depth: 6.8, tone: "blue" as const },
  { side: "right" as const, z: 2,    offset: 43, width: 7.6, height: 17, depth: 7.1, tone: "steel" as const },
  { side: "left" as const,  z: -24,  offset: 45, width: 7.6, height: 23, depth: 7.2, tone: "aqua" as const },
  { side: "right" as const, z: -34,  offset: 46, width: 8.1, height: 24, depth: 7.4, tone: "blue" as const },
  { side: "left" as const,  z: -63,  offset: 46, width: 7.2, height: 25, depth: 7.0, tone: "steel" as const },
  { side: "right" as const, z: -72,  offset: 47, width: 8.4, height: 26, depth: 7.6, tone: "aqua" as const },
  { side: "left" as const,  z: -97,  offset: 48, width: 7.8, height: 27, depth: 7.3, tone: "blue" as const },
  { side: "right" as const, z: -108, offset: 49, width: 8.2, height: 28, depth: 7.5, tone: "steel" as const },
  { side: "left" as const,  z: -132, offset: 50, width: 7.4, height: 24, depth: 7.1, tone: "aqua" as const },
  { side: "right" as const, z: -144, offset: 51, width: 7.8, height: 25, depth: 7.2, tone: "blue" as const },
  { side: "left" as const,  z: -170, offset: 53, width: 7.4, height: 22, depth: 6.9, tone: "steel" as const },
  { side: "right" as const, z: -182, offset: 54, width: 7.6, height: 23, depth: 7.0, tone: "aqua" as const },
];

function RealArchitecturalCityV7({ isNight }: { isNight: boolean }) {
  return (
    <group dispose={null}>
      {/* Primary landmark building placed in the mid-left visual sweet spot. */}
      <ReferenceCurvedRibbonBuildingV6
        isNight={isNight}
        side="left"
        z={-26}
        offset={31.5}
        scale={0.94}
      />

      {/* Added skyline hero tower inspired by the supplied luxury residential reference. */}
      <SkygardenResidentialTowerV9
        isNight={isNight}
        side="right"
        z={-146}
        offset={55.5}
        scale={1.06}
      />

      {/* Foreground / near-mid density so the city no longer feels empty. */}
      <CityInfillOfficeV7
        isNight={isNight}
        side="left"
        z={32}
        offset={31.5}
        width={8.8}
        height={15.8}
        depth={7.8}
        tone="steel"
        yawOffset={0.03}
      />
      <CityInfillOfficeV7
        isNight={isNight}
        side="left"
        z={12}
        offset={34.2}
        width={9.2}
        height={18.8}
        depth={8.3}
        tone="aqua"
        yawOffset={0.025}
      />
      <CityInfillOfficeV7
        isNight={isNight}
        side="right"
        z={24}
        offset={33.2}
        width={9.6}
        height={18.2}
        depth={8.4}
        tone="blue"
        yawOffset={-0.025}
      />
      <CityInfillOfficeV7
        isNight={isNight}
        side="right"
        z={4}
        offset={35.4}
        width={8.9}
        height={17}
        depth={7.9}
        tone="steel"
        yawOffset={-0.02}
      />

      {/* Distinct hero buildings inspired by the supplied glass-corporate references. */}
      <TerracedGlassTowerV3
        isNight={isNight}
        side="right"
        z={-18}
        offset={34.6}
      />
      <TwinCorporateTowerV3
        isNight={isNight}
        side="left"
        z={-54}
        offset={36.8}
      />
      <CurvedExecutiveTowerV3
        isNight={isNight}
        side="right"
        z={-56}
        offset={38.8}
      />
      <ResidentialBalconyTowerV3
        isNight={isNight}
        side="right"
        z={-88}
        offset={39.8}
      />

      {/* Mid-distance parcels filled with more believable office massing. */}
      <CityInfillOfficeV7
        isNight={isNight}
        side="left"
        z={-80}
        offset={39.5}
        width={8.6}
        height={22.5}
        depth={7.8}
        tone="aqua"
        yawOffset={0.02}
      />
      <CityInfillOfficeV7
        isNight={isNight}
        side="left"
        z={-104}
        offset={41.6}
        width={9.1}
        height={20.5}
        depth={8.2}
        tone="steel"
        yawOffset={0.02}
      />
      <CityInfillOfficeV7
        isNight={isNight}
        side="right"
        z={-112}
        offset={42.6}
        width={8.8}
        height={21.8}
        depth={8.0}
        tone="aqua"
        yawOffset={-0.03}
      />
      <CityInfillOfficeV7
        isNight={isNight}
        side="right"
        z={-136}
        offset={44.5}
        width={8.7}
        height={19.8}
        depth={7.7}
        tone="steel"
        yawOffset={-0.025}
      />
      <CityInfillOfficeV7
        isNight={isNight}
        side="left"
        z={-152}
        offset={44.6}
        width={8.4}
        height={18.4}
        depth={7.4}
        tone="blue"
        yawOffset={0.018}
      />

      {/* Repeated curved / low-rise forms keep the skyline varied and believable. */}
      <ReferenceCurvedRibbonBuildingV6
        isNight={isNight}
        side="right"
        z={-126}
        offset={46.5}
        scale={0.6}
      />
      <LowRiseAtriumV3
        isNight={isNight}
        side="left"
        z={-142}
        offset={38.4}
      />
      <LowRiseAtriumV3
        isNight={isNight}
        side="right"
        z={-162}
        offset={47.4}
      />

      {/* Secondary skyline closes long empty gaps without blocking the road and unipole. */}
      {ENHANCED_BACKGROUND_TOWERS_V9.map((spec) => (
        <BackgroundGlassTowerV3
          key={`enhanced-${spec.side}-${spec.z}`}
          isNight={isNight}
          {...spec}
        />
      ))}
      {REAL_BACKGROUND_TOWERS_V7.map((spec) => (
        <BackgroundGlassTowerV3
          key={`${spec.side}-${spec.z}`}
          isNight={isNight}
          {...spec}
        />
      ))}
    </group>
  );
}


/* -------------------------------------------------------------------------- */
/*                    V10 - VISIBLE DENSE REALTIME CITY                       */
/* -------------------------------------------------------------------------- */

const FAR_CITY_STONE_V10 = new THREE.MeshStandardMaterial({
  color: '#aaa9a3',
  map: CONCRETE_MAP,
  roughness: 0.9,
  metalness: 0.02,
});
const FAR_CITY_ROOF_V10 = new THREE.MeshStandardMaterial({
  color: '#59666b',
  roughness: 0.52,
  metalness: 0.28,
});
const FAR_CITY_BAND_V10 = new THREE.MeshStandardMaterial({
  color: '#43545c',
  roughness: 0.34,
  metalness: 0.34,
});

function LuxurySkygardenTowerV10({
  isNight,
  side,
  z,
  offset,
  scale = 1,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
  scale?: number;
}) {
  const x = side === 'left' ? -offset : offset;
  const glass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].steel;
  const glassBlue = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'].blue;
  const height = 55 * scale;
  const floors = 20;
  const wingWidth = 5.25 * scale;
  const depth = 8.8 * scale;
  const baseY = 6.6 * scale;

  const balconyMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    const level = height / floors;
    for (let floor = 1; floor < floors; floor += 1) {
      const y = baseY + floor * level;
      const project = (floor % 4 === 0 ? 1.12 : 0.82) * scale;
      for (const wingX of [-2.95 * scale, 2.95 * scale]) {
        values.push(
          localMatrixV3(
            [wingX, y, depth / 2 + project * 0.5],
            [0, 0, 0],
            [wingWidth * 0.94, 0.12 * scale, project],
          ),
        );
      }
    }
    return values;
  }, [baseY, depth, floors, height, scale, wingWidth]);

  const railMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    const level = height / floors;
    for (let floor = 1; floor < floors; floor += 1) {
      const y = baseY + floor * level + 0.48 * scale;
      const project = (floor % 4 === 0 ? 1.12 : 0.82) * scale;
      for (const wingX of [-2.95 * scale, 2.95 * scale]) {
        values.push(
          localMatrixV3(
            [wingX, y, depth / 2 + project],
            [0, 0, 0],
            [wingWidth * 0.9, 0.72 * scale, 0.045 * scale],
          ),
        );
      }
    }
    return values;
  }, [baseY, depth, floors, height, scale, wingWidth]);

  const whiteFrameMatrices = useMemo(() => {
    const values: THREE.Matrix4[] = [];
    for (const wingX of [-5.52 * scale, -0.42 * scale, 0.42 * scale, 5.52 * scale]) {
      values.push(
        localMatrixV3(
          [wingX, baseY + height * 0.5, depth * 0.44],
          [0, 0, 0],
          [0.17 * scale, height * 0.98, 0.24 * scale],
        ),
      );
    }
    return values;
  }, [baseY, depth, height, scale]);

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.16, z]}
      rotation={[0, roadYaw(z) + (side === 'left' ? 0.04 : -0.04), 0]}
      dispose={null}
    >
      <RealBuildingPlazaV3 width={19.5 * scale} depth={18 * scale} />

      {/* Multi-level premium podium, similar to the supplied high-rise reference. */}
      <RoundedBox
        args={[15.6 * scale, 4.7 * scale, 12.5 * scale]}
        radius={0.48 * scale}
        smoothness={5}
        position={[0, 2.45 * scale, 0]}
        castShadow
        receiveShadow
      >
        <primitive object={REAL_CITY_WHITE_STONE_V3} attach="material" />
      </RoundedBox>
      <RealGlassBlockV3
        width={12.2 * scale}
        height={5.1 * scale}
        depth={9.2 * scale}
        position={[0, 1.55 * scale, 0.3 * scale]}
        glass={glass}
        floors={2}
        frontMullions={8}
        sideMullions={5}
        radius={0.42 * scale}
      />

      {/* Two residential glass wings with a recessed center slot. */}
      <RealGlassBlockV3
        width={wingWidth}
        height={height}
        depth={depth}
        position={[-2.95 * scale, baseY, 0]}
        glass={glassBlue}
        floors={floors}
        frontMullions={5}
        sideMullions={5}
        radius={0.48 * scale}
      />
      <RealGlassBlockV3
        width={wingWidth}
        height={height * 0.965}
        depth={depth}
        position={[2.95 * scale, baseY, -0.08 * scale]}
        glass={glass}
        floors={floors}
        frontMullions={5}
        sideMullions={5}
        radius={0.48 * scale}
      />

      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_CORE_V3}
        position={[0, baseY + height * 0.49, -depth * 0.2]}
        scale={[1.25 * scale, height * 0.95, depth * 0.64]}
        castShadow
      />

      <BuildingInstanceBatch
        matrices={balconyMatrices}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_WHITE_STONE_V3}
      />
      <BuildingInstanceBatch
        matrices={railMatrices}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_BALCONY_GLASS_V3}
      />
      <BuildingInstanceBatch
        matrices={whiteFrameMatrices}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={REAL_CITY_WHITE_STONE_V3}
      />

      {/* Green crown / rooftop sky garden. */}
      <mesh
        position={[0, baseY + height + 1.15 * scale, 0]}
        scale={[5.6 * scale, 0.85 * scale, 4.7 * scale]}
        castShadow
      >
        <cylinderGeometry args={[1, 1, 1, 48]} />
        <primitive object={REAL_CITY_MULLION_V3} attach="material" />
      </mesh>
      <mesh
        position={[0, baseY + height + 1.46 * scale, 0]}
        scale={[4.9 * scale, 0.2 * scale, 4 * scale]}
      >
        <cylinderGeometry args={[1, 1, 1, 48]} />
        <primitive object={CITY_GRASS_MATERIAL} attach="material" />
      </mesh>
      {[-2.5, -0.9, 0.9, 2.5].map((treeX) => (
        <mesh
          key={`sky-tree-${treeX}`}
          geometry={CITY_TREE_CROWN_GEOMETRY}
          material={CITY_TREE_CROWN_MATERIAL}
          position={[treeX * scale, baseY + height + 2.15 * scale, 0.2 * scale]}
          scale={[0.42 * scale, 0.5 * scale, 0.42 * scale]}
        />
      ))}
    </group>
  );
}

function DenseUrbanBackdropV10({ isNight }: { isNight: boolean }) {
  const batches = useMemo(() => {
    const random = seeded(10107);
    const shells: Record<'blue' | 'steel' | 'aqua', THREE.Matrix4[]> = {
      blue: [],
      steel: [],
      aqua: [],
    };
    const podiums: THREE.Matrix4[] = [];
    const roofs: THREE.Matrix4[] = [];
    const cores: THREE.Matrix4[] = [];
    const bands: THREE.Matrix4[] = [];

    const tones: Array<'blue' | 'steel' | 'aqua'> = ['blue', 'steel', 'aqua'];

    for (let row = 0; row < 13; row += 1) {
      const z = -58 - row * 14.5 + (random() - 0.5) * 5;

      for (const side of [-1, 1] as const) {
        for (let slot = 0; slot < 2; slot += 1) {
          const offset = 37 + slot * 15 + random() * 10 + row * 0.7;
          const width = 5 + random() * 4.4;
          const depth = 5.2 + random() * 4.8;
          const tall = random() > 0.76;
          const height = tall ? 24 + random() * 15 : 9 + random() * 16;
          const x = roadBend(z) + side * offset;
          const yaw = roadYaw(z) + (random() - 0.5) * 0.12;
          const tone = tones[Math.floor(random() * tones.length)];

          shells[tone].push(
            localMatrixV3([x, roadElevation(z) + height / 2 + 0.9, z], [0, yaw, 0], [width, height, depth]),
          );
          podiums.push(
            localMatrixV3([x, roadElevation(z) + 0.72, z], [0, yaw, 0], [width * 1.1, 1.45, depth * 1.12]),
          );
          roofs.push(
            localMatrixV3([x, roadElevation(z) + height + 1.35, z - depth * 0.08], [0, yaw, 0], [width * 0.34, 0.85, depth * 0.34]),
          );
          cores.push(
            localMatrixV3([x + side * width * 0.36, roadElevation(z) + height * 0.47 + 0.9, z - depth * 0.28], [0, yaw, 0], [width * 0.11, height * 0.83, depth * 0.18]),
          );

          const bandCount = height > 20 ? 3 : 2;
          for (let band = 1; band <= bandCount; band += 1) {
            bands.push(
              localMatrixV3(
                [x, roadElevation(z) + 0.9 + (height * band) / (bandCount + 1), z + depth / 2 + 0.035],
                [0, yaw, 0],
                [width * 0.96, 0.055, 0.06],
              ),
            );
          }
        }
      }
    }

    return { shells, podiums, roofs, cores, bands };
  }, []);

  const glass = REAL_CITY_GLASS_V3[isNight ? 'night' : 'day'];

  return (
    <group dispose={null}>
      <BuildingInstanceBatch matrices={batches.shells.blue} geometry={SHARED_UNIT_BOX_GEOMETRY} material={glass.blue} />
      <BuildingInstanceBatch matrices={batches.shells.steel} geometry={SHARED_UNIT_BOX_GEOMETRY} material={glass.steel} />
      <BuildingInstanceBatch matrices={batches.shells.aqua} geometry={SHARED_UNIT_BOX_GEOMETRY} material={glass.aqua} />
      <BuildingInstanceBatch matrices={batches.podiums} geometry={SHARED_UNIT_BOX_GEOMETRY} material={FAR_CITY_STONE_V10} />
      <BuildingInstanceBatch matrices={batches.roofs} geometry={SHARED_UNIT_BOX_GEOMETRY} material={FAR_CITY_ROOF_V10} />
      <BuildingInstanceBatch matrices={batches.cores} geometry={SHARED_UNIT_BOX_GEOMETRY} material={REAL_CITY_CORE_V3} />
      <BuildingInstanceBatch matrices={batches.bands} geometry={SHARED_UNIT_BOX_GEOMETRY} material={FAR_CITY_BAND_V10} />
    </group>
  );
}

function RealArchitecturalCityV10({ isNight }: { isNight: boolean }) {
  return (
    <group dispose={null}>
      {/* Dense, visible far-city carpet first. */}
      <DenseUrbanBackdropV10 isNight={isNight} />

      {/* Main foreground / midground landmarks. */}
      <ReferenceCurvedRibbonBuildingV6
        isNight={isNight}
        side="left"
        z={-22}
        offset={29.6}
        scale={0.88}
      />

      {/* The new luxury high-rise is deliberately placed inside the visible skyline,
          not at the far edge, so the user can actually see the change. */}
      <LuxurySkygardenTowerV10
        isNight={isNight}
        side="left"
        z={-70}
        offset={34.2}
        scale={0.9}
      />

      <CityInfillOfficeV7 isNight={isNight} side="left" z={30} offset={29.5} width={8.2} height={15} depth={7.4} tone="steel" yawOffset={0.03} />
      <CityInfillOfficeV7 isNight={isNight} side="right" z={28} offset={30.5} width={8.8} height={16.5} depth={7.8} tone="aqua" yawOffset={-0.03} />
      <CityInfillOfficeV7 isNight={isNight} side="left" z={5} offset={31.6} width={8.4} height={18} depth={7.6} tone="blue" yawOffset={0.02} />
      <CityInfillOfficeV7 isNight={isNight} side="right" z={4} offset={32.4} width={8.6} height={17.5} depth={7.7} tone="steel" yawOffset={-0.02} />

      <TerracedGlassTowerV3 isNight={isNight} side="right" z={-24} offset={31.5} />
      <CurvedExecutiveTowerV3 isNight={isNight} side="right" z={-56} offset={34.5} />
      <TwinCorporateTowerV3 isNight={isNight} side="right" z={-92} offset={38.2} />
      <ResidentialBalconyTowerV3 isNight={isNight} side="left" z={-110} offset={39} />

      <CityInfillOfficeV7 isNight={isNight} side="left" z={-128} offset={38.5} width={8.8} height={21} depth={7.8} tone="aqua" yawOffset={0.018} />
      <CityInfillOfficeV7 isNight={isNight} side="right" z={-132} offset={40.5} width={9.1} height={20} depth={8} tone="steel" yawOffset={-0.02} />
      <LowRiseAtriumV3 isNight={isNight} side="left" z={-150} offset={40.5} />
      <LowRiseAtriumV3 isNight={isNight} side="right" z={-160} offset={43} />

      <ReferenceCurvedRibbonBuildingV6 isNight={isNight} side="right" z={-124} offset={45} scale={0.56} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                V11 - DENSE VOLUMETRIC REALTIME CITY                       */
/* -------------------------------------------------------------------------- */

const CITY_V11_GLASS_DAY = {
  blue: new THREE.MeshPhysicalMaterial({
    color: '#789caf',
    roughness: 0.09,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    ior: 1.47,
    reflectivity: 0.94,
    transparent: true,
    opacity: 0.93,
    depthWrite: true,
    envMapIntensity: 3.15,
  }),
  steel: new THREE.MeshPhysicalMaterial({
    color: '#8aa2ad',
    roughness: 0.1,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    ior: 1.47,
    reflectivity: 0.92,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    envMapIntensity: 2.9,
  }),
  aqua: new THREE.MeshPhysicalMaterial({
    color: '#79a8ad',
    roughness: 0.1,
    metalness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    ior: 1.47,
    reflectivity: 0.9,
    transparent: true,
    opacity: 0.93,
    depthWrite: true,
    envMapIntensity: 2.95,
  }),
};

const CITY_V11_GLASS_NIGHT = {
  blue: new THREE.MeshPhysicalMaterial({
    color: '#365463',
    roughness: 0.18,
    metalness: 0.07,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    reflectivity: 0.8,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    envMapIntensity: 1.25,
    emissive: new THREE.Color('#17313b'),
    emissiveIntensity: 0.15,
  }),
  steel: new THREE.MeshPhysicalMaterial({
    color: '#455b63',
    roughness: 0.18,
    metalness: 0.07,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    reflectivity: 0.8,
    transparent: true,
    opacity: 0.95,
    depthWrite: true,
    envMapIntensity: 1.2,
    emissive: new THREE.Color('#182b31'),
    emissiveIntensity: 0.13,
  }),
  aqua: new THREE.MeshPhysicalMaterial({
    color: '#365d60',
    roughness: 0.18,
    metalness: 0.06,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    reflectivity: 0.8,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    envMapIntensity: 1.2,
    emissive: new THREE.Color('#173236'),
    emissiveIntensity: 0.13,
  }),
};

const CITY_V11_INTERIOR = new THREE.MeshStandardMaterial({
  color: '#1e2b31',
  roughness: 0.7,
  metalness: 0.025,
});
const CITY_V11_INTERIOR_DAY = new THREE.MeshStandardMaterial({
  color: '#425159',
  roughness: 0.62,
  metalness: 0.03,
});
const CITY_V11_FRAME = new THREE.MeshStandardMaterial({
  color: '#6d7d83',
  roughness: 0.27,
  metalness: 0.68,
  envMapIntensity: 1.45,
});
const CITY_V11_DARK_FRAME = new THREE.MeshStandardMaterial({
  color: '#35454b',
  roughness: 0.34,
  metalness: 0.42,
  envMapIntensity: 1.15,
});
const CITY_V11_STONE = new THREE.MeshStandardMaterial({
  color: '#b6b2aa',
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.013,
  roughness: 0.86,
  metalness: 0.02,
});
const CITY_V11_DARK_STONE = new THREE.MeshStandardMaterial({
  color: '#737873',
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.012,
  roughness: 0.84,
  metalness: 0.03,
});
const CITY_V11_SERVICE_ROAD = new THREE.MeshStandardMaterial({
  color: '#4f5354',
  map: ASPHALT_MAP,
  roughness: 0.94,
  metalness: 0.005,
});
const CITY_V11_PAVER = new THREE.MeshStandardMaterial({
  color: '#aaa79f',
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.01,
  roughness: 0.92,
});
const CITY_V11_PARKING = new THREE.MeshStandardMaterial({
  color: '#626666',
  map: ASPHALT_MAP,
  roughness: 0.95,
  metalness: 0.004,
});
const CITY_V11_TREE_TRUNK = new THREE.MeshStandardMaterial({
  color: '#60452e',
  roughness: 0.96,
});
const CITY_V11_TREE_CROWN = new THREE.MeshStandardMaterial({
  color: '#3f6539',
  roughness: 0.94,
});
const CITY_V11_TREE_CROWN_ALT = new THREE.MeshStandardMaterial({
  color: '#527948',
  roughness: 0.94,
});
const CITY_V11_TREE_TRUNK_GEO = new THREE.CylinderGeometry(0.1, 0.16, 1.5, 8);
const CITY_V11_TREE_CROWN_GEO = new THREE.SphereGeometry(0.72, 10, 8);

function cityPartMatrixV11(
  rootPosition: Vec3,
  yaw: number,
  localPosition: Vec3,
  localScale: Vec3,
  localYaw = 0,
) {
  const root = new THREE.Matrix4().compose(
    new THREE.Vector3(...rootPosition),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(...localPosition),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, localYaw, 0)),
    new THREE.Vector3(...localScale),
  );
  return root.multiply(local);
}

function CityBatchV11({
  matrices,
  material,
  geometry = SHARED_UNIT_BOX_GEOMETRY,
  castShadow = false,
  receiveShadow = false,
}: {
  matrices: THREE.Matrix4[];
  material: THREE.Material;
  geometry?: THREE.BufferGeometry;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
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
    />
  );
}

function DenseVolumetricCityV11({ isNight }: { isNight: boolean }) {
  const data = useMemo(() => {
    const random = seeded(11117);
    const shells: Record<'blue' | 'steel' | 'aqua', THREE.Matrix4[]> = {
      blue: [],
      steel: [],
      aqua: [],
    };
    const interiors: THREE.Matrix4[] = [];
    const podiums: THREE.Matrix4[] = [];
    const cores: THREE.Matrix4[] = [];
    const frames: THREE.Matrix4[] = [];
    const bands: THREE.Matrix4[] = [];
    const roofs: THREE.Matrix4[] = [];
    const entrances: THREE.Matrix4[] = [];
    const tones: Array<'blue' | 'steel' | 'aqua'> = ['blue', 'steel', 'aqua'];

    // Three real depth layers on both sides. The first layer is low/mid-rise,
    // the rear layers carry the taller skyline so the road never feels boxed-in.
    for (let row = 0; row < 17; row += 1) {
      const z = 42 - row * 15.2 + (random() - 0.5) * 3.4;

      for (const side of [-1, 1] as const) {
        for (let layer = 0; layer < 3; layer += 1) {
          if (random() < (layer === 0 ? 0.07 : 0.15)) continue;

          const offset = 26.5 + layer * 13.5 + random() * 5.8 + row * 0.18;
          const width = 5.8 + random() * (layer === 0 ? 4.7 : 5.5);
          const depth = 6.2 + random() * 5.6;
          const minH = layer === 0 ? 7 : layer === 1 ? 13 : 18;
          const maxH = layer === 0 ? 18 : layer === 1 ? 31 : 47;
          const height = minH + random() * (maxH - minH);
          const x = roadBend(z) + side * offset;
          const y0 = roadElevation(z);
          const yaw = roadYaw(z) + (random() - 0.5) * 0.12;
          const root: Vec3 = [x, y0, z];
          const tone = tones[Math.floor(random() * tones.length)];
          const floorCount = THREE.MathUtils.clamp(Math.round(height / 3.1), 4, 15);
          const frontMullions = THREE.MathUtils.clamp(Math.round(width / 1.45), 4, 8);
          const sideMullions = THREE.MathUtils.clamp(Math.round(depth / 2.1), 2, 5);

          // Proper volume: opaque occupied mass inside + reflective curtain wall outside.
          interiors.push(
            cityPartMatrixV11(root, yaw, [0, 1.8 + height / 2, 0], [width * 0.93, height * 0.965, depth * 0.93]),
          );
          shells[tone].push(
            cityPartMatrixV11(root, yaw, [0, 1.8 + height / 2, 0], [width, height, depth]),
          );
          podiums.push(
            cityPartMatrixV11(root, yaw, [0, 0.9, 0], [width * 1.12, 1.8, depth * 1.12]),
          );

          // Service core gives every tower a believable solid back/spine.
          cores.push(
            cityPartMatrixV11(
              root,
              yaw,
              [side * width * 0.34, 1.8 + height * 0.48, -depth * 0.31],
              [Math.max(0.6, width * 0.11), height * 0.87, depth * 0.2],
            ),
          );

          // Thin front + rear mullions.
          for (let i = 1; i <= frontMullions; i += 1) {
            const px = (i / (frontMullions + 1) - 0.5) * width;
            frames.push(
              cityPartMatrixV11(root, yaw, [px, 1.8 + height / 2, depth / 2 + 0.035], [0.038, height * 0.96, 0.05]),
              cityPartMatrixV11(root, yaw, [px, 1.8 + height / 2, -depth / 2 - 0.035], [0.038, height * 0.96, 0.05]),
            );
          }

          // Side mullions.
          for (let i = 1; i <= sideMullions; i += 1) {
            const pz = (i / (sideMullions + 1) - 0.5) * depth;
            frames.push(
              cityPartMatrixV11(root, yaw, [width / 2 + 0.035, 1.8 + height / 2, pz], [0.05, height * 0.96, 0.038]),
              cityPartMatrixV11(root, yaw, [-width / 2 - 0.035, 1.8 + height / 2, pz], [0.05, height * 0.96, 0.038]),
            );
          }

          // Floor/spandrel rhythm visible on all sides.
          for (let floor = 1; floor < floorCount; floor += 1) {
            const py = 1.8 + (floor / floorCount) * height;
            bands.push(
              cityPartMatrixV11(root, yaw, [0, py, depth / 2 + 0.032], [width * 0.985, 0.045, 0.045]),
              cityPartMatrixV11(root, yaw, [0, py, -depth / 2 - 0.032], [width * 0.985, 0.045, 0.045]),
              cityPartMatrixV11(root, yaw, [width / 2 + 0.032, py, 0], [0.045, 0.045, depth * 0.985]),
              cityPartMatrixV11(root, yaw, [-width / 2 - 0.032, py, 0], [0.045, 0.045, depth * 0.985]),
            );
          }

          // Entrance canopy and rooftop plant room.
          entrances.push(
            cityPartMatrixV11(root, yaw, [0, 2.25, depth / 2 + 0.78], [width * 0.52, 0.11, 1.45]),
          );
          roofs.push(
            cityPartMatrixV11(root, yaw, [0, 1.8 + height + 0.5, -depth * 0.1], [width * 0.34, 0.82, depth * 0.38]),
          );
        }
      }
    }

    return { shells, interiors, podiums, cores, frames, bands, roofs, entrances };
  }, []);

  const glass = isNight ? CITY_V11_GLASS_NIGHT : CITY_V11_GLASS_DAY;

  return (
    <group dispose={null}>
      <CityBatchV11 matrices={data.interiors} material={isNight ? CITY_V11_INTERIOR : CITY_V11_INTERIOR_DAY} />
      <CityBatchV11 matrices={data.shells.blue} material={glass.blue} />
      <CityBatchV11 matrices={data.shells.steel} material={glass.steel} />
      <CityBatchV11 matrices={data.shells.aqua} material={glass.aqua} />
      <CityBatchV11 matrices={data.podiums} material={CITY_V11_STONE} receiveShadow />
      <CityBatchV11 matrices={data.cores} material={CITY_V11_DARK_STONE} />
      <CityBatchV11 matrices={data.frames} material={CITY_V11_FRAME} />
      <CityBatchV11 matrices={data.bands} material={CITY_V11_DARK_FRAME} />
      <CityBatchV11 matrices={data.roofs} material={CITY_V11_DARK_STONE} />
      <CityBatchV11 matrices={data.entrances} material={CITY_V11_FRAME} />
    </group>
  );
}

function UrbanDistrictFabricV11() {
  const data = useMemo(() => {
    const random = seeded(11291);
    const plaza: THREE.Matrix4[] = [];
    const serviceRoads: THREE.Matrix4[] = [];
    const parking: THREE.Matrix4[] = [];
    const lawn: THREE.Matrix4[] = [];
    const trunks: THREE.Matrix4[] = [];
    const crowns: THREE.Matrix4[] = [];
    const crownsAlt: THREE.Matrix4[] = [];

    for (let row = 0; row < 18; row += 1) {
      const z = 45 - row * 15;
      const yaw = roadYaw(z);
      const y = roadElevation(z);

      for (const side of [-1, 1] as const) {
        const padOffset = side < 0 ? -35.5 : 39.5;
        const serviceOffset = side < 0 ? -22.8 : 25.8;
        const padX = roadBend(z) + padOffset;
        const serviceX = roadBend(z) + serviceOffset;

        plaza.push(
          cityPartMatrixV11([padX, y + 0.01, z], yaw, [0, 0, 0], [24.5, 0.09, 13.8]),
        );
        serviceRoads.push(
          cityPartMatrixV11([serviceX, y + 0.055, z], yaw, [0, 0, 0], [4.2, 0.035, 15.2]),
        );

        if (row % 3 === 0) {
          parking.push(
            cityPartMatrixV11([roadBend(z) + side * 48.5, y + 0.07, z], yaw, [0, 0, 0], [12.5, 0.035, 10.8]),
          );
        } else {
          lawn.push(
            cityPartMatrixV11([roadBend(z) + side * 48.5, y + 0.08, z], yaw, [0, 0, 0], [11.5, 0.05, 9.8]),
          );
        }

        // Tree line between the main road and each city block.
        for (let tree = 0; tree < 3; tree += 1) {
          const localZ = (tree - 1) * 4.4 + (random() - 0.5) * 1.1;
          const offset = side < 0 ? -25.8 - random() * 1.3 : 29.0 + random() * 1.3;
          const x = roadBend(z + localZ) + offset;
          const tz = z + localZ;
          const ty = roadElevation(tz);
          const s = 0.78 + random() * 0.42;

          trunks.push(
            localMatrixV3([x, ty + 0.68 * s, tz], [0, roadYaw(tz), 0], [s, s, s]),
          );
          const crownMatrix = localMatrixV3([x, ty + 1.85 * s, tz], [0, 0, 0], [1.15 * s, 0.92 * s, 1.08 * s]);
          if ((row + tree) % 2 === 0) crowns.push(crownMatrix);
          else crownsAlt.push(crownMatrix);
        }
      }
    }

    return { plaza, serviceRoads, parking, lawn, trunks, crowns, crownsAlt };
  }, []);

  return (
    <group dispose={null}>
      <CityBatchV11 matrices={data.plaza} material={CITY_V11_PAVER} receiveShadow />
      <CityBatchV11 matrices={data.serviceRoads} material={CITY_V11_SERVICE_ROAD} receiveShadow />
      <CityBatchV11 matrices={data.parking} material={CITY_V11_PARKING} receiveShadow />
      <CityBatchV11 matrices={data.lawn} material={CITY_GRASS_MATERIAL} receiveShadow />
      <CityBatchV11 matrices={data.trunks} geometry={CITY_V11_TREE_TRUNK_GEO} material={CITY_V11_TREE_TRUNK} />
      <CityBatchV11 matrices={data.crowns} geometry={CITY_V11_TREE_CROWN_GEO} material={CITY_V11_TREE_CROWN} />
      <CityBatchV11 matrices={data.crownsAlt} geometry={CITY_V11_TREE_CROWN_GEO} material={CITY_V11_TREE_CROWN_ALT} />
    </group>
  );
}

function RealArchitecturalCityV11({ isNight }: { isNight: boolean }) {
  return (
    <group dispose={null}>
      {/* Urban ground fabric removes the empty/desert look. */}
      <UrbanDistrictFabricV11 />

      {/* Dense volumetric background. Every tower has interior depth, mullions,
          spandrels, a core, podium and roof plant instead of a flat paper box. */}
      <DenseVolumetricCityV11 isNight={isNight} />

      {/* Near hero buildings remain deliberately sparse enough to preserve the
          road / unipole sightline, but are now visually surrounded by city. */}
      <ReferenceCurvedRibbonBuildingV6
        isNight={isNight}
        side="left"
        z={-18}
        offset={28.2}
        scale={0.9}
      />

      <LuxurySkygardenTowerV10
        isNight={isNight}
        side="right"
        z={-48}
        offset={36.2}
        scale={1.04}
      />

      <TerracedGlassTowerV3 isNight={isNight} side="left" z={-58} offset={34.2} />
      <CurvedExecutiveTowerV3 isNight={isNight} side="right" z={-86} offset={39.5} />
      <TwinCorporateTowerV3 isNight={isNight} side="left" z={-104} offset={41.5} />
      <ResidentialBalconyTowerV3 isNight={isNight} side="right" z={-120} offset={43.5} />
      <LowRiseAtriumV3 isNight={isNight} side="left" z={-138} offset={42.5} />
      <LowRiseAtriumV3 isNight={isNight} side="right" z={-154} offset={46} />
    </group>
  );
}



/* -------------------------------------------------------------------------- */
/*                  CHENNAI REAL-TIME URBAN CITY - V12                       */
/* -------------------------------------------------------------------------- */

const CHENNAI_V12_OFFWHITE = new THREE.MeshStandardMaterial({
  color: '#d6d1c6',
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.012,
  roughness: 0.88,
  metalness: 0.015,
});
const CHENNAI_V12_WARM_STONE = new THREE.MeshStandardMaterial({
  color: '#b9ad99',
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.012,
  roughness: 0.84,
  metalness: 0.02,
});
const CHENNAI_V12_GREY = new THREE.MeshStandardMaterial({
  color: '#858b88',
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.01,
  roughness: 0.84,
  metalness: 0.025,
});
const CHENNAI_V12_DARK_CORE = new THREE.MeshStandardMaterial({
  color: '#555e5d',
  roughness: 0.7,
  metalness: 0.08,
});
const CHENNAI_V12_FRAME = new THREE.MeshStandardMaterial({
  color: '#7e8e95',
  roughness: 0.25,
  metalness: 0.7,
  envMapIntensity: 1.35,
});
const CHENNAI_V12_DARK_FRAME = new THREE.MeshStandardMaterial({
  color: '#3f4b50',
  roughness: 0.32,
  metalness: 0.45,
  envMapIntensity: 1.1,
});
const CHENNAI_V12_WINDOW = new THREE.MeshPhysicalMaterial({
  color: '#6f98aa',
  roughness: 0.14,
  metalness: 0.06,
  clearcoat: 0.9,
  clearcoatRoughness: 0.07,
  ior: 1.46,
  reflectivity: 0.82,
  envMapIntensity: 1.75,
});
const CHENNAI_V12_BALCONY_RAIL = new THREE.MeshPhysicalMaterial({
  color: '#7795a2',
  roughness: 0.18,
  metalness: 0.06,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  clearcoat: 0.8,
  clearcoatRoughness: 0.08,
  envMapIntensity: 1.35,
});
const CHENNAI_V12_GLASS_DAY = {
  blue: new THREE.MeshPhysicalMaterial({
    color: '#7399aa',
    roughness: 0.09,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    ior: 1.47,
    reflectivity: 0.9,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    envMapIntensity: 2.4,
  }),
  steel: new THREE.MeshPhysicalMaterial({
    color: '#879ba2',
    roughness: 0.1,
    metalness: 0.055,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    ior: 1.47,
    reflectivity: 0.88,
    transparent: true,
    opacity: 0.95,
    depthWrite: true,
    envMapIntensity: 2.25,
  }),
  green: new THREE.MeshPhysicalMaterial({
    color: '#6f9994',
    roughness: 0.105,
    metalness: 0.045,
    clearcoat: 0.95,
    clearcoatRoughness: 0.045,
    ior: 1.47,
    reflectivity: 0.86,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    envMapIntensity: 2.15,
  }),
};
const CHENNAI_V12_GLASS_NIGHT = {
  blue: new THREE.MeshPhysicalMaterial({
    color: '#35515c',
    roughness: 0.18,
    metalness: 0.05,
    clearcoat: 0.88,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    reflectivity: 0.76,
    transparent: true,
    opacity: 0.95,
    depthWrite: true,
    envMapIntensity: 1.15,
    emissive: new THREE.Color('#172b32'),
    emissiveIntensity: 0.13,
  }),
  steel: new THREE.MeshPhysicalMaterial({
    color: '#414f54',
    roughness: 0.19,
    metalness: 0.05,
    clearcoat: 0.86,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    reflectivity: 0.75,
    transparent: true,
    opacity: 0.95,
    depthWrite: true,
    envMapIntensity: 1.05,
    emissive: new THREE.Color('#202a2d'),
    emissiveIntensity: 0.11,
  }),
  green: new THREE.MeshPhysicalMaterial({
    color: '#36524e',
    roughness: 0.19,
    metalness: 0.045,
    clearcoat: 0.86,
    clearcoatRoughness: 0.11,
    ior: 1.47,
    reflectivity: 0.74,
    transparent: true,
    opacity: 0.95,
    depthWrite: true,
    envMapIntensity: 1.05,
    emissive: new THREE.Color('#192c29'),
    emissiveIntensity: 0.11,
  }),
};
const CHENNAI_V12_INTERIOR_DAY = new THREE.MeshStandardMaterial({
  color: '#4b595c',
  roughness: 0.66,
  metalness: 0.025,
});
const CHENNAI_V12_INTERIOR_NIGHT = new THREE.MeshStandardMaterial({
  color: '#1f292b',
  roughness: 0.7,
  metalness: 0.02,
});
const CHENNAI_V12_WARM_WINDOW = new THREE.MeshStandardMaterial({
  color: '#d7c6a5',
  emissive: new THREE.Color('#f1c47c'),
  emissiveIntensity: 0.35,
  roughness: 0.55,
});
const CHENNAI_V12_ROOF_TANK = new THREE.MeshStandardMaterial({
  color: '#1e3139',
  roughness: 0.5,
  metalness: 0.18,
});
const CHENNAI_V12_COMPOUND_WALL = new THREE.MeshStandardMaterial({
  color: '#b7b1a4',
  map: CONCRETE_MAP,
  roughness: 0.92,
});
const CHENNAI_V12_SIDEWALK = new THREE.MeshStandardMaterial({
  color: '#aaa69b',
  map: CONCRETE_MAP,
  bumpMap: CONCRETE_MAP,
  bumpScale: 0.009,
  roughness: 0.93,
});
const CHENNAI_V12_SERVICE_ROAD = new THREE.MeshStandardMaterial({
  color: '#505455',
  map: ASPHALT_MAP,
  roughness: 0.95,
  metalness: 0.003,
});
const CHENNAI_V12_SOIL = new THREE.MeshStandardMaterial({
  color: '#756b58',
  roughness: 0.98,
});
const CHENNAI_V12_TREE_TRUNK = new THREE.MeshStandardMaterial({
  color: '#5b422d',
  roughness: 0.97,
});
const CHENNAI_V12_TREE_CROWN = new THREE.MeshStandardMaterial({
  color: '#496b3d',
  roughness: 0.95,
});
const CHENNAI_V12_TREE_CROWN_DARK = new THREE.MeshStandardMaterial({
  color: '#355732',
  roughness: 0.95,
});
const CHENNAI_V12_TREE_TRUNK_GEO = new THREE.CylinderGeometry(0.11, 0.16, 1.7, 8);
const CHENNAI_V12_TREE_CROWN_GEO = new THREE.SphereGeometry(0.8, 11, 8);
const CHENNAI_V12_TANK_GEO = new THREE.CylinderGeometry(0.55, 0.55, 0.95, 16);

function ChennaiCurtainWallBlockV12({
  isNight,
  width,
  height,
  depth,
  position = [0, 0, 0],
  tone = 'steel',
  floors,
  frontBays,
  sideBays,
}: {
  isNight: boolean;
  width: number;
  height: number;
  depth: number;
  position?: Vec3;
  tone?: 'blue' | 'steel' | 'green';
  floors: number;
  frontBays: number;
  sideBays: number;
}) {
  const center: Vec3 = [position[0], position[1] + height / 2, position[2]];
  const glass = (isNight ? CHENNAI_V12_GLASS_NIGHT : CHENNAI_V12_GLASS_DAY)[tone];

  const mullions = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    for (let i = 1; i <= frontBays; i += 1) {
      const x = (i / (frontBays + 1) - 0.5) * width;
      matrices.push(
        localMatrixV3([x, center[1], center[2] + depth / 2 + 0.03], [0, 0, 0], [0.035, height * 0.965, 0.045]),
        localMatrixV3([x, center[1], center[2] - depth / 2 - 0.03], [0, 0, 0], [0.035, height * 0.965, 0.045]),
      );
    }
    for (let i = 1; i <= sideBays; i += 1) {
      const z = center[2] + (i / (sideBays + 1) - 0.5) * depth;
      matrices.push(
        localMatrixV3([center[0] + width / 2 + 0.03, center[1], z], [0, 0, 0], [0.045, height * 0.965, 0.035]),
        localMatrixV3([center[0] - width / 2 - 0.03, center[1], z], [0, 0, 0], [0.045, height * 0.965, 0.035]),
      );
    }
    return matrices;
  }, [center, depth, frontBays, height, sideBays, width]);

  const floorBands = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    for (let floor = 1; floor < floors; floor += 1) {
      const y = position[1] + (floor / floors) * height;
      matrices.push(
        localMatrixV3([position[0], y, position[2] + depth / 2 + 0.032], [0, 0, 0], [width * 0.985, 0.045, 0.045]),
        localMatrixV3([position[0], y, position[2] - depth / 2 - 0.032], [0, 0, 0], [width * 0.985, 0.045, 0.045]),
        localMatrixV3([position[0] + width / 2 + 0.032, y, position[2]], [0, 0, 0], [0.045, 0.045, depth * 0.985]),
        localMatrixV3([position[0] - width / 2 - 0.032, y, position[2]], [0, 0, 0], [0.045, 0.045, depth * 0.985]),
      );
    }
    return matrices;
  }, [depth, floors, height, position, width]);

  const slabs = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    for (let floor = 1; floor < floors; floor += 1) {
      const y = position[1] + (floor / floors) * height;
      matrices.push(localMatrixV3([position[0], y - 0.03, position[2]], [0, 0, 0], [width * 0.9, 0.075, depth * 0.9]));
    }
    return matrices;
  }, [depth, floors, height, position, width]);

  return (
    <group dispose={null}>
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={isNight ? CHENNAI_V12_INTERIOR_NIGHT : CHENNAI_V12_INTERIOR_DAY}
        position={center}
        scale={[width * 0.94, height * 0.975, depth * 0.94]}
      />
      <mesh
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={glass}
        position={center}
        scale={[width, height, depth]}
      />
      <CityBatchV11 matrices={mullions} material={CHENNAI_V12_FRAME} />
      <CityBatchV11 matrices={floorBands} material={CHENNAI_V12_DARK_FRAME} />
      <CityBatchV11 matrices={slabs} material={isNight ? CHENNAI_V12_INTERIOR_NIGHT : CHENNAI_V12_INTERIOR_DAY} />
    </group>
  );
}

function ChennaiITOfficeV12({
  isNight,
  side,
  z,
  offset,
  scale = 1,
  tone = 'steel',
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
  scale?: number;
  tone?: 'blue' | 'steel' | 'green';
}) {
  const x = side === 'left' ? -offset : offset;
  const width = 13.2 * scale;
  const depth = 10.2 * scale;
  const height = 30 * scale;
  const floors = 10;

  const fins = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    for (let i = 0; i < 7; i += 1) {
      const px = -width * 0.38 + i * (width * 0.76 / 6);
      matrices.push(localMatrixV3([px, 5.2 * scale + height / 2, depth / 2 + 0.12 * scale], [0, 0, 0], [0.07 * scale, height * 0.94, 0.22 * scale]));
    }
    return matrices;
  }, [depth, height, scale, width]);

  return (
    <group
      position={[roadBend(z) + x, roadElevation(z) + 0.14, z]}
      rotation={[0, roadYaw(z) + (side === 'left' ? 0.02 : -0.02), 0]}
      dispose={null}
    >
      <RealBuildingPlazaV3 width={19 * scale} depth={16 * scale} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_OFFWHITE} position={[0, 1.65 * scale, 0]} scale={[16.5 * scale, 3.3 * scale, 12.8 * scale]} />
      <ChennaiCurtainWallBlockV12
        isNight={isNight}
        width={width}
        height={height}
        depth={depth}
        position={[0, 3.3 * scale, 0]}
        tone={tone}
        floors={floors}
        frontBays={9}
        sideBays={6}
      />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_OFFWHITE} position={[-width * 0.43, 3.3 * scale + height * 0.5, -depth * 0.16]} scale={[1.55 * scale, height * 0.96, depth * 0.72]} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_WARM_STONE} position={[width * 0.41, 3.3 * scale + height * 0.5, -depth * 0.18]} scale={[1.3 * scale, height * 0.82, depth * 0.56]} />
      <CityBatchV11 matrices={fins} material={CHENNAI_V12_FRAME} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_FRAME} position={[0, 4.2 * scale, depth / 2 + 1.0 * scale]} scale={[7.2 * scale, 0.12 * scale, 1.55 * scale]} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_DARK_CORE} position={[0, 3.3 * scale + height + 0.55 * scale, -1.2 * scale]} scale={[4.6 * scale, 0.9 * scale, 4.3 * scale]} />
    </group>
  );
}

function ChennaiApartmentV12({
  isNight,
  side,
  z,
  offset,
  scale = 1,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
  scale?: number;
}) {
  const x = side === 'left' ? -offset : offset;
  const width = 11.6 * scale;
  const depth = 10.6 * scale;
  const height = 29.5 * scale;
  const floors = 11;

  const windows = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const cols = 5;
    for (let floor = 0; floor < floors; floor += 1) {
      const y = 3.2 * scale + (floor + 0.52) * (height / floors);
      for (let col = 0; col < cols; col += 1) {
        const px = -width * 0.37 + col * (width * 0.74 / (cols - 1));
        matrices.push(localMatrixV3([px, y, depth / 2 + 0.035], [0, 0, 0], [0.95 * scale, 1.35 * scale, 0.045]));
      }
    }
    return matrices;
  }, [depth, floors, height, scale, width]);

  const balconies = useMemo(() => {
    const slabs: THREE.Matrix4[] = [];
    const rails: THREE.Matrix4[] = [];
    for (let floor = 1; floor < floors; floor += 1) {
      const y = 3.2 * scale + floor * (height / floors);
      const shift = floor % 2 === 0 ? -width * 0.18 : width * 0.18;
      slabs.push(localMatrixV3([shift, y, depth / 2 + 0.62 * scale], [0, 0, 0], [width * 0.48, 0.12 * scale, 1.25 * scale]));
      rails.push(localMatrixV3([shift, y + 0.48 * scale, depth / 2 + 1.22 * scale], [0, 0, 0], [width * 0.45, 0.72 * scale, 0.045]));
    }
    return { slabs, rails };
  }, [depth, floors, height, scale, width]);

  return (
    <group position={[roadBend(z) + x, roadElevation(z) + 0.14, z]} rotation={[0, roadYaw(z), 0]} dispose={null}>
      <RealBuildingPlazaV3 width={16.5 * scale} depth={15.2 * scale} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_OFFWHITE} position={[0, 1.55 * scale, 0]} scale={[13.8 * scale, 3.1 * scale, 12.2 * scale]} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_OFFWHITE} position={[0, 3.2 * scale + height / 2, 0]} scale={[width, height, depth]} />
      <CityBatchV11 matrices={windows} material={isNight ? CHENNAI_V12_WARM_WINDOW : CHENNAI_V12_WINDOW} />
      <CityBatchV11 matrices={balconies.slabs} material={CHENNAI_V12_WARM_STONE} />
      <CityBatchV11 matrices={balconies.rails} material={CHENNAI_V12_BALCONY_RAIL} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_GREY} position={[-width * 0.4, 3.2 * scale + height * 0.5, -depth * 0.18]} scale={[1.2 * scale, height * 0.9, depth * 0.7]} />
      <mesh geometry={CHENNAI_V12_TANK_GEO} material={CHENNAI_V12_ROOF_TANK} position={[-1.15 * scale, 3.2 * scale + height + 0.8 * scale, -1.2 * scale]} scale={[scale, scale, scale]} />
      <mesh geometry={CHENNAI_V12_TANK_GEO} material={CHENNAI_V12_ROOF_TANK} position={[1.1 * scale, 3.2 * scale + height + 0.8 * scale, -1.2 * scale]} scale={[scale, scale, scale]} />
    </group>
  );
}

function ChennaiHotelBlockV12({
  isNight,
  side,
  z,
  offset,
  scale = 1,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
  scale?: number;
}) {
  const x = side === 'left' ? -offset : offset;
  const width = 12.8 * scale;
  const depth = 9.8 * scale;
  const height = 25 * scale;
  const floors = 9;

  const windows = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    for (let floor = 0; floor < floors; floor += 1) {
      const y = 4.4 * scale + (floor + 0.52) * (height / floors);
      for (let col = 0; col < 7; col += 1) {
        const px = -width * 0.39 + col * (width * 0.78 / 6);
        matrices.push(localMatrixV3([px, y, depth / 2 + 0.035], [0, 0, 0], [0.8 * scale, 1.15 * scale, 0.045]));
      }
    }
    return matrices;
  }, [depth, floors, height, scale, width]);

  return (
    <group position={[roadBend(z) + x, roadElevation(z) + 0.14, z]} rotation={[0, roadYaw(z) + (side === 'left' ? 0.025 : -0.025), 0]} dispose={null}>
      <RealBuildingPlazaV3 width={17.6 * scale} depth={14.5 * scale} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_WARM_STONE} position={[0, 1.9 * scale, 0]} scale={[15.4 * scale, 3.8 * scale, 11.8 * scale]} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_GREY} position={[0, 4.0 * scale + height / 2, 0]} scale={[width, height, depth]} />
      <CityBatchV11 matrices={windows} material={isNight ? CHENNAI_V12_WARM_WINDOW : CHENNAI_V12_WINDOW} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_OFFWHITE} position={[0, 4.0 * scale + height + 0.45 * scale, 0]} scale={[width * 0.72, 0.8 * scale, depth * 0.65]} />
      <mesh geometry={CHENNAI_V12_TANK_GEO} material={CHENNAI_V12_ROOF_TANK} position={[0, 4.0 * scale + height + 1.4 * scale, -1.2 * scale]} scale={[0.9 * scale, 0.9 * scale, 0.9 * scale]} />
    </group>
  );
}

function ChennaiTechCampusV12({
  isNight,
  side,
  z,
  offset,
  scale = 1,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
  scale?: number;
}) {
  const x = side === 'left' ? -offset : offset;
  return (
    <group position={[roadBend(z) + x, roadElevation(z) + 0.14, z]} rotation={[0, roadYaw(z), 0]} dispose={null}>
      <RealBuildingPlazaV3 width={25 * scale} depth={18 * scale} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_OFFWHITE} position={[0, 1.5 * scale, 0]} scale={[22 * scale, 3 * scale, 14.5 * scale]} />
      <ChennaiCurtainWallBlockV12 isNight={isNight} width={8.5 * scale} height={17 * scale} depth={10 * scale} position={[-5.2 * scale, 3.0 * scale, 0]} tone="steel" floors={6} frontBays={6} sideBays={4} />
      <ChennaiCurtainWallBlockV12 isNight={isNight} width={8.5 * scale} height={17 * scale} depth={10 * scale} position={[5.2 * scale, 3.0 * scale, 0]} tone="green" floors={6} frontBays={6} sideBays={4} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={(isNight ? CHENNAI_V12_GLASS_NIGHT : CHENNAI_V12_GLASS_DAY).blue} position={[0, 8.8 * scale, 3.9 * scale]} scale={[3.8 * scale, 9.2 * scale, 1.9 * scale]} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CITY_GRASS_MATERIAL} position={[0, 3.15 * scale, 0]} scale={[18 * scale, 0.11 * scale, 10.8 * scale]} />
    </group>
  );
}

function ChennaiHeroCorporateV12({
  isNight,
  side,
  z,
  offset,
}: {
  isNight: boolean;
  side: 'left' | 'right';
  z: number;
  offset: number;
}) {
  const x = side === 'left' ? -offset : offset;
  return (
    <group position={[roadBend(z) + x, roadElevation(z) + 0.14, z]} rotation={[0, roadYaw(z) + (side === 'left' ? 0.035 : -0.035), 0]} dispose={null}>
      <RealBuildingPlazaV3 width={21} depth={18} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_OFFWHITE} position={[0, 1.9, 0]} scale={[17.5, 3.8, 13.5]} />
      <ChennaiCurtainWallBlockV12 isNight={isNight} width={10.2} height={43} depth={9.2} position={[0.7, 3.8, 0]} tone="blue" floors={15} frontBays={8} sideBays={5} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_OFFWHITE} position={[-4.6, 24.2, -0.4]} scale={[2.0, 39.5, 8.2]} />
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_WARM_STONE} position={[4.7, 18.5, -1.2]} scale={[1.3, 28, 6.4]} />
      {[9.6, 18.4, 27.2, 36].map((y) => (
        <mesh key={y} geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_FRAME} position={[0.7, 3.8 + y, 4.72]} scale={[9.8, 0.11, 0.16]} />
      ))}
      <mesh geometry={SHARED_UNIT_BOX_GEOMETRY} material={CHENNAI_V12_DARK_CORE} position={[0.5, 47.35, -1.0]} scale={[5.2, 0.9, 4.4]} />
    </group>
  );
}

function ChennaiUrbanBackdropV12({ isNight }: { isNight: boolean }) {
  const data = useMemo(() => {
    const random = seeded(12026);
    const concreteA: THREE.Matrix4[] = [];
    const concreteB: THREE.Matrix4[] = [];
    const concreteC: THREE.Matrix4[] = [];
    const glassBlue: THREE.Matrix4[] = [];
    const glassSteel: THREE.Matrix4[] = [];
    const interiors: THREE.Matrix4[] = [];
    const windows: THREE.Matrix4[] = [];
    const frames: THREE.Matrix4[] = [];
    const bands: THREE.Matrix4[] = [];
    const cores: THREE.Matrix4[] = [];
    const podiums: THREE.Matrix4[] = [];
    const roofs: THREE.Matrix4[] = [];
    const tanks: THREE.Matrix4[] = [];

    for (let row = 0; row < 18; row += 1) {
      const z = 50 - row * 14.0 + (random() - 0.5) * 2.8;
      for (const side of [-1, 1] as const) {
        for (let layer = 0; layer < 3; layer += 1) {
          if (random() < 0.045) continue;
          const offset = 27.5 + layer * 12.0 + random() * 5.0 + row * 0.12;
          const root: Vec3 = [roadBend(z) + side * offset, roadElevation(z), z];
          const yaw = roadYaw(z) + (random() - 0.5) * 0.08;
          const width = 6.5 + random() * 6.5;
          const depth = 6.8 + random() * 5.8;
          const minH = layer === 0 ? 7.5 : layer === 1 ? 11 : 13;
          const maxH = layer === 0 ? 18 : layer === 1 ? 24 : 31;
          const height = minH + random() * (maxH - minH);
          const typeRoll = random();

          podiums.push(cityPartMatrixV11(root, yaw, [0, 0.7, 0], [width * 1.1, 1.4, depth * 1.1]));

          if (typeRoll < 0.54) {
            const bucket = typeRoll < 0.18 ? concreteA : typeRoll < 0.37 ? concreteB : concreteC;
            bucket.push(cityPartMatrixV11(root, yaw, [0, 1.4 + height / 2, 0], [width, height, depth]));
            const floors = THREE.MathUtils.clamp(Math.round(height / 3), 3, 10);
            const cols = THREE.MathUtils.clamp(Math.round(width / 1.8), 3, 7);
            for (let floor = 0; floor < floors; floor += 1) {
              const py = 1.4 + (floor + 0.55) * (height / floors);
              for (let col = 0; col < cols; col += 1) {
                const px = -width * 0.38 + col * (width * 0.76 / Math.max(1, cols - 1));
                windows.push(cityPartMatrixV11(root, yaw, [px, py, depth / 2 + 0.03], [0.72, 0.95, 0.04]));
              }
            }
            cores.push(cityPartMatrixV11(root, yaw, [side * width * 0.4, 1.4 + height * 0.48, -depth * 0.2], [Math.max(0.65, width * 0.1), height * 0.88, depth * 0.4]));
            if (height > 15) {
              tanks.push(cityPartMatrixV11(root, yaw, [-0.85, 1.4 + height + 0.55, -0.9], [0.65, 0.85, 0.65]));
              tanks.push(cityPartMatrixV11(root, yaw, [0.85, 1.4 + height + 0.55, -0.9], [0.65, 0.85, 0.65]));
            }
          } else {
            interiors.push(cityPartMatrixV11(root, yaw, [0, 1.5 + height / 2, 0], [width * 0.94, height * 0.97, depth * 0.94]));
            (typeRoll < 0.78 ? glassSteel : glassBlue).push(cityPartMatrixV11(root, yaw, [0, 1.5 + height / 2, 0], [width, height, depth]));
            const floors = THREE.MathUtils.clamp(Math.round(height / 3.15), 4, 10);
            const bays = THREE.MathUtils.clamp(Math.round(width / 1.6), 4, 7);
            for (let i = 1; i <= bays; i += 1) {
              const px = (i / (bays + 1) - 0.5) * width;
              frames.push(cityPartMatrixV11(root, yaw, [px, 1.5 + height / 2, depth / 2 + 0.03], [0.035, height * 0.95, 0.045]));
            }
            for (let floor = 1; floor < floors; floor += 1) {
              const py = 1.5 + floor * (height / floors);
              bands.push(cityPartMatrixV11(root, yaw, [0, py, depth / 2 + 0.03], [width * 0.98, 0.045, 0.045]));
            }
            cores.push(cityPartMatrixV11(root, yaw, [side * width * 0.38, 1.5 + height * 0.48, -depth * 0.28], [Math.max(0.6, width * 0.11), height * 0.86, depth * 0.22]));
          }
          roofs.push(cityPartMatrixV11(root, yaw, [0, 1.5 + height + 0.35, -depth * 0.08], [width * 0.34, 0.58, depth * 0.36]));
        }
      }
    }

    return { concreteA, concreteB, concreteC, glassBlue, glassSteel, interiors, windows, frames, bands, cores, podiums, roofs, tanks };
  }, []);

  const glass = isNight ? CHENNAI_V12_GLASS_NIGHT : CHENNAI_V12_GLASS_DAY;
  return (
    <group dispose={null}>
      <CityBatchV11 matrices={data.podiums} material={CHENNAI_V12_WARM_STONE} />
      <CityBatchV11 matrices={data.concreteA} material={CHENNAI_V12_OFFWHITE} />
      <CityBatchV11 matrices={data.concreteB} material={CHENNAI_V12_WARM_STONE} />
      <CityBatchV11 matrices={data.concreteC} material={CHENNAI_V12_GREY} />
      <CityBatchV11 matrices={data.interiors} material={isNight ? CHENNAI_V12_INTERIOR_NIGHT : CHENNAI_V12_INTERIOR_DAY} />
      <CityBatchV11 matrices={data.glassBlue} material={glass.blue} />
      <CityBatchV11 matrices={data.glassSteel} material={glass.steel} />
      <CityBatchV11 matrices={data.windows} material={isNight ? CHENNAI_V12_WARM_WINDOW : CHENNAI_V12_WINDOW} />
      <CityBatchV11 matrices={data.frames} material={CHENNAI_V12_FRAME} />
      <CityBatchV11 matrices={data.bands} material={CHENNAI_V12_DARK_FRAME} />
      <CityBatchV11 matrices={data.cores} material={CHENNAI_V12_DARK_CORE} />
      <CityBatchV11 matrices={data.roofs} material={CHENNAI_V12_DARK_CORE} />
      <CityBatchV11 matrices={data.tanks} material={CHENNAI_V12_ROOF_TANK} />
    </group>
  );
}

function ChennaiGroundFabricV12() {
  const data = useMemo(() => {
    const random = seeded(12112);
    const sidewalks: THREE.Matrix4[] = [];
    const serviceRoads: THREE.Matrix4[] = [];
    const compounds: THREE.Matrix4[] = [];
    const soilBeds: THREE.Matrix4[] = [];
    const trunks: THREE.Matrix4[] = [];
    const crowns: THREE.Matrix4[] = [];
    const crownsDark: THREE.Matrix4[] = [];

    for (let row = 0; row < 20; row += 1) {
      const z = 52 - row * 13.2;
      const yaw = roadYaw(z);
      const y = roadElevation(z);
      for (const side of [-1, 1] as const) {
        const sidewalkOffset = side < 0 ? -20.9 : 23.9;
        const serviceOffset = side < 0 ? -24.2 : 27.2;
        const wallOffset = side < 0 ? -27.2 : 30.2;
        sidewalks.push(cityPartMatrixV11([roadBend(z) + side * Math.abs(sidewalkOffset), y + 0.05, z], yaw, [0, 0, 0], [3.2, 0.08, 13.4]));
        serviceRoads.push(cityPartMatrixV11([roadBend(z) + side * Math.abs(serviceOffset), y + 0.045, z], yaw, [0, 0, 0], [3.8, 0.035, 13.4]));
        compounds.push(cityPartMatrixV11([roadBend(z) + side * Math.abs(wallOffset), y + 0.36, z], yaw, [0, 0, 0], [0.16, 0.7, 13.2]));

        if (row % 4 === 1) {
          soilBeds.push(cityPartMatrixV11([roadBend(z) + side * 34.8, y + 0.06, z], yaw, [0, 0, 0], [9.2, 0.05, 7.5]));
        }

        for (let tree = 0; tree < 3; tree += 1) {
          const localZ = (tree - 1) * 4.2 + (random() - 0.5) * 0.9;
          const tz = z + localZ;
          const offset = side < 0 ? -22.0 - random() * 1.0 : 25.0 + random() * 1.0;
          const tx = roadBend(tz) + offset;
          const ty = roadElevation(tz);
          const s = 0.7 + random() * 0.4;
          trunks.push(localMatrixV3([tx, ty + 0.78 * s, tz], [0, 0, 0], [s, s, s]));
          const crown = localMatrixV3([tx, ty + 2.0 * s, tz], [0, 0, 0], [1.05 * s, 0.92 * s, 1.05 * s]);
          if ((row + tree) % 2 === 0) crowns.push(crown); else crownsDark.push(crown);
        }
      }
    }

    return { sidewalks, serviceRoads, compounds, soilBeds, trunks, crowns, crownsDark };
  }, []);

  return (
    <group dispose={null}>
      <CityBatchV11 matrices={data.sidewalks} material={CHENNAI_V12_SIDEWALK} receiveShadow />
      <CityBatchV11 matrices={data.serviceRoads} material={CHENNAI_V12_SERVICE_ROAD} receiveShadow />
      <CityBatchV11 matrices={data.compounds} material={CHENNAI_V12_COMPOUND_WALL} />
      <CityBatchV11 matrices={data.soilBeds} material={CHENNAI_V12_SOIL} />
      <CityBatchV11 matrices={data.trunks} geometry={CHENNAI_V12_TREE_TRUNK_GEO} material={CHENNAI_V12_TREE_TRUNK} />
      <CityBatchV11 matrices={data.crowns} geometry={CHENNAI_V12_TREE_CROWN_GEO} material={CHENNAI_V12_TREE_CROWN} />
      <CityBatchV11 matrices={data.crownsDark} geometry={CHENNAI_V12_TREE_CROWN_GEO} material={CHENNAI_V12_TREE_CROWN_DARK} />
    </group>
  );
}

function ChennaiArchitecturalCityV12({ isNight }: { isNight: boolean }) {
  return (
    <group dispose={null}>
      <ChennaiGroundFabricV12 />
      <ChennaiUrbanBackdropV12 isNight={isNight} />

      {/* Near buildings intentionally use Chennai-like corporate / residential massing,
          not Dubai-style luxury supertalls. */}
      <ChennaiITOfficeV12 isNight={isNight} side="left" z={18} offset={29.6} scale={0.9} tone="steel" />
      <ChennaiApartmentV12 isNight={isNight} side="right" z={14} offset={31.5} scale={0.88} />
      <ChennaiTechCampusV12 isNight={isNight} side="right" z={-20} offset={34.0} scale={0.88} />
      <ChennaiHotelBlockV12 isNight={isNight} side="left" z={-28} offset={32.8} scale={0.9} />

      <ChennaiHeroCorporateV12 isNight={isNight} side="left" z={-62} offset={36.5} />
      <ChennaiITOfficeV12 isNight={isNight} side="right" z={-58} offset={37.6} scale={1.0} tone="blue" />
      <ChennaiApartmentV12 isNight={isNight} side="left" z={-92} offset={39.2} scale={1.0} />
      <ChennaiHotelBlockV12 isNight={isNight} side="right" z={-98} offset={40.5} scale={1.0} />
      <ChennaiITOfficeV12 isNight={isNight} side="left" z={-126} offset={43.5} scale={0.94} tone="green" />
      <ChennaiTechCampusV12 isNight={isNight} side="right" z={-132} offset={44.8} scale={0.9} />
      <ChennaiApartmentV12 isNight={isNight} side="right" z={-164} offset={47.5} scale={0.88} />
      <ChennaiHotelBlockV12 isNight={isNight} side="left" z={-170} offset={46.5} scale={0.9} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                           METRO VIADUCT + TRAIN                            */
/* -------------------------------------------------------------------------- */

function RealisticMetroViaductV2() {
  const deckRef = useRef<THREE.InstancedMesh>(null);
  const parapetRef = useRef<THREE.InstancedMesh>(null);
  const edgeBeamRef = useRef<THREE.InstancedMesh>(null);
  const railRef = useRef<THREE.InstancedMesh>(null);
  const sleeperRef = useRef<THREE.InstancedMesh>(null);
  const columnRef = useRef<THREE.InstancedMesh>(null);
  const footingRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const bearingRef = useRef<THREE.InstancedMesh>(null);
  const jointRef = useRef<THREE.InstancedMesh>(null);

  const segments = useMemo(() => {
    return Array.from({ length: 46 }, (_, index) => {
      const t = index / 45;
      const frame = metroFrame(t);
      const segmentLength = METRO_CURVE_LENGTH / 44.6;
      return { ...frame, t, segmentLength };
    });
  }, []);

  const columns = useMemo(() => segments.filter((_, index) => index % 4 === 1), [segments]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();

    segments.forEach((segment, index) => {
      const normal = new THREE.Vector3(segment.tangent.z, 0, -segment.tangent.x).normalize();

      dummy.position.copy(segment.point).add(new THREE.Vector3(0, -0.34, 0));
      dummy.rotation.set(0, segment.yaw, 0);
      dummy.scale.set(5.2, 0.62, segment.segmentLength * 1.06);
      dummy.updateMatrix();
      deckRef.current?.setMatrixAt(index, dummy.matrix);

      for (let side = 0; side < 2; side += 1) {
        const sign = side === 0 ? -1 : 1;

        dummy.position
          .copy(segment.point)
          .addScaledVector(normal, sign * 2.48)
          .add(new THREE.Vector3(0, 0.4, 0));
        dummy.rotation.set(0, segment.yaw, 0);
        dummy.scale.set(0.2, 0.8, segment.segmentLength * 1.08);
        dummy.updateMatrix();
        parapetRef.current?.setMatrixAt(index * 2 + side, dummy.matrix);

        dummy.position
          .copy(segment.point)
          .addScaledVector(normal, sign * 2.05)
          .add(new THREE.Vector3(0, -0.78, 0));
        dummy.scale.set(0.42, 0.42, segment.segmentLength * 1.07);
        dummy.updateMatrix();
        edgeBeamRef.current?.setMatrixAt(index * 2 + side, dummy.matrix);
      }

      for (let rail = 0; rail < 2; rail += 1) {
        dummy.position
          .copy(segment.point)
          .addScaledVector(normal, rail === 0 ? -0.72 : 0.72)
          .add(new THREE.Vector3(0, 0.36, 0));
        dummy.rotation.set(0, segment.yaw, 0);
        dummy.scale.set(0.07, 0.08, segment.segmentLength * 1.1);
        dummy.updateMatrix();
        railRef.current?.setMatrixAt(index * 2 + rail, dummy.matrix);
      }

      [-0.27, 0.27].forEach((step, sleeperIndex) => {
        dummy.position
          .copy(segment.point)
          .addScaledVector(segment.tangent, step * segment.segmentLength)
          .add(new THREE.Vector3(0, 0.25, 0));
        dummy.rotation.set(0, segment.yaw, 0);
        dummy.scale.set(2.05, 0.1, 0.34);
        dummy.updateMatrix();
        sleeperRef.current?.setMatrixAt(index * 2 + sleeperIndex, dummy.matrix);
      });

      if (index % 4 === 0) {
        dummy.position.copy(segment.point).add(new THREE.Vector3(0, 0.015, 0));
        dummy.rotation.set(0, segment.yaw, 0);
        dummy.scale.set(4.92, 0.045, 0.07);
        dummy.updateMatrix();
        jointRef.current?.setMatrixAt(Math.floor(index / 4), dummy.matrix);
      }
    });

    columns.forEach((column, index) => {
      const pierHeight = column.point.y - 1.02;

      dummy.position.set(column.point.x, 0.34 + pierHeight / 2, column.point.z);
      dummy.rotation.set(0, column.yaw, 0);
      dummy.scale.set(1.16, pierHeight, 1.46);
      dummy.updateMatrix();
      columnRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(column.point.x, 0.22, column.point.z);
      dummy.scale.set(1.62, 0.44, 1.92);
      dummy.updateMatrix();
      footingRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(column.point.x, column.point.y - 0.88, column.point.z);
      dummy.rotation.set(0, column.yaw, 0);
      dummy.scale.set(4.15, 0.58, 1.75);
      dummy.updateMatrix();
      capRef.current?.setMatrixAt(index, dummy.matrix);

      [-1.35, 1.35].forEach((xOffset, bearingIndex) => {
        const normal = new THREE.Vector3(column.tangent.z, 0, -column.tangent.x).normalize();
        const p = column.point.clone().addScaledVector(normal, xOffset);
        dummy.position.set(p.x, column.point.y - 0.52, p.z);
        dummy.rotation.set(0, column.yaw, 0);
        dummy.scale.set(0.42, 0.16, 0.52);
        dummy.updateMatrix();
        bearingRef.current?.setMatrixAt(index * 2 + bearingIndex, dummy.matrix);
      });
    });

    [
      deckRef,
      parapetRef,
      edgeBeamRef,
      railRef,
      sleeperRef,
      columnRef,
      footingRef,
      capRef,
      bearingRef,
      jointRef,
    ].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    });
  }, [columns, segments]);

  return (
    <group dispose={null}>
      <instancedMesh
        ref={deckRef}
        args={[undefined, undefined, segments.length]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={METRO_DECK_MATERIAL}
      />
      <instancedMesh
        ref={parapetRef}
        args={[undefined, undefined, segments.length * 2]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={METRO_PARAPET_MATERIAL}
      />
      <instancedMesh
        ref={edgeBeamRef}
        args={[undefined, undefined, segments.length * 2]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={METRO_EDGE_BEAM_MATERIAL}
      />
      <instancedMesh
        ref={railRef}
        args={[undefined, undefined, segments.length * 2]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={METRO_RAIL_MATERIAL}
      />
      <instancedMesh
        ref={sleeperRef}
        args={[undefined, undefined, segments.length * 2]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={METRO_SLEEPER_MATERIAL}
      />
      <instancedMesh
        ref={columnRef}
        args={[undefined, undefined, columns.length]}
        geometry={METRO_PIER_GEOMETRY}
        material={METRO_COLUMN_MATERIAL}
      />
      <instancedMesh
        ref={footingRef}
        args={[undefined, undefined, columns.length]}
        geometry={METRO_FOOTING_GEOMETRY}
        material={METRO_COLUMN_MATERIAL}
      />
      <instancedMesh
        ref={capRef}
        args={[undefined, undefined, columns.length]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={METRO_COLUMN_CAP_MATERIAL}
      />
      <instancedMesh
        ref={bearingRef}
        args={[undefined, undefined, columns.length * 2]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={METRO_BEARING_MATERIAL}
      />
      <instancedMesh
        ref={jointRef}
        args={[undefined, undefined, Math.ceil(segments.length / 4)]}
        geometry={SHARED_UNIT_BOX_GEOMETRY}
        material={METRO_EXPANSION_JOINT_MATERIAL}
      />
    </group>
  );
}

function MetroStation({ isNight }: { isNight: boolean }) {
  const frame = useMemo(() => metroFrame(0.63), []);
  return (
    <group
      position={[frame.point.x, frame.point.y + 0.7, frame.point.z]}
      rotation={[0, frame.yaw, 0]}
    >
      <mesh receiveShadow>
        <boxGeometry args={[9.6, 0.7, 24]} />
        <meshStandardMaterial color="#aeb1ae" map={CONCRETE_MAP} roughness={0.86} />
      </mesh>
      {[-4.1, 4.1].map((xPos) =>
        [-8, 0, 8].map((zPos) => (
          <mesh key={`${xPos}-${zPos}`} position={[xPos, 2.5, zPos]}>
            <boxGeometry args={[0.2, 5, 0.24]} />
            <meshStandardMaterial color="#6b7479" metalness={0.68} roughness={0.32} />
          </mesh>
        )),
      )}
      <RoundedBox args={[9.2, 0.65, 23.2]} radius={0.28} smoothness={4} position={[0, 5.1, 0]}>
        <meshStandardMaterial color="#d7dcdd" metalness={0.36} roughness={0.42} />
      </RoundedBox>
      <mesh position={[0, 3.05, 0]}>
        <boxGeometry args={[8.4, 3.65, 21.4]} />
        <meshStandardMaterial
          color="#7ba5b8"
          transparent
          opacity={0.34}
          roughness={0.16}
          metalness={0.15}
          emissive={isNight ? "#b9dcf0" : "#000000"}
          emissiveIntensity={isNight ? 0.45 : 0}
        />
      </mesh>
    </group>
  );
}

const METRO_MODEL_URLS = [
  "/models/metro_train_runtime.glb",
  "/models/metro_train_low.glb",
] as const;

const METRO_MODEL_SCALE = 0.72;
const METRO_MODEL_SOURCE_LENGTH = 33.87745857;
const METRO_MODEL_RAIL_Y = 0.42;
const METRO_MODEL_HALF_PROGRESS =
  (METRO_MODEL_SOURCE_LENGTH * METRO_MODEL_SCALE * 0.5) / METRO_CURVE_LENGTH;
const METRO_MODEL_MIN_PROGRESS = 0.02 + METRO_MODEL_HALF_PROGRESS;
const METRO_MODEL_MAX_PROGRESS = 0.98 - METRO_MODEL_HALF_PROGRESS;
const METRO_MODEL_PROGRESS_SPAN = METRO_MODEL_MAX_PROGRESS - METRO_MODEL_MIN_PROGRESS;
const METRO_MODEL_INITIAL_PROGRESS = 0.48;

function MetroFallbackCoach({
  z = 0,
  cab = false,
  isNight,
}: {
  z?: number;
  cab?: boolean;
  isNight: boolean;
}) {
  return (
    <group position={[0, 0, z]}>
      <RoundedBox
        args={[3.55, 2.6, 6.1]}
        radius={0.28}
        smoothness={5}
        castShadow={false}
        receiveShadow={false}
      >
        <meshStandardMaterial color="#e8ecef" metalness={0.46} roughness={0.3} />
      </RoundedBox>

      {[-1.785, 1.785].map((x) => (
        <group
          key={x}
          position={[x, 0.1, 0]}
          rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          <mesh position={[0, 0.33, 0.02]}>
            <planeGeometry args={[5.72, 1.15]} />
            <meshStandardMaterial color="#2463b4" metalness={0.3} roughness={0.32} />
          </mesh>

          {[-2.25, -1.48, -0.48, 0.48, 1.48, 2.25].map((windowX) => (
            <RoundedBox
              key={windowX}
              args={[0.57, 0.7, 0.045]}
              radius={0.05}
              smoothness={3}
              position={[windowX, 0.48, 0.055]}
            >
              <meshStandardMaterial
                color="#183440"
                roughness={0.12}
                metalness={0.16}
                emissive={isNight ? "#436e7d" : "#000000"}
                emissiveIntensity={isNight ? 0.22 : 0}
              />
            </RoundedBox>
          ))}
        </group>
      ))}

      <mesh position={[0, -1.26, 0]}>
        <boxGeometry args={[3.25, 0.32, 5.7]} />
        <meshStandardMaterial color="#22292e" metalness={0.48} roughness={0.48} />
      </mesh>

      {[-1.8, 1.8].map((bogieZ) => (
        <group key={bogieZ} position={[0, -1.42, bogieZ]}>
          <mesh>
            <boxGeometry args={[2.6, 0.3, 1.15]} />
            <meshStandardMaterial color="#30383d" metalness={0.54} roughness={0.46} />
          </mesh>
          {[-1.42, 1.42].flatMap((x) =>
            [-0.34, 0.34].map((wheelZ) => (
              <mesh
                key={`${x}-${wheelZ}`}
                position={[x, -0.02, wheelZ]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.31, 0.31, 0.18, 16]} />
                <meshStandardMaterial color="#121619" metalness={0.48} roughness={0.54} />
              </mesh>
            )),
          )}
        </group>
      ))}

      {cab && (
        <group position={[0, 0, 3.05]}>
          <RoundedBox
            args={[3.35, 2.34, 0.7]}
            radius={0.34}
            smoothness={6}
            position={[0, 0.05, 0.25]}
          >
            <meshStandardMaterial color="#e8ecef" metalness={0.46} roughness={0.3} />
          </RoundedBox>

          <RoundedBox
            args={[2.65, 1.02, 0.06]}
            radius={0.22}
            smoothness={6}
            position={[0, 0.43, 0.64]}
          >
            <meshStandardMaterial
              color="#102832"
              roughness={0.1}
              metalness={0.12}
              emissive={isNight ? "#33505b" : "#000000"}
              emissiveIntensity={isNight ? 0.16 : 0}
            />
          </RoundedBox>

          {[-1.08, 1.08].map((x) => (
            <RoundedBox
              key={x}
              args={[0.3, 0.21, 0.06]}
              radius={0.06}
              smoothness={3}
              position={[x, -0.38, 0.68]}
            >
              <meshStandardMaterial
                color="#fff4cf"
                emissive={isNight ? "#ffe7a4" : "#63583d"}
                emissiveIntensity={isNight ? 2.7 : 0.06}
              />
            </RoundedBox>
          ))}
        </group>
      )}

      <RoundedBox
        args={[2.2, 0.23, 1.02]}
        radius={0.08}
        smoothness={3}
        position={[0, 1.43, 0]}
      >
        <meshStandardMaterial color="#aeb7bc" metalness={0.55} roughness={0.34} />
      </RoundedBox>
    </group>
  );
}

function FallbackMetroTrain({ isNight }: { isNight: boolean }) {
  return (
    <group scale={0.72}>
      <MetroFallbackCoach z={8.9} cab isNight={isNight} />
      <MetroFallbackCoach z={2.7} isNight={isNight} />
      <MetroFallbackCoach z={-3.5} isNight={isNight} />
      <MetroFallbackCoach z={-9.7} isNight={isNight} />
    </group>
  );
}

function prepareLoadedMetroScene(scene: THREE.Group) {
  scene.traverse((object) => {
    object.updateMatrix();
    object.matrixAutoUpdate = false;

    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if (!("emissiveIntensity" in standard)) return;

      const stored = standard.userData.metroBaseEmissiveIntensity;
      if (typeof stored !== "number") {
        standard.userData.metroBaseEmissiveIntensity =
          standard.emissiveIntensity ?? 0;
      }
    });
  });
}

function LowWeightMetroTrain({ isNight }: { isNight: boolean }) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();

    const tryLoad = (index: number) => {
      if (index >= METRO_MODEL_URLS.length) {
        if (!cancelled) setLoadFailed(true);
        return;
      }

      loader.load(
        METRO_MODEL_URLS[index],
        (gltf) => {
          if (cancelled) return;

          const loadedScene = gltf.scene;
          prepareLoadedMetroScene(loadedScene);
          setScene(loadedScene);
          setLoadFailed(false);
        },
        undefined,
        () => {
          tryLoad(index + 1);
        },
      );
    };

    tryLoad(0);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scene) return;

    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (!("emissiveIntensity" in standard)) return;

        const stored = standard.userData.metroBaseEmissiveIntensity;
        const base = typeof stored === "number" ? stored : 0;
        standard.emissiveIntensity = isNight ? Math.max(base * 1.2, base) : base;
        standard.needsUpdate = true;
      });
    });
  }, [isNight, scene]);

  if (!scene) {
    return <FallbackMetroTrain isNight={isNight} />;
  }

  return (
    <group rotation={[0, -Math.PI / 2, 0]} scale={METRO_MODEL_SCALE}>
      <primitive object={scene} />
    </group>
  );
}

function SmoothMovingMetro({ isNight }: { isNight: boolean }) {
  const trainRef = useRef<THREE.Group>(null);
  const motionStartedAtRef = useRef<number | null>(null);
  const curvePoint = useMemo(() => new THREE.Vector3(), []);
  const curveTangent = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, rawDelta) => {
    const train = trainRef.current;
    if (!train) return;

    const now = state.clock.elapsedTime;
    if (motionStartedAtRef.current === null) {
      motionStartedAtRef.current = now;
    }

    const elapsed = now - motionStartedAtRef.current;
    const routeDistance = METRO_MODEL_PROGRESS_SPAN * METRO_CURVE_LENGTH;
    const travelled = positiveModulo(elapsed * METRO_SPEED, routeDistance);
    const progress =
      METRO_MODEL_MAX_PROGRESS - travelled / METRO_CURVE_LENGTH;

    METRO_CURVE.getPointAt(progress, curvePoint);
    METRO_CURVE.getTangentAt(progress, curveTangent).normalize();

    const targetX = curvePoint.x;
    const targetY = curvePoint.y + METRO_MODEL_RAIL_Y;
    const targetZ = curvePoint.z;
    const targetYaw = Math.atan2(curveTangent.x, curveTangent.z) + Math.PI;

    // Keep previous progress on the Three.js object instead of adding another
    // React hook. This prevents Fast Refresh hook-order mismatches.
    const previousProgress =
      typeof train.userData.metroPreviousProgress === "number"
        ? train.userData.metroPreviousProgress
        : progress;

    const wrapped =
      Math.abs(progress - previousProgress) >
      METRO_MODEL_PROGRESS_SPAN * 0.5;
    const longFrame = rawDelta > 0.24;

    if (wrapped || longFrame) {
      train.position.set(targetX, targetY, targetZ);
      train.rotation.y = targetYaw;
    } else {
      const alpha = motionAlpha(rawDelta, 20);

      train.position.x += (targetX - train.position.x) * alpha;
      train.position.y += (targetY - train.position.y) * alpha;
      train.position.z += (targetZ - train.position.z) * alpha;
      train.rotation.y = smoothAngle(train.rotation.y, targetYaw, alpha);
    }

    train.userData.metroPreviousProgress = progress;
  }, -20);

  const initialFrame = useMemo(() => metroFrame(METRO_MODEL_INITIAL_PROGRESS), []);

  return (
    <group
      ref={trainRef}
      position={[
        initialFrame.point.x,
        initialFrame.point.y + METRO_MODEL_RAIL_Y,
        initialFrame.point.z,
      ]}
      rotation={[0, initialFrame.yaw + Math.PI, 0]}
    >
      <LowWeightMetroTrain isNight={isNight} />
    </group>
  );
}

function MetroSystem({ isNight }: { isNight: boolean }) {
  return (
    <group>
      <RealisticMetroViaductV2 />
      <MetroStation isNight={isNight} />
      <SmoothMovingMetro isNight={isNight} />
    </group>
  );
}


/* -------------------------------------------------------------------------- */
/*                                TRAFFIC                                     */
/* -------------------------------------------------------------------------- */

type VehicleKind = "car" | "suv" | "van" | "bus" | "auto" | "bike";
type VehicleSpec = {
  kind: VehicleKind;
  lane: number;
  startZ: number;
  speed: number;
  direction: 1 | -1;
  color: string;
  initialPosition: Vec3;
  initialYaw: number;
  modelScale: number;
};

type VehicleRuntime = {
  group: THREE.Group;
  shadowCasters: THREE.Mesh[];
  castsShadow: boolean;
};

const TRAFFIC_ROUTE_MIN_Z = ROAD_MIN_Z - 28;
const TRAFFIC_ROUTE_MAX_Z = ROAD_MAX_Z + 28;
const TRAFFIC_ROUTE_LENGTH = TRAFFIC_ROUTE_MAX_Z - TRAFFIC_ROUTE_MIN_Z;
const TRAFFIC_CRANE_DETOUR_ENTER: [number, number] = [2.78, 3.2];
const TRAFFIC_CRANE_DETOUR_LEAVE: [number, number] = [4.45, 4.9];

function createTraffic(): VehicleSpec[] {
  const random = seeded(902);
  const incoming = [-10.4, -6.6, -2.7];
  const outgoing = [3.2, 7.4, 11.8, 16.2];
  const colors = ["#d8d9d6", "#485867", "#8c989b", "#b4b6ae", "#2e3c48", "#c2b697"];
  const result: VehicleSpec[] = [];
  for (let i = 0; i < TRAFFIC_DENSITY; i += 1) {
    const direction: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const lanes = direction === 1 ? incoming : outgoing;
    const roll = random();
    const kind: VehicleKind =
      roll > 0.91
        ? "bus"
        : roll > 0.8
          ? "van"
          : roll > 0.69
            ? "auto"
            : roll > 0.58
              ? "bike"
              : roll > 0.35
                ? "suv"
                : "car";
    const lane = lanes[Math.floor(random() * lanes.length)];
    const startZ = THREE.MathUtils.lerp(ROAD_MIN_Z + 4, ROAD_MAX_Z - 4, random());
    const speed = 4.5 + random() * 4.8;
    const color = colors[Math.floor(random() * colors.length)];
    result.push({
      kind,
      lane,
      startZ,
      speed,
      direction,
      color,
      initialPosition: roadPosition(startZ, lane, 0.08),
      initialYaw: roadYaw(startZ) + (direction === 1 ? 0 : Math.PI),
      modelScale:
        kind === "bus" ? 0.68 : kind === "bike" ? 0.72 : kind === "van" ? 0.72 : 0.74,
    });
  }
  return result;
}

const TRAFFIC = createTraffic();

function Wheel({ position }: { position: Vec3 }) {
  return (
    <mesh
      geometry={VEHICLE_WHEEL_GEOMETRY}
      material={VEHICLE_WHEEL_MATERIAL}
      position={position}
      rotation={[0, 0, Math.PI / 2]}
      castShadow
      dispose={null}
    />
  );
}

function CarModel({
  kind,
  color,
  isNight,
}: {
  kind: "car" | "suv";
  color: string;
  isNight: boolean;
}) {
  const suv = kind === "suv";
  const bodyHeight = suv ? 0.72 : 0.58;
  return (
    <group scale={suv ? 1.06 : 1}>
      <RoundedBox
        args={[1.72, bodyHeight, 3.55]}
        radius={0.18}
        smoothness={3}
        position={[0, 0.57, 0]}
        castShadow
      >
        <meshStandardMaterial color={color} metalness={0.42} roughness={0.42} />
      </RoundedBox>
      <RoundedBox
        args={[1.48, suv ? 0.88 : 0.68, 1.75]}
        radius={0.2}
        smoothness={3}
        position={[0, 1.14, -0.2]}
        castShadow
      >
        <meshStandardMaterial color="#263b48" roughness={0.2} metalness={0.16} />
      </RoundedBox>
      <RoundedBox
        args={[1.56, 0.25, 0.78]}
        radius={0.09}
        smoothness={3}
        position={[0, 0.76, 1.55]}
        castShadow
      >
        <meshStandardMaterial color={color} metalness={0.42} roughness={0.42} />
      </RoundedBox>
      <mesh position={[0, 1.12, 0.72]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[1.28, 0.62]} />
        <meshStandardMaterial color="#173341" roughness={0.15} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.39, 1.81]}>
        <boxGeometry args={[1.62, 0.15, 0.12]} />
        <meshStandardMaterial color="#242a2d" metalness={0.48} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.52, 1.8]}>
        <boxGeometry args={[1.35, 0.18, 0.06]} />
        <meshStandardMaterial
          color="#fff1c4"
          emissive={isNight ? "#fff0bd" : "#000000"}
          emissiveIntensity={isNight ? 2.5 : 0}
        />
      </mesh>
      <mesh position={[0, 0.56, -1.8]}>
        <boxGeometry args={[1.3, 0.17, 0.06]} />
        <meshStandardMaterial
          color="#9b2523"
          emissive={isNight ? "#d32f2b" : "#000000"}
          emissiveIntensity={1.8}
        />
      </mesh>
      {[-0.79, 0.79].flatMap((x) =>
        [-1.15, 1.15].map((z) => <Wheel key={`${x}-${z}`} position={[x, 0.29, z]} />),
      )}
    </group>
  );
}

function VanModel({ color, isNight }: { color: string; isNight: boolean }) {
  return (
    <group>
      <RoundedBox
        args={[1.92, 1.58, 4.35]}
        radius={0.2}
        smoothness={4}
        position={[0, 1.05, -0.1]}
        castShadow
      >
        <meshStandardMaterial color={color} metalness={0.34} roughness={0.46} />
      </RoundedBox>
      <RoundedBox
        args={[1.82, 1.35, 1.05]}
        radius={0.16}
        smoothness={4}
        position={[0, 1.17, 1.65]}
        castShadow
      >
        <meshStandardMaterial color={color} metalness={0.34} roughness={0.46} />
      </RoundedBox>
      <mesh position={[0, 1.47, 2.2]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[1.48, 0.72]} />
        <meshStandardMaterial color="#1d3d4c" roughness={0.17} metalness={0.18} />
      </mesh>
      {[-0.968, 0.968].map((x) => (
        <group
          key={x}
          position={[x, 1.25, -0.2]}
          rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          {[-1.25, 0.05, 1.25].map((z) => (
            <mesh key={z} position={[z, 0, 0]}>
              <planeGeometry args={[0.82, 0.62]} />
              <meshStandardMaterial color="#284858" roughness={0.18} metalness={0.14} />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.78, 2.22]}>
          <circleGeometry args={[0.11, 16]} />
          <meshStandardMaterial
            color="#fff3cf"
            emissive={isNight ? "#ffedb0" : "#000000"}
            emissiveIntensity={2.2}
          />
        </mesh>
      ))}
      {[-0.88, 0.88].flatMap((x) =>
        [-1.35, 1.35].map((z) => <Wheel key={`${x}-${z}`} position={[x, 0.34, z]} />),
      )}
    </group>
  );
}

function BusModel({ isNight }: { isNight: boolean }) {
  return (
    <group>
      <RoundedBox
        args={[2.25, 2.25, 5.6]}
        radius={0.22}
        smoothness={3}
        position={[0, 1.3, 0]}
        castShadow
      >
        <meshStandardMaterial color="#c99d4b" metalness={0.28} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 1.65, 2.82]}>
        <planeGeometry args={[1.8, 0.9]} />
        <meshStandardMaterial color="#233946" roughness={0.17} />
      </mesh>
      {[-1.13, 1.13].map((x) => (
        <group
          key={x}
          position={[x, 1.55, 0]}
          rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          {[-1.7, -0.55, 0.6, 1.75].map((z) => (
            <mesh key={z} position={[z, 0, 0]}>
              <planeGeometry args={[0.88, 0.75]} />
              <meshStandardMaterial
                color="#263e4b"
                emissive={isNight ? "#8ab4c4" : "#000000"}
                emissiveIntensity={isNight ? 0.32 : 0}
              />
            </mesh>
          ))}
        </group>
      ))}
      {[-1.05, 1.05].flatMap((x) =>
        [-1.8, 1.8].map((z) => <Wheel key={`${x}-${z}`} position={[x, 0.38, z]} />),
      )}
    </group>
  );
}

function AutoModel({ isNight }: { isNight: boolean }) {
  return (
    <group scale={0.9}>
      <RoundedBox
        args={[1.45, 0.52, 2.2]}
        radius={0.12}
        smoothness={3}
        position={[0, 0.52, 0]}
        castShadow
      >
        <meshStandardMaterial color="#d9ad24" roughness={0.52} metalness={0.24} />
      </RoundedBox>
      <mesh position={[0, 1.15, -0.1]} castShadow>
        <boxGeometry args={[1.32, 1.12, 1.55]} />
        <meshStandardMaterial color="#182d25" roughness={0.58} />
      </mesh>
      <mesh position={[0, 1.18, 0.69]}>
        <planeGeometry args={[1.05, 0.72]} />
        <meshStandardMaterial color="#34545b" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.55, 1.12]}>
        <circleGeometry args={[0.12, 14]} />
        <meshStandardMaterial
          color="#fff3c7"
          emissive={isNight ? "#fff0b5" : "#000000"}
          emissiveIntensity={2}
        />
      </mesh>
      <Wheel position={[0, 0.26, 0.78]} />
      <Wheel position={[-0.7, 0.27, -0.72]} />
      <Wheel position={[0.7, 0.27, -0.72]} />
    </group>
  );
}

function BikeModel({ isNight }: { isNight: boolean }) {
  return (
    <group scale={0.75}>
      {[-0.63, 0.7].map((z) => (
        <mesh key={z} position={[0, 0.34, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.32, 0.07, 8, 18]} />
          <meshStandardMaterial color="#171b1e" roughness={0.74} />
        </mesh>
      ))}
      <Beam start={[0, 0.38, -0.62]} end={[0, 0.78, 0]} width={0.08} color="#343b40" />
      <Beam start={[0, 0.78, 0]} end={[0, 0.4, 0.68]} width={0.08} color="#343b40" />
      <mesh position={[0, 0.83, 0.1]} castShadow>
        <boxGeometry args={[0.36, 0.28, 0.58]} />
        <meshStandardMaterial color="#7a2525" metalness={0.4} roughness={0.46} />
      </mesh>
      <mesh position={[0, 1.35, -0.1]} castShadow>
        <capsuleGeometry args={[0.18, 0.58, 5, 10]} />
        <meshStandardMaterial color="#263542" roughness={0.74} />
      </mesh>
      <mesh position={[0, 1.82, -0.04]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color="#22292e" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.74, 0.78]}>
        <circleGeometry args={[0.09, 12]} />
        <meshStandardMaterial
          color="#fff2ca"
          emissive={isNight ? "#fff0ba" : "#000000"}
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  );
}

function VehicleModel({ spec, isNight }: { spec: VehicleSpec; isNight: boolean }) {
  if (spec.kind === "bus") return <BusModel isNight={isNight} />;
  if (spec.kind === "van") return <VanModel color={spec.color} isNight={isNight} />;
  if (spec.kind === "auto") return <AutoModel isNight={isNight} />;
  if (spec.kind === "bike") return <BikeModel isNight={isNight} />;
  return <CarModel kind={spec.kind} color={spec.color} isNight={isNight} />;
}

function MovingVehicle({
  spec,
  index,
  runtimeRef,
  isNight,
}: {
  spec: VehicleSpec;
  index: number;
  runtimeRef: MutableRefObject<Array<VehicleRuntime | null>>;
  isNight: boolean;
}) {
  const ref = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    const casters: THREE.Mesh[] = [];
    group.traverse((object) => {
      if (object !== group) {
        object.updateMatrix();
        object.matrixAutoUpdate = false;
      }

      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
        casters.push(mesh);
      }
    });
    runtimeRef.current[index] = {
      group,
      shadowCasters: casters,
      castsShadow: false,
    };
    return () => {
      const runtime = runtimeRef.current[index];
      if (runtime?.group === group) runtimeRef.current[index] = null;
    };
  }, [index, runtimeRef, spec.startZ]);

  return (
    <group
      ref={ref}
      position={spec.initialPosition}
      rotation={[0, spec.initialYaw, 0]}
      scale={spec.modelScale}
    >
      <VehicleModel spec={spec} isNight={isNight} />
    </group>
  );
}

function Traffic({ scrollRef, isNight }: { scrollRef: ScrollRef; isNight: boolean }) {
  const runtimeRef = useRef<Array<VehicleRuntime | null>>([]);
  const motionStartedAtRef = useRef<number | null>(null);
  const previousZRef = useRef<number[]>(TRAFFIC.map((spec) => spec.startZ));

  useFrame((state, rawDelta) => {
    const now = state.clock.elapsedTime;
    if (motionStartedAtRef.current === null) {
      motionStartedAtRef.current = now;
    }

    const elapsed = now - motionStartedAtRef.current;
    const alpha = motionAlpha(rawDelta, 22);
    const stage = scrollRef.current * (STAGES.length - 1);
    const craneDetour = windowed(
      stage,
      TRAFFIC_CRANE_DETOUR_ENTER,
      TRAFFIC_CRANE_DETOUR_LEAVE,
    );

    for (let index = 0; index < TRAFFIC.length; index += 1) {
      const runtime = runtimeRef.current[index];
      if (!runtime) continue;

      const spec = TRAFFIC[index];
      let z: number;

      if (spec.direction === 1) {
        const travelled =
          positiveModulo(
            spec.startZ - TRAFFIC_ROUTE_MIN_Z + elapsed * spec.speed,
            TRAFFIC_ROUTE_LENGTH,
          );
        z = TRAFFIC_ROUTE_MIN_Z + travelled;
      } else {
        const travelled =
          positiveModulo(
            TRAFFIC_ROUTE_MAX_Z - spec.startZ + elapsed * spec.speed,
            TRAFFIC_ROUTE_LENGTH,
          );
        z = TRAFFIC_ROUTE_MAX_Z - travelled;
      }

      const workEnvelope = 1 - smooth(Math.abs(z - UNIPOLE_POSITION[2]), 9, 20);
      const detour =
        spec.direction === -1 && spec.lane === 3.2
          ? craneDetour * workEnvelope * 2.1
          : 0;

      const yaw = roadYaw(z);
      const lateralOffset = spec.lane + detour;
      const targetX = roadBend(z) + Math.cos(yaw) * lateralOffset;
      const targetY = 0.08;
      const targetZ = z - Math.sin(yaw) * lateralOffset;
      const targetYaw = yaw + (spec.direction === 1 ? 0 : Math.PI);

      const wrapped =
        Math.abs(z - previousZRef.current[index]) >
        TRAFFIC_ROUTE_LENGTH * 0.5;
      const longFrame = rawDelta > 0.24;

      if (wrapped || longFrame) {
        runtime.group.position.set(targetX, targetY, targetZ);
        runtime.group.rotation.y = targetYaw;
      } else {
        runtime.group.position.x +=
          (targetX - runtime.group.position.x) * alpha;
        runtime.group.position.y +=
          (targetY - runtime.group.position.y) * alpha;
        runtime.group.position.z +=
          (targetZ - runtime.group.position.z) * alpha;
        runtime.group.rotation.y = smoothAngle(
          runtime.group.rotation.y,
          targetYaw,
          alpha,
        );
      }

      previousZRef.current[index] = z;
    }
  }, -20);

  return (
    <group>
      {TRAFFIC.map((spec, index) => (
        <MovingVehicle
          key={index}
          spec={spec}
          index={index}
          runtimeRef={runtimeRef}
          isNight={isNight}
        />
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                         SKY, CLOUDS AND AIRPLANE                           */
/* -------------------------------------------------------------------------- */

function CloudField({ isNight }: { isNight: boolean }) {
  const clouds = useMemo(
    () =>
      [
        [-28, 23, -56, 14, 6],
        [-8, 25, -76, 18, 7],
        [16, 24, -68, 15, 6],
        [38, 26, -92, 20, 8],
        [-38, 19, -34, 11, 4.5],
        [28, 20, -38, 12, 5],
      ] as Array<[number, number, number, number, number]>,
    [],
  );
  return (
    <group visible={!isNight}>
      {clouds.map(([x, y, z, width, height], index) => (
        <sprite key={index} position={[x, y, z]} scale={[width, height, 1]}>
          <spriteMaterial
            map={CLOUD_MAP}
            transparent
            opacity={0.74}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

function Airplane() {
  const ref = useRef<THREE.Group>(null);
  const startedAtRef = useRef<number | null>(null);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (startedAtRef.current === null) startedAtRef.current = now;
    const elapsed = now - startedAtRef.current;
    const x = -34 + positiveModulo(elapsed * 0.62 + 10, 70);
    if (ref.current) ref.current.position.x = x;
  }, -20);

  return (
    <group ref={ref} position={[-24, 23.5, -58]} rotation={[0.04, -0.15, -0.04]} scale={0.22}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.43, 0.58, 5.7, 20]} />
        <meshStandardMaterial color="#e6e8e9" metalness={0.52} roughness={0.38} />
      </mesh>
      <mesh position={[3.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.43, 1.35, 20]} />
        <meshStandardMaterial color="#e6e8e9" metalness={0.52} roughness={0.38} />
      </mesh>
      <mesh position={[-3.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.57, 1.1, 20]} />
        <meshStandardMaterial color="#e6e8e9" metalness={0.52} roughness={0.38} />
      </mesh>
      <mesh position={[-0.15, -0.02, 0]} rotation={[0, -0.09, 0]}>
        <boxGeometry args={[2.4, 0.12, 7.9]} />
        <meshStandardMaterial color="#d8dcdf" metalness={0.52} roughness={0.38} />
      </mesh>
      <mesh position={[-2.7, 0.15, 0]}>
        <boxGeometry args={[1.5, 0.09, 3.1]} />
        <meshStandardMaterial color="#d8dcdf" metalness={0.52} roughness={0.38} />
      </mesh>
      <mesh position={[-2.8, 0.78, 0]} rotation={[0, 0, -0.18]}>
        <boxGeometry args={[1.25, 1.55, 0.1]} />
        <meshStandardMaterial color="#d8dcdf" metalness={0.52} roughness={0.38} />
      </mesh>
      {[-2.15, 2.15].map((z) => (
        <group key={z} position={[0.55, -0.38, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.33, 0.27, 1.15, 16]} />
            <meshStandardMaterial color="#78838a" metalness={0.7} roughness={0.34} />
          </mesh>
          <mesh position={[0.6, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.22, 16]} />
            <meshStandardMaterial color="#202a30" metalness={0.45} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                     UNIPOLE CONSTRUCTION EQUIPMENT                        */
/* -------------------------------------------------------------------------- */

function TotalStation() {
  return (
    <group position={[-0.45, 0.32, -4.5]}>
      {[-0.2, 0, 0.2].map((x, index) => (
        <Beam
          key={x}
          start={[0, 0.65, 0]}
          end={[x, 0, index === 1 ? 0.2 : -0.15]}
          width={0.035}
          color="#d6aa37"
        />
      ))}
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[0.34, 0.22, 0.25]} />
        <meshStandardMaterial color="#e3b42f" roughness={0.5} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.8, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.16, 14]} />
        <meshStandardMaterial color="#1f2c32" roughness={0.42} />
      </mesh>
    </group>
  );
}

function SurveySetup() {
  return (
    <group>
      <group position={[0, 0, 5.7]}>
        <TotalStation />
      </group>
      <group position={[0.45, 0, -1.2]}>
        <mesh position={[0, 1.25, 0]} castShadow>
          <boxGeometry args={[0.6, 2.5, 0.65]} />
          <meshStandardMaterial color="#d7a93c" metalness={0.44} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.65, 0.08]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 1.4, 12]} />
          <meshStandardMaterial color="#4f5658" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.28, 0]} rotation={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.18, 0.55, 12]} />
          <meshStandardMaterial color="#5b6264" metalness={0.72} roughness={0.34} />
        </mesh>
      </group>
      {[-0.48, 0, 0.48].map((x) => (
        <mesh key={x} position={[x, 0.28, -1.9]} castShadow>
          <boxGeometry args={[0.38, 0.18, 0.75]} />
          <meshStandardMaterial color="#b78b4c" roughness={0.82} />
        </mesh>
      ))}
      <Person position={[0.52, 0.3, 1]} shirt="#e6962d" />
    </group>
  );
}

function ExcavationSetup() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[1.05, 0.78, 0.36, 28]} />
        <meshStandardMaterial color="#47352a" roughness={1} />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.76, 0.62, 1.4, 24]} />
        <meshStandardMaterial color="#211b17" roughness={1} />
      </mesh>
      <group position={[0.45, 0.28, -2]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.65, 0.5, 0.95]} />
          <meshStandardMaterial color="#d3a329" metalness={0.35} roughness={0.5} />
        </mesh>
        <Beam start={[0, 0.72, 0.15]} end={[-0.35, 1.62, 0.5]} width={0.12} color="#d3a329" />
        <Beam start={[-0.35, 1.62, 0.5]} end={[-0.5, 0.25, 1.1]} width={0.09} color="#d3a329" />
        {[-0.33, 0.33].map((x) => (
          <mesh key={x} position={[x, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.16, 14]} />
            <meshStandardMaterial color="#202326" roughness={0.72} />
          </mesh>
        ))}
      </group>
      <Person position={[-0.8, 0.3, -1.1]} shirt="#dc8b2b" />
    </group>
  );
}

function FoundationAssembly() {
  return (
    <group>
      <RoundedBox
        args={[2.2, 0.82, 2.2]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.41, 0]}
        receiveShadow
      >
        <primitive object={UNIPOLE_CONCRETE_MATERIAL} attach="material" />
      </RoundedBox>

      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.92, 0.98, 0.16, 24]} />
        <primitive object={UNIPOLE_BASE_PLATE_MATERIAL} attach="material" />
      </mesh>

      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        const x = Math.cos(angle) * 0.72;
        const z = Math.sin(angle) * 0.72;
        return (
          <group key={index} position={[x, 1.06, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.036, 0.036, 0.28, 10]} />
              <primitive object={UNIPOLE_DARK_STEEL_MATERIAL} attach="material" />
            </mesh>
            <mesh position={[0, 0.13, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.07, 8]} />
              <primitive object={UNIPOLE_BASE_PLATE_MATERIAL} attach="material" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CraneRig() {
  return (
    <group position={[3.05, 0.2, -0.4]}>
      <RoundedBox
        args={[2.1, 0.75, 4.2]}
        radius={0.16}
        smoothness={3}
        position={[0, 0.65, 0]}
        castShadow
      >
        <meshStandardMaterial color="#d3a029" metalness={0.38} roughness={0.48} />
      </RoundedBox>
      <RoundedBox
        args={[1.9, 1.25, 1.3]}
        radius={0.12}
        smoothness={3}
        position={[0, 1.35, 1.25]}
        castShadow
      >
        <meshStandardMaterial color="#d4a32c" metalness={0.36} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 1.58, 1.92]}>
        <planeGeometry args={[1.4, 0.62]} />
        <meshStandardMaterial color="#314a56" roughness={0.2} />
      </mesh>
      <Beam start={[0, 1.4, -0.8]} end={[-2.4, 11.4, -0.1]} width={0.25} color="#d3a029" />
      <Beam start={[-2.4, 11.4, -0.1]} end={[-2.75, 13.1, -0.1]} width={0.12} color="#555b5d" />
      <Beam start={[-2.75, 13.1, -0.1]} end={[-2.75, 9.4, -0.1]} width={0.035} color="#2f3234" />
      {[-0.95, 0.95].flatMap((x) =>
        [-1.3, 1.3].map((z) => <Wheel key={`${x}-${z}`} position={[x, 0.35, z]} />),
      )}
      <mesh position={[-2.75, 9.05, -0.1]} castShadow>
        <boxGeometry args={[0.36, 0.22, 0.36]} />
        <meshStandardMaterial color="#d8ae37" metalness={0.5} roughness={0.42} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                        DETAILED UNIPOLE ASSEMBLY                           */
/* -------------------------------------------------------------------------- */

const BLACK_BANNER_SHAPE = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-5.35, 1.25);
  shape.lineTo(-2.3, 2.78);
  shape.lineTo(4.65, -2.7);
  shape.lineTo(1.25, -2.7);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();

const RED_TOP_SHAPE = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-5.35, 2.7);
  shape.lineTo(0.5, 2.7);
  shape.lineTo(-2.35, 1.25);
  shape.lineTo(-5.35, 1.25);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();

const RED_BOTTOM_SHAPE = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(1.25, -2.7);
  shape.lineTo(5.35, -2.7);
  shape.lineTo(5.35, 0.8);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();

function BillboardArtwork() {
  return (
    <group position={[0, 14.25, 0.48]}>
      <mesh>
        <planeGeometry args={[10.7, 5.4]} />
        <meshStandardMaterial
          color="#f0e7d2"
          map={BANNER_GRAIN}
          roughness={0.68}
          metalness={0.01}
        />
      </mesh>
      <mesh geometry={RED_TOP_SHAPE} position={[0, 0, 0.012]}>
        <meshStandardMaterial color="#c73930" roughness={0.78} />
      </mesh>
      <mesh geometry={BLACK_BANNER_SHAPE} position={[0, 0, 0.022]}>
        <meshStandardMaterial color="#252526" roughness={0.86} />
      </mesh>
      <mesh geometry={RED_BOTTOM_SHAPE} position={[0, 0, 0.032]}>
        <meshStandardMaterial color="#c23d33" roughness={0.78} />
      </mesh>
    </group>
  );
}

function BillboardFrame() {
  const trussPosts = [-5.2, -3.45, -1.72, 0, 1.72, 3.45, 5.2];

  return (
    <group>
      {/* Thin real billboard backing rather than a cartoon solid block. */}
      <mesh position={[0, 14.25, -0.07]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[11.45, 5.92, 0.13]} />
        <primitive object={UNIPOLE_DARK_STEEL_MATERIAL} attach="material" />
      </mesh>

      {/* Perimeter steel frame. */}
      {[-2.98, 2.98].map((y) => (
        <mesh key={`h-${y}`} position={[0, 14.25 + y, 0.02]}>
          <boxGeometry args={[11.72, 0.14, 0.18]} />
          <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
        </mesh>
      ))}
      {[-5.79, 5.79].map((x) => (
        <mesh key={`v-${x}`} position={[x, 14.25, 0.02]}>
          <boxGeometry args={[0.14, 6.05, 0.18]} />
          <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
        </mesh>
      ))}

      {/* Open engineering truss below the display. */}
      <mesh position={[0, 11.2, -0.18]}>
        <boxGeometry args={[11.25, 0.13, 0.16]} />
        <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
      </mesh>
      <mesh position={[0, 10.35, -0.18]}>
        <boxGeometry args={[11.25, 0.13, 0.16]} />
        <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
      </mesh>

      {trussPosts.map((x, index) => (
        <group key={x}>
          <mesh position={[x, 10.78, -0.18]}>
            <boxGeometry args={[0.11, 0.92, 0.13]} />
            <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
          </mesh>
          {index < trussPosts.length - 1 && (
            <>
              <Beam
                start={[x, 10.37, -0.18]}
                end={[trussPosts[index + 1], 11.18, -0.18]}
                width={0.075}
                color="#737b80"
                castShadow={false}
              />
              <Beam
                start={[x, 11.18, -0.28]}
                end={[trussPosts[index + 1], 10.37, -0.28]}
                width={0.075}
                color="#737b80"
                castShadow={false}
              />
            </>
          )}
        </group>
      ))}

      {/* Rear maintenance catwalk. */}
      <mesh position={[0, 10.08, -0.72]}>
        <boxGeometry args={[10.9, 0.12, 1.35]} />
        <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
      </mesh>
      {[-5.2, 5.2].map((x) => (
        <mesh key={x} position={[x, 10.62, -1.27]}>
          <boxGeometry args={[0.06, 1.1, 0.06]} />
          <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
        </mesh>
      ))}
      <mesh position={[0, 11.12, -1.27]}>
        <boxGeometry args={[10.45, 0.06, 0.06]} />
        <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
      </mesh>

      {/* Pole-to-truss transition head. */}
      <mesh position={[0, 10.62, -0.04]}>
        <cylinderGeometry args={[1.12, 0.54, 0.78, 20]} />
        <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
      </mesh>
      <mesh position={[0, 11.05, -0.04]}>
        <boxGeometry args={[3.2, 0.28, 1.25]} />
        <primitive object={UNIPOLE_FRAME_MATERIAL} attach="material" />
      </mesh>

      {/* Rear face bracing. */}
      {[-4.25, -2.1, 0, 2.1, 4.25].map((x) => (
        <Beam
          key={`rear-${x}`}
          start={[x - 0.7, 11.38, -0.18]}
          end={[x + 0.7, 17.1, -0.18]}
          width={0.07}
          color="#737b80"
          castShadow={false}
        />
      ))}
    </group>
  );
}

function RearLadder() {
  const rungs = Array.from({ length: 25 }, (_, index) => 2 + index * 0.53);
  return (
    <group position={[0, 0, -0.82]}>
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} position={[x, 8.2, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 13.2, 8]} />
          <meshStandardMaterial color="#62696b" metalness={0.76} roughness={0.34} />
        </mesh>
      ))}
      {rungs.map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.52, 8]} />
          <meshStandardMaterial color="#6b7274" metalness={0.76} roughness={0.34} />
        </mesh>
      ))}
      {rungs
        .filter((_, index) => index % 3 === 0)
        .map((y) => (
          <Beam key={`bracket-${y}`} start={[0, y, 0.02]} end={[0, y, 0.48]} width={0.045} />
        ))}
    </group>
  );
}

function FloodlightFixture({ x, isNight }: { x: number; isNight: boolean }) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const usesRealBeam = Math.abs(x) <= 2.21;
  useLayoutEffect(() => {
    target.position.set(x * 0.2, 13.55, 0.4);
    if (lightRef.current) lightRef.current.target = target;
  }, [isNight, target, x]);
  return (
    <group>
      <primitive object={target} />
      <Beam start={[x, 17.42, 0.22]} end={[x, 17.93, 0.92]} width={0.09} />
      <Beam start={[x - 0.3, 17.96, 0.93]} end={[x + 0.3, 17.96, 0.93]} width={0.055} />
      <group position={[x, 18.02, 1.01]} rotation={[0.58, 0, 0]}>
        <RoundedBox args={[0.72, 0.24, 0.46]} radius={0.055} smoothness={4} castShadow>
          <meshStandardMaterial color="#2f373a" metalness={0.72} roughness={0.32} />
        </RoundedBox>
        {[-0.25, -0.125, 0, 0.125, 0.25].map((fin) => (
          <mesh key={fin} position={[fin, 0.16, -0.03]} castShadow>
            <boxGeometry args={[0.035, 0.12, 0.32]} />
            <meshStandardMaterial color="#3e474a" metalness={0.7} roughness={0.34} />
          </mesh>
        ))}
        {[-0.39, 0.39].map((side) => (
          <mesh key={side} position={[side, -0.03, 0]} castShadow>
            <boxGeometry args={[0.04, 0.38, 0.32]} />
            <meshStandardMaterial color="#596164" metalness={0.76} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, -0.09, 0.235]}>
          <planeGeometry args={[0.55, 0.28]} />
          <meshStandardMaterial
            color={isNight ? "#fff0be" : "#d8d3c5"}
            emissive={isNight ? "#ffe29a" : "#000000"}
            emissiveIntensity={isNight ? 3.2 * UNIPOLE_NIGHT_LIGHT_RATIO : 0}
          />
        </mesh>
      </group>
      {isNight && usesRealBeam && (
        <spotLight
          ref={lightRef}
          position={[x, 17.96, 1.08]}
          color="#ffe2a3"
          intensity={34 * UNIPOLE_NIGHT_LIGHT_RATIO}
          distance={11.5}
          angle={0.4}
          penumbra={0.78}
          decay={2}
          castShadow={false}
        />
      )}
    </group>
  );
}

function InspectionSetup() {
  return (
    <group>
      <Person position={[-1.25, 0.3, 0.8]} shirt="#e2902e" />
      <Person position={[1.2, 0.3, 0.65]} shirt="#32678d" />
      <group position={[-1.2, 1.55, 0.92]} rotation={[0.2, 0.1, -0.15]}>
        <RoundedBox args={[0.36, 0.48, 0.045]} radius={0.025} smoothness={3}>
          <meshStandardMaterial color="#1f2b32" roughness={0.55} />
        </RoundedBox>
        <mesh position={[0, 0, 0.026]}>
          <planeGeometry args={[0.3, 0.4]} />
          <meshStandardMaterial color="#cad9d6" emissive="#668f91" emissiveIntensity={0.2} />
        </mesh>
      </group>
      <RoundedBox
        args={[0.48, 0.32, 0.08]}
        radius={0.025}
        smoothness={3}
        position={[0.78, 1.05, 1.55]}
        rotation={[0, -0.15, 0]}
      >
        <meshStandardMaterial color="#dfddd5" roughness={0.72} />
      </RoundedBox>
      <group position={[1.75, 0.78, -0.25]} rotation={[0, -0.12, 0]}>
        <RoundedBox args={[0.72, 1.35, 0.5]} radius={0.055} smoothness={4} castShadow>
          <meshStandardMaterial color="#c7ccca" metalness={0.44} roughness={0.44} />
        </RoundedBox>
        <mesh position={[0, 0.2, 0.256]}>
          <planeGeometry args={[0.48, 0.55]} />
          <meshStandardMaterial color="#29373d" roughness={0.3} />
        </mesh>
        {[-0.13, 0, 0.13].map((x) => (
          <mesh key={x} position={[x, 0.31, 0.264]}>
            <circleGeometry args={[0.035, 12]} />
            <meshStandardMaterial
              color={x < 0 ? "#4ab16a" : x > 0 ? "#d96150" : "#e1b647"}
              emissive="#25382b"
              emissiveIntensity={0.16}
            />
          </mesh>
        ))}
        <mesh position={[0.25, -0.34, 0.27]}>
          <boxGeometry args={[0.06, 0.22, 0.05]} />
          <meshStandardMaterial color="#333b3e" metalness={0.58} roughness={0.36} />
        </mesh>
      </group>
      <RoundedBox
        args={[0.8, 0.24, 0.48]}
        radius={0.07}
        smoothness={4}
        position={[-0.15, 0.2, 1.55]}
        castShadow
      >
        <meshStandardMaterial color="#30414a" metalness={0.36} roughness={0.48} />
      </RoundedBox>
    </group>
  );
}

function UnipoleAssembly({ scrollRef, isNight }: { scrollRef: ScrollRef; isNight: boolean }) {
  const surveyRef = useRef<THREE.Group>(null);
  const excavationRef = useRef<THREE.Group>(null);
  const foundationRef = useRef<THREE.Group>(null);
  const poleRef = useRef<THREE.Group>(null);
  const frameRef = useRef<THREE.Group>(null);
  const bannerRef = useRef<THREE.Group>(null);
  const lightsRef = useRef<THREE.Group>(null);
  const craneRef = useRef<THREE.Group>(null);
  const inspectionRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const stage = scrollRef.current * (STAGES.length - 1);
    const survey = 1 - smooth(stage, 0.62, 0.95);
    const excavation = windowed(stage, [0.65, 1.05], [2.1, 2.48]);
    const foundation = smooth(stage, 1.78, 2.5);
    const pole = smooth(stage, 2.72, 3.55);
    const frame = smooth(stage, 3.75, 4.52);
    const banner = smooth(stage, 4.75, 5.48);
    const lights = smooth(stage, 5.72, 6.4);
    const crane = windowed(stage, [2.65, 3.05], [4.45, 4.92]);
    const inspection = smooth(stage, 6.72, 7);

    if (surveyRef.current) {
      surveyRef.current.visible = survey > 0.01;
      surveyRef.current.scale.setScalar(Math.max(0.001, survey));
    }
    if (excavationRef.current) {
      excavationRef.current.visible = excavation > 0.01;
      excavationRef.current.scale.setScalar(Math.max(0.001, excavation));
    }
    if (foundationRef.current) {
      foundationRef.current.visible = foundation > 0.01;
      foundationRef.current.scale.set(1, Math.max(0.001, foundation), 1);
    }
    if (poleRef.current) {
      poleRef.current.visible = pole > 0.01;
      poleRef.current.scale.set(1, Math.max(0.001, pole), 1);
    }
    if (frameRef.current) {
      frameRef.current.visible = frame > 0.01;
      frameRef.current.scale.setScalar(Math.max(0.001, frame));
    }
    if (bannerRef.current) {
      bannerRef.current.visible = banner > 0.01;
      bannerRef.current.scale.set(Math.max(0.001, banner), 1, 1);
    }
    if (lightsRef.current) {
      lightsRef.current.visible = lights > 0.01;
      lightsRef.current.scale.setScalar(Math.max(0.001, lights));
    }
    if (craneRef.current) {
      craneRef.current.visible = crane > 0.01;
      craneRef.current.scale.setScalar(Math.max(0.001, crane));
    }
    if (inspectionRef.current) {
      inspectionRef.current.visible = inspection > 0.01;
      inspectionRef.current.scale.setScalar(Math.max(0.001, inspection));
    }
  });

  return (
    <group position={UNIPOLE_POSITION} rotation={[0, -0.075, 0]}>
      <group ref={surveyRef}>
        <SurveySetup />
      </group>
      <group ref={excavationRef}>
        <ExcavationSetup />
      </group>
      <group ref={foundationRef}>
        <FoundationAssembly />
      </group>
      <group ref={poleRef}>
        <mesh position={[0, 5.65, 0]} castShadow={false} receiveShadow={false}>
          <cylinderGeometry args={[0.48, 0.7, 9.45, 36]} />
          <primitive object={UNIPOLE_POLE_MATERIAL} attach="material" />
        </mesh>

        <mesh position={[0, 1.03, 0]} castShadow={false}>
          <cylinderGeometry args={[0.86, 0.9, 0.16, 24]} />
          <primitive object={UNIPOLE_BASE_PLATE_MATERIAL} attach="material" />
        </mesh>

        {Array.from({ length: 8 }, (_, index) => {
          const angle = (index / 8) * Math.PI * 2;
          const x = Math.cos(angle);
          const z = Math.sin(angle);
          return (
            <Beam
              key={`gusset-${index}`}
              start={[x * 0.72, 1.1, z * 0.72]}
              end={[x * 0.49, 1.72, z * 0.49]}
              width={0.1}
              color="#737b80"
              castShadow={false}
            />
          );
        })}

        <mesh position={[0, 10.16, 0]} castShadow={false}>
          <cylinderGeometry args={[0.54, 0.48, 0.72, 28]} />
          <primitive object={UNIPOLE_POLE_MATERIAL} attach="material" />
        </mesh>
      </group>
      <group ref={frameRef}>
        <BillboardFrame />
        <RearLadder />
      </group>
      <group ref={bannerRef}>
        <BillboardArtwork />
      </group>
      <group ref={lightsRef}>
        <mesh position={[0, 17.44, 0.22]} castShadow>
          <boxGeometry args={[10.4, 0.13, 0.14]} />
          <meshStandardMaterial color="#555e61" map={STEEL_MAP} metalness={0.76} roughness={0.32} />
        </mesh>
        {[-4.4, -2.2, 0, 2.2, 4.4].map((x) => (
          <FloodlightFixture key={x} x={x} isNight={isNight} />
        ))}
      </group>
      <group ref={craneRef}>
        <CraneRig />
      </group>
      <group ref={inspectionRef}>
        <InspectionSetup />
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                               MAIN SCENE                                   */
/* -------------------------------------------------------------------------- */

function Scene({
  scrollRef,
  isNight,
  onInteractionChange,
}: {
  scrollRef: ScrollRef;
  isNight: boolean;
  onInteractionChange: (active: boolean) => void;
}) {
  const beginInteraction = useCallback(() => {
    onInteractionChange(true);
  }, [onInteractionChange]);

  const endInteraction = useCallback(() => {
    onInteractionChange(false);
  }, [onInteractionChange]);
  return (
    <>
      <color attach="background" args={[isNight ? "#07111f" : "#a6c4d0"]} />
      <fog attach="fog" args={[isNight ? "#091523" : "#c2c8c2", 165, 345]} />

      <Environment background={false} resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={4.2}
          color="#d8e7ec"
          position={[-18, 36, -72]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[110, 34, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.9}
          color="#ffffff"
          position={[42, 18, 8]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[42, 22, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.3}
          color="#f2c58f"
          position={[-34, 10, 22]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[30, 12, 1]}
        />
      </Environment>

      <group visible={!isNight}>
        <Sky
          distance={450000}
          sunPosition={[45, 65, 30]}
          inclination={0.54}
          azimuth={0.22}
          turbidity={4.2}
          rayleigh={2.25}
          mieCoefficient={0.0032}
          mieDirectionalG={0.69}
        />
      </group>

      <ambientLight
        intensity={isNight ? 0.16 : 0.42}
        color={isNight ? "#4c6e9c" : "#fff5e6"}
      />

      <hemisphereLight
        args={[
          isNight ? "#36577d" : "#c9e1ef",
          isNight ? "#090d13" : "#6f7569",
          isNight ? 0.34 : 0.88,
        ]}
      />

      <directionalLight
        position={[30, 31, 20]}
        intensity={isNight ? 0.12 : 2.35}
        color={isNight ? "#7896c5" : "#ffe3b2"}
        castShadow={false}
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-bias={-0.00014}
      />

      <RendererController isNight={isNight} />
      <StaticSceneCamera />
      <SmoothCinematicControls
        onStart={beginInteraction}
        onEnd={endInteraction}
      />

      <RoadSurface />
      <Streetlights isNight={isNight} />
      <ChennaiArchitecturalCityV12 isNight={isNight} />
      {!isNight && (
        <ContactShadows
          position={[0, 0.04, -62]}
          opacity={0.16}
          scale={175}
          blur={3.2}
          far={48}
          resolution={256}
          frames={1}
        />
      )}
      <MetroSystem isNight={isNight} />
      <Traffic scrollRef={scrollRef} isNight={isNight} />
      <CloudField isNight={isNight} />
      <Airplane />
      <UnipoleAssembly scrollRef={scrollRef} isNight={isNight} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                               PAGE SECTION                                 */
/* -------------------------------------------------------------------------- */

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,.36)",
  background: "rgba(8,16,25,.84)",
  color: "#fff",
  borderRadius: 999,
  padding: "10px 15px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: "0 8px 28px rgba(0,0,0,.16)",
};

export function GroundToSkySection() {
  const rootRef = useRef<HTMLElement>(null);
  const stagePanelRef = useRef<HTMLDivElement>(null);
  const stageSlideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const scrollRef = useRef(0);
  const activeStageRef = useRef(0);
  const [activeStage, setActiveStage] = useState(0);
  const [isNight, setIsNight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [webGLFailed, setWebGLFailed] = useState(false);

  useLayoutEffect(() => {
    const section = rootRef.current;
    if (!section) return;
    gsap.registerPlugin(ScrollTrigger);
    const proxy = { progress: 0 };
    const stageSlides = stageSlideRefs.current.filter(
      (slide): slide is HTMLDivElement => slide !== null,
    );
    let scrollTween: gsap.core.Tween | null = null;
    const context = gsap.context(() => {
      stageSlides.forEach((slide, slideIndex) => {
        const offset = slideIndex;
        gsap.set(slide, {
          yPercent: offset * 105,
          opacity: Math.max(0, 1 - Math.abs(offset) * 0.9),
          visibility: Math.abs(offset) < 1.15 ? "visible" : "hidden",
        });
      });

      scrollTween = gsap.to(proxy, {
        progress: 1,
        ease: "none",
        onUpdate: () => {
          const progress = clamp01(proxy.progress);
          scrollRef.current = progress;
          const rawStage = progress * (STAGES.length - 1);
          stageSlides.forEach((slide, slideIndex) => {
            const offset = slideIndex - rawStage;
            gsap.set(slide, {
              yPercent: offset * 105,
              opacity: Math.max(0, 1 - Math.abs(offset) * 0.9),
              visibility: Math.abs(offset) < 1.15 ? "visible" : "hidden",
            });
          });
          const stage = Math.min(STAGES.length - 1, Math.round(rawStage));
          if (stage !== activeStageRef.current) {
            activeStageRef.current = stage;
            setActiveStage(stage);
          }
        },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: CAMERA_SCROLL_SCRUB,
          invalidateOnRefresh: true,
          fastScrollEnd: false,
        },
      });
    }, section);
    return () => {
      gsap.killTweensOf(stageSlides);
      scrollTween?.scrollTrigger?.kill();
      scrollTween?.kill();
      context.revert();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      aria-label="UNIPOLE installation journey"
      style={{ position: "relative", height: `${STAGES.length * 100}vh`, background: "#08111a" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          width: "100%",
          height: "100svh",
          overflow: "hidden",
          overflowX: "clip",
        }}
      >
        {!webGLFailed ? (
          <Canvas
            frameloop="always"
            shadows={false}
            dpr={RENDER_DPR_MAX}
            camera={{
              position: CAMERA_POSES[0].position,
              fov: CAMERA_POSES[0].fov,
              near: 0.1,
              far: 340,
            }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: "high-performance",
              stencil: false,
            }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = isNight ? 0.84 : 1.14;
              gl.domElement.addEventListener("webglcontextlost", () => setWebGLFailed(true), {
                once: true,
              });
            }}
            style={{
              position: "absolute",
              inset: 0,
              touchAction: "pan-y",
              cursor: isDragging ? "grabbing" : "grab",
            }}
          >
            <Suspense fallback={null}>
              <Scene
                scrollRef={scrollRef}
                isNight={isNight}
                onInteractionChange={setIsDragging}
              />
            </Suspense>
          </Canvas>
        ) : (
          <div
            role="alert"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 24,
              color: "white",
              background: "linear-gradient(145deg,#12202b,#071019)",
              textAlign: "center",
            }}
          >
            The 3D scene needs WebGL. Please enable hardware acceleration and reload this page.
          </div>
        )}

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(90deg,rgba(4,10,16,.15) 0%,transparent 35%,transparent 63%,rgba(4,10,16,.32) 100%),linear-gradient(0deg,rgba(4,10,16,.38) 0%,transparent 34%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 22,
            left: 22,
            right: 22,
            zIndex: 2,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              textShadow: "0 2px 16px rgba(0,0,0,.65)",
            }}
          >
            Ground to Sky · UNIPOLE Installation
          </div>
          <div style={{ display: "flex", gap: 9, pointerEvents: "auto" }}>
            <button
              type="button"
              onClick={() => setIsNight((value) => !value)}
              style={buttonStyle}
              aria-pressed={isNight}
            >
              {isNight ? "Day View" : "Night View"}
            </button>
          </div>
        </div>

        <div
          ref={stagePanelRef}
          aria-live="polite"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
            width: "clamp(380px, 28vw, 560px)",
            maxWidth: "100%",
            minWidth: 0,
            overflow: "hidden",
            overflowX: "hidden",
            boxSizing: "border-box",
            color: "white",
            pointerEvents: "none",
            background:
              "linear-gradient(180deg,rgba(225,232,235,.03) 0%,rgba(16,22,27,.10) 26%,rgba(3,6,9,.60) 56%,rgba(0,0,0,.97) 100%)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              minWidth: 0,
              maxWidth: "100%",
              overflow: "hidden",
              overflowX: "hidden",
              contain: "paint",
              clipPath: "inset(0)",
              boxSizing: "border-box",
              WebkitMaskImage:
                "linear-gradient(to bottom,transparent 0%,#000 9%,#000 91%,transparent 100%)",
              maskImage:
                "linear-gradient(to bottom,transparent 0%,#000 9%,#000 91%,transparent 100%)",
            }}
          >
            {STAGES.map((stage, slideIndex) => (
              <div
                key={stage.title}
                ref={(node) => {
                  stageSlideRefs.current[slideIndex] = node;
                }}
                data-stage-slide=""
                aria-hidden={activeStage !== slideIndex}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  overflow: "hidden",
                  overflowX: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "clamp(28px,3.2vw,58px)",
                  opacity: slideIndex === 0 ? 1 : 0,
                  visibility: slideIndex === 0 ? "visible" : "hidden",
                  willChange: "transform, opacity",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#e64343,#a640d2)",
                      fontWeight: 800,
                      fontSize: 18,
                      boxShadow: "0 8px 22px rgba(207,57,92,.38)",
                    }}
                  >
                    {slideIndex + 1}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: ".14em",
                        textTransform: "uppercase",
                        opacity: 0.72,
                      }}
                    >
                      Stage {slideIndex + 1} of {STAGES.length}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#f4bd77",
                      }}
                    >
                      {stage.focus}
                    </div>
                  </div>
                </div>
                <h2
                  style={{
                    margin: 0,
                    width: "100%",
                    maxWidth: "100%",
                    whiteSpace: "normal",
                    overflowWrap: "break-word",
                    wordBreak: "normal",
                    fontSize: "clamp(30px,3vw,54px)",
                    boxSizing: "border-box",
                    lineHeight: 1,
                    letterSpacing: "-.045em",
                    background: "linear-gradient(135deg,#ffffff 10%,#f1c2d8 48%,#cc8af0)",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {STAGE_TITLE_LINES[slideIndex].map((line) => (
                    <span
                      key={line}
                      style={{ display: "block", width: "100%", maxWidth: "100%", whiteSpace: "normal" }}
                    >
                      {line}
                    </span>
                  ))}
                </h2>
                <p
                  style={{
                    margin: "18px 0 0",
                    fontSize: "clamp(14px,1.25vw,17px)",
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,.82)",
                  }}
                >
                  {stage.description}
                </p>
              </div>
            ))}
          </div>
        </div>


        <div
          style={{
            position: "absolute",
            left: "clamp(18px,4vw,64px)",
            bottom: 27,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 11px",
            border: "1px solid rgba(255,255,255,.28)",
            borderRadius: 999,
            background: "rgba(8,16,24,.82)",
            color: "rgba(255,255,255,.9)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
          }}
          aria-hidden="true"
        >
          <span style={{ fontSize: 14 }}>
            {isDragging ? "✊" : "✋"}
          </span>
          <span>{isDragging ? "Rotating" : "Drag to rotate"}</span>
        </div>

        <style jsx>{`
          @media (max-width: 760px) {
            div[aria-live="polite"] {
              top: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              left: 44px !important;
              width: auto !important;
            }
            div[aria-live="polite"] [data-stage-slide] {
              padding: 72px 18px 64px !important;
            }
            div[aria-live="polite"] p {
              margin-top: 11px !important;
              line-height: 1.45 !important;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            * {
              scroll-behavior: auto !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}

export default GroundToSkySection;
