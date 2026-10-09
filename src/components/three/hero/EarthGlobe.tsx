"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  MathUtils,
  type Mesh,
  NoColorSpace,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  Vector3,
  Vector4,
} from "three";
import { EARTH_RADIUS, SUN_DIRECTION } from "./geo";

/*
 * Texture sources — NASA Visible Earth (public domain):
 *   Day:    Blue Marble Next Generation, Dec 2004 (topography + bathymetry)
 *   Night:  Black Marble 2016 colour composite (VIIRS)
 *   Clouds: Blue Marble cloud composite
 * The South India region textures are full-resolution crops of the same maps
 * (lon 68–88°E, lat 2–20°N) used for the city close-ups.
 */
const TEXTURE_SETS = {
  high: {
    day: "/textures/earth/earth-day-4k.jpg",
    night: "/textures/earth/earth-night-4k.jpg",
    clouds: "/textures/earth/earth-clouds-4k.jpg",
  },
  low: {
    day: "/textures/earth/earth-day-2k.jpg",
    night: "/textures/earth/earth-night-2k.jpg",
    clouds: "/textures/earth/earth-clouds-2k.jpg",
  },
} as const;

const REGION = {
  day: "/textures/earth/region-south-india-day.jpg",
  night: "/textures/earth/region-south-india-night.jpg",
  bounds: new Vector4(
    MathUtils.degToRad(68),
    MathUtils.degToRad(88),
    MathUtils.degToRad(2),
    MathUtils.degToRad(20)
  ),
};

/* Shared GLSL: equirectangular lookup that matches latLonToVector(). */
const GEO_GLSL = /* glsl */ `
  const float PI = 3.141592653589793;
  vec2 geoLonLat(vec3 dir) {
    return vec2(atan(dir.x, dir.z), asin(clamp(dir.y, -1.0, 1.0)));
  }
  vec2 geoUv(vec2 lonLat) {
    return vec2(lonLat.x / (2.0 * PI) + 0.5, lonLat.y / PI + 0.5);
  }
`;

