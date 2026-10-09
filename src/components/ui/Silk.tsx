"use client";

/* eslint-disable react/no-unknown-property */

import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type RootState,
} from "@react-three/fiber";
import {
  Color,
  Mesh,
  ShaderMaterial,
  type IUniform,
} from "three";

type NormalizedRGB = [number, number, number];

function hexToNormalizedRGB(hex: string): NormalizedRGB {
  const clean = hex.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [184 / 255, 63 / 255, 82 / 255];
  }

  return [
    Number.parseInt(clean.slice(0, 2), 16) / 255,
    Number.parseInt(clean.slice(2, 4), 16) / 255,
    Number.parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

interface UniformValue<T = number | Color> {
  value: T;
}

interface SilkUniforms {
  uSpeed: UniformValue<number>;
  uScale: UniformValue<number>;
  uNoiseIntensity: UniformValue<number>;
  uColor: UniformValue<Color>;
  uRotation: UniformValue<number>;
  uTime: UniformValue<number>;
  [uniform: string]: IUniform;
}

const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vPosition = position;
  vUv = uv;

  gl_Position =
    projectionMatrix *
    modelViewMatrix *
    vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform vec3 uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2 r = G * sin(G * texCoord);

  return fract(
    r.x *
    r.y *
    (1.0 + texCoord.x)
  );
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);

  mat2 rotation = mat2(
    c,
    -s,
    s,
    c
  );

  return rotation * uv;
}

void main() {
  float randomNoise = noise(gl_FragCoord.xy);

  vec2 uv = rotateUvs(
    vUv * uScale,
    uRotation
  );

  vec2 texturePosition = uv * uScale;
  float timeOffset = uSpeed * uTime;

  texturePosition.y +=
    0.03 *
    sin(
      8.0 * texturePosition.x -
      timeOffset
    );

  float pattern =
    0.6 +
    0.4 *
    sin(
      5.0 *
      (
        texturePosition.x +
        texturePosition.y +
        cos(
          3.0 * texturePosition.x +
          5.0 * texturePosition.y
        ) +
        0.02 * timeOffset
      ) +
      sin(
        20.0 *
        (
          texturePosition.x +
          texturePosition.y -
          0.1 * timeOffset
        )
      )
    );

  vec4 colour =
    vec4(uColor, 1.0) *
    vec4(pattern) -
    randomNoise /
    15.0 *
    uNoiseIntensity;

  colour.a = 1.0;

  gl_FragColor = colour;
}
`;

interface SilkPlaneProps {
  uniforms: SilkUniforms;
  containerRef: RefObject<HTMLDivElement | null>;
}

const SilkPlane = forwardRef<Mesh, SilkPlaneProps>(
  function SilkPlane({ uniforms, containerRef }, ref) {
    const { viewport } = useThree();
    const setFrameloop = useThree((state) => state.setFrameloop);
    const invalidate = useThree((state) => state.invalidate);
    const isAnimatingRef = useRef(false);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const motionQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      let isVisible = false;

      const updateRendering = () => {
        const canRender = isVisible && !document.hidden;
        isAnimatingRef.current = canRender && !motionQuery.matches;

        setFrameloop(
          isAnimatingRef.current ? "always" : canRender ? "demand" : "never",
        );

        if (canRender) invalidate();
      };

      const observer = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        updateRendering();
      });

      observer.observe(container);
      motionQuery.addEventListener("change", updateRendering);
      document.addEventListener("visibilitychange", updateRendering);
      updateRendering();

      return () => {
        observer.disconnect();
        motionQuery.removeEventListener("change", updateRendering);
        document.removeEventListener("visibilitychange", updateRendering);
        isAnimatingRef.current = false;
        setFrameloop("never");
      };
    }, [containerRef, invalidate, setFrameloop]);

    useLayoutEffect(() => {
      const meshReference =
        ref as MutableRefObject<Mesh | null>;

      if (!meshReference.current) {
        return;
      }

      meshReference.current.scale.set(
        viewport.width,
        viewport.height,
        1,
      );
    }, [ref, viewport.height, viewport.width]);

    useFrame((_state: RootState, delta: number) => {
      const meshReference =
        ref as MutableRefObject<Mesh | null>;

      if (!meshReference.current || !isAnimatingRef.current) {
        return;
      }

      const material =
        meshReference.current
          .material as ShaderMaterial & {
          uniforms: SilkUniforms;
        };

      material.uniforms.uTime.value +=
        0.1 * Math.min(delta, 0.05);
    });

    return (
      <mesh ref={ref}>
        <planeGeometry args={[1, 1, 1, 1]} />

        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
    );
  },
);

SilkPlane.displayName = "SilkPlane";

export interface SilkProps {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
  className?: string;
}

export default function Silk({
  speed = 5,
  scale = 1,
  color = "#b83f52",
  noiseIntensity = 1.5,
  rotation = 0,
  className,
}: SilkProps) {
  const meshRef = useRef<Mesh>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const uniforms = useMemo<SilkUniforms>(
    () => ({
      uSpeed: {
        value: speed,
      },
      uScale: {
        value: scale,
      },
      uNoiseIntensity: {
        value: noiseIntensity,
      },
      uColor: {
        value: new Color(
          ...hexToNormalizedRGB(color),
        ),
      },
      uRotation: {
        value: rotation,
      },
      uTime: {
        value: 0,
      },
    }),
    [],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/immutability -- imperative uniform
       updates are required to drive the shader each frame without
       recreating the material identity */
    uniforms.uSpeed.value = speed;
    uniforms.uScale.value = scale;
    uniforms.uNoiseIntensity.value =
      noiseIntensity;

    uniforms.uColor.value.setRGB(
      ...hexToNormalizedRGB(color),
    );

    uniforms.uRotation.value = rotation;
    /* eslint-enable react-hooks/immutability */
  }, [
    color,
    noiseIntensity,
    rotation,
    scale,
    speed,
    uniforms,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      aria-hidden="true"
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <SilkPlane
          ref={meshRef}
          uniforms={uniforms}
          containerRef={containerRef}
        />
      </Canvas>
    </div>
  );
}