const SURFACE_VERTEX = /* glsl */ `
  varying vec3 vDir;
  varying vec3 vWorld;
  void main() {
    vDir = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uRegionDay;
  uniform sampler2D uRegionNight;
  uniform vec4 uRegion;
  uniform vec3 uSun;
  uniform float uCityGlow;
  uniform float uNear;
  varying vec3 vDir;
  varying vec3 vWorld;
  ${GEO_GLSL}

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec3 n = normalize(vDir);
    vec2 ll = geoLonLat(n);
    vec2 uv = geoUv(ll);

    vec3 day = texture2D(uDay, uv).rgb;
    vec3 night = texture2D(uNight, uv).rgb;

    // High-resolution South India overlay with feathered edges.
    vec2 r = vec2((ll.x - uRegion.x) / (uRegion.y - uRegion.x), (ll.y - uRegion.z) / (uRegion.w - uRegion.z));
    float inRegion = smoothstep(0.0, 0.08, r.x) * smoothstep(1.0, 0.92, r.x) * smoothstep(0.0, 0.08, r.y) * smoothstep(1.0, 0.92, r.y);
    if (inRegion > 0.0) {
      vec2 rc = clamp(r, 0.0, 1.0);
      day = mix(day, texture2D(uRegionDay, rc).rgb, inRegion);
      night = mix(night, texture2D(uRegionNight, rc).rgb, inRegion);
    }

    vec3 V = normalize(cameraPosition - vWorld);
    float NdL = dot(n, uSun);
    float NdV = max(dot(n, V), 0.0);

    // Sunlit hemisphere with a soft terminator.
    float lit = smoothstep(-0.08, 0.35, NdL);
    float twilight = exp(-pow((NdL + 0.02) / 0.11, 2.0));
    vec3 sunColor = vec3(1.0, 0.93, 0.82);
    vec3 dayColor = day * sunColor * (0.15 + 1.75 * max(NdL, 0.0)) * lit;
    dayColor += day * vec3(1.0, 0.45, 0.16) * twilight * 0.55;

    // Ocean mask from the bathymetry colour, used for a sun glint.
    float water = smoothstep(0.015, 0.06, day.b - max(day.r, day.g) * 0.9);
    vec3 H = normalize(uSun + V);
    float glint = pow(max(dot(n, H), 0.0), 90.0) * water;
    dayColor += vec3(1.0, 0.72, 0.42) * glint * (lit * 1.4 + twilight * 2.2);

    // Moonlit night side: terrain stays readable as a deep navy relief.
    float dark = 1.0 - smoothstep(-0.18, 0.05, NdL);
    float grain = mix(0.92, 1.08, noise(ll * 2600.0));
    vec3 moon = (day * vec3(0.10, 0.15, 0.27) + vec3(0.004, 0.009, 0.022)) * grain;
    moon += water * vec3(0.0, 0.012, 0.035);

    // City lights: lift the Black Marble emission and warm it.
    vec3 lights = max(night - vec3(0.012, 0.012, 0.03), 0.0);
    float lum = dot(lights, vec3(0.3, 0.55, 0.15));
    // Close up, break the soft satellite glow into granular clusters so it
    // reads as many discrete lights rather than a blurred blob.
    vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * ll * 1500.0;
    float fbm = noise(q) * 0.5 + noise(q * 2.3 + 7.1) * 0.3 + noise(q * 5.7 + 3.3) * 0.2;
    float granular = mix(1.0, 0.25 + 1.5 * fbm * fbm, uNear);
    vec3 cityLight = vec3(1.0, 0.68, 0.36) * pow(lum, 1.35) * mix(3.8, 1.25, uNear) * granular * uCityGlow;

    vec3 color = dayColor + (moon + cityLight) * dark;

    // Atmospheric in-scatter at grazing angles (blue on day side, gold at dawn).
    float rim = pow(1.0 - NdV, 4.0);
    vec3 scatter = vec3(0.16, 0.42, 0.95) * smoothstep(-0.25, 0.4, NdL) + vec3(1.0, 0.5, 0.18) * twilight * 0.9;
    color += scatter * rim * 0.85 + vec3(0.02, 0.05, 0.12) * rim * dark;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_FRAGMENT = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  uniform float uOpacity;
  uniform float uDrift;
  varying vec3 vDir;
  varying vec3 vWorld;
  ${GEO_GLSL}

  void main() {
    vec3 n = normalize(vDir);
    vec2 ll = geoLonLat(n);
    ll.x += uDrift;
    float c = texture2D(uClouds, geoUv(ll)).r;
    float alpha = smoothstep(0.18, 0.85, c) * uOpacity;
    if (alpha < 0.003) discard;

    float NdL = dot(n, uSun);
    float lit = smoothstep(-0.06, 0.3, NdL);
    float twilight = exp(-pow((NdL + 0.03) / 0.12, 2.0));
    vec3 color = vec3(1.0, 0.98, 0.95) * (0.2 + 1.4 * max(NdL, 0.0)) * lit
      + vec3(1.0, 0.52, 0.22) * twilight * 0.9
      + vec3(0.025, 0.04, 0.075) * (1.0 - lit);

    gl_FragColor = vec4(color, alpha * mix(0.62, 0.95, lit));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/*
 * Atmosphere: analytic single-scattering approximation. For each view ray we
 * find the closest approach to the planet centre; density falls off
 * exponentially with that altitude, which produces a crisp, physically shaped
 * horizon band. Colour depends on the sun angle at that point.
 */
const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uSun;
  uniform float uRadius;
  uniform float uScaleHeight;
  varying vec3 vWorld;
  const float PI = 3.141592653589793;

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - ro);
    float tc = max(-dot(ro, rd), 0.0);
    vec3 p = ro + rd * tc;
    float h = length(p);
    bool hitsPlanet = h < uRadius && dot(ro, rd) < 0.0;

    float density;
    vec3 sp;
    if (hitsPlanet) {
      float tSurface = tc - sqrt(uRadius * uRadius - h * h);
      sp = ro + rd * tSurface;
      float grazing = 1.0 - max(dot(normalize(sp), -rd), 0.0);
      density = pow(grazing, 5.0) * 0.55;
    } else if (tc > 0.0) {
      // Tangent ray: column density through the closest-approach point.
      sp = p;
      density = exp(-max(h - uRadius, 0.0) / uScaleHeight);
    } else {
      // Looking upward from inside the atmosphere: short optical path.
      sp = ro;
      float sinEl = max(dot(rd, normalize(ro)), 0.0);
      float k = sqrt(uScaleHeight / (2.0 * PI * uRadius));
      density = exp(-max(length(ro) - uRadius, 0.0) / uScaleHeight) * min(1.0, k / max(sinEl, k));
    }

    float mu = dot(normalize(sp), uSun);
    float day = smoothstep(-0.22, 0.35, mu);
    float twilight = exp(-pow((mu + 0.04) / 0.16, 2.0));
    vec3 color = vec3(0.22, 0.52, 1.0) * day * 1.35
      + vec3(1.0, 0.52, 0.17) * twilight * 1.6
      + vec3(0.03, 0.07, 0.17) * 0.55;

    float toSun = max(dot(rd, uSun), 0.0);
    vec3 mie = vec3(1.0, 0.62, 0.3) * (pow(toSun, 10.0) * 1.3 + pow(toSun, 160.0) * 3.0);

    // Tame the in-atmosphere haze at close range so the sky stays deep navy.
    float cameraAltitude = length(ro) - uRadius;
    float closeDim = mix(0.42, 1.0, smoothstep(0.08, 0.9, cameraAltitude));
    vec3 result = (color + mie) * density * closeDim;
    gl_FragColor = vec4(result, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Stable callback (module scope) so drei runs it once per load, not per render.
function prepareTextures(loaded: Texture | Texture[]) {
  const list = Array.isArray(loaded) ? loaded : [loaded];
  list.forEach((texture, index) => {
    // Index 2 is the cloud mask (data, not colour).
    texture.colorSpace = index === 2 ? NoColorSpace : SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  });
}

function useTextureTier() {
  // Canvas children only render in the browser.
  return useMemo(() => {
    const small = window.innerWidth < 900 || (navigator.hardwareConcurrency ?? 8) <= 4;
    return small ? TEXTURE_SETS.low : TEXTURE_SETS.high;
  }, []);
}

export function EarthSurface({
  cloudOpacityRef,
  nearRef,
}: {
  cloudOpacityRef: React.RefObject<number>;
  /** 0 when high above the planet, 1 at city close-up range. */
  nearRef: React.RefObject<number>;
}) {
  const set = useTextureTier();
  const cloudMesh = useRef<Mesh>(null);
  const earthMesh = useRef<Mesh>(null);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const [day, night, clouds, regionDay, regionNight] = useTexture([
    set.day,
    set.night,
    set.clouds,
    REGION.day,
    REGION.night,
  ], prepareTextures);

  const earthMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: EARTH_FRAGMENT,
        uniforms: {
          uDay: { value: day },
          uNight: { value: night },
          uRegionDay: { value: regionDay },
          uRegionNight: { value: regionNight },
          uRegion: { value: REGION.bounds },
          uSun: { value: SUN_DIRECTION },
          uCityGlow: { value: 1 },
          uNear: { value: 0 },
        },
      }),
    [day, night, regionDay, regionNight]
  );

  const cloudMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uClouds: { value: clouds },
          uSun: { value: SUN_DIRECTION },
          uOpacity: { value: 1 },
          uDrift: { value: 0 },
        },
      }),
    [clouds]
  );

  useEffect(
    () => () => {
      earthMaterial.dispose();
      cloudMaterial.dispose();
    },
    [earthMaterial, cloudMaterial]
  );

  useFrame((_, delta) => {
    const earth = earthMesh.current?.material as ShaderMaterial | undefined;
    if (earth) earth.uniforms.uNear.value = nearRef.current ?? 0;
    const material = cloudMesh.current?.material as ShaderMaterial | undefined;
    if (!material) return;
    const uniforms = material.uniforms;
    uniforms.uOpacity.value = cloudOpacityRef.current ?? 1;
    if (!reduced) uniforms.uDrift.value += delta * 0.0022;
  });

  return (
    <group>
      <mesh ref={earthMesh} material={earthMaterial} renderOrder={0}>
        <sphereGeometry args={[EARTH_RADIUS, 320, 160]} />
      </mesh>
      <mesh ref={cloudMesh} material={cloudMaterial} renderOrder={2}>
        <sphereGeometry args={[EARTH_RADIUS + 0.07, 192, 96]} />
      </mesh>
    </group>
  );
}

export function Atmosphere() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uSun: { value: SUN_DIRECTION },
          uRadius: { value: EARTH_RADIUS },
          uScaleHeight: { value: 0.085 },
        },
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} renderOrder={3}>
      <sphereGeometry args={[EARTH_RADIUS * 1.045, 160, 80]} />
    </mesh>
  );
}

function radialTexture(stops: [number, string][]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  return texture;
}

/** Sun disc and soft glare, placed far away along the fixed sun direction. */
export function Sun() {
  const core = useMemo(
    () =>
      radialTexture([
        [0, "rgba(255,255,250,1)"],
        [0.12, "rgba(255,244,214,1)"],
        [0.3, "rgba(255,196,120,0.55)"],
        [1, "rgba(255,150,60,0)"],
      ]),
    []
  );
  const halo = useMemo(
    () =>
      radialTexture([
        [0, "rgba(255,206,140,0.55)"],
        [0.35, "rgba(255,150,70,0.16)"],
        [1, "rgba(255,120,40,0)"],
      ]),
    []
  );

  useEffect(
    () => () => {
      core.dispose();
      halo.dispose();
    },
    [core, halo]
  );

  const position = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(420), []);

  return (
    <group position={position}>
      <sprite scale={[34, 34, 1]} renderOrder={1}>
        <spriteMaterial map={core} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
      </sprite>
      <sprite scale={[150, 150, 1]} renderOrder={4}>
        <spriteMaterial
          map={halo}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          transparent
          opacity={0.32}
        />
      </sprite>
      <sprite scale={[260, 7, 1]} renderOrder={4}>
        <spriteMaterial
          map={halo}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          transparent
          opacity={0.2}
        />
      </sprite>
    </group>
  );
}

/** Sparse, varied star field; dimmed around the sun. */
export function StarField() {
  const geometry = useMemo(() => {
    const count = 2600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tint = new Color();
    const dir = new Vector3();
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      dir.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
      positions.set(dir.clone().multiplyScalar(900).toArray(), i * 3);
      const sunFade = MathUtils.smoothstep(1 - dir.dot(SUN_DIRECTION), 0.04, 0.5);
      const brightness = Math.pow(random(), 2.6) * 0.95 * sunFade + 0.04;
      tint.setHSL(0.58 + random() * 0.08, 0.25, 0.55 + random() * 0.4).multiplyScalar(brightness);
      colors.set([tint.r, tint.g, tint.b], i * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} renderOrder={-1}>
      <pointsMaterial size={1.6} sizeAttenuation={false} vertexColors transparent depthWrite={false} />
    </points>
  );
}

