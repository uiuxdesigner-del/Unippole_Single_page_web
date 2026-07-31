"use client";

import {
  ContactShadows,
  Stars,
} from "@react-three/drei";
import {
  Canvas,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";

import {
  MainAutoRotatingUnipole,
  StaticBackgroundUnipole,
} from "./ProceduralUnipole";

type Vec3 = [number, number, number];

function NightSkyBackdrop() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;

    const context = canvas.getContext("2d");

    if (!context) {
      return new THREE.CanvasTexture(canvas);
    }

    const vertical = context.createLinearGradient(0, 0, 0, 1024);
    vertical.addColorStop(0, "#0c3262");
    vertical.addColorStop(0.44, "#0a244c");
    vertical.addColorStop(0.72, "#081a38");
    vertical.addColorStop(1, "#050b18");

    context.fillStyle = vertical;
    context.fillRect(0, 0, 1024, 1024);

    const centerGlow = context.createRadialGradient(
      512,
      490,
      20,
      512,
      490,
      610,
    );
    centerGlow.addColorStop(0, "rgba(37, 111, 203, 0.32)");
    centerGlow.addColorStop(0.52, "rgba(17, 63, 126, 0.18)");
    centerGlow.addColorStop(1, "rgba(2, 7, 18, 0)");

    context.fillStyle = centerGlow;
    context.fillRect(0, 0, 1024, 1024);

    const textureResult = new THREE.CanvasTexture(canvas);
    textureResult.colorSpace = THREE.SRGBColorSpace;
    textureResult.needsUpdate = true;

    return textureResult;
  }, []);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <mesh position={[0, 2.2, -21]}>
      <planeGeometry args={[42, 25]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function FixedCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const mobile = size.width < 760;
    const tablet = size.width >= 760 && size.width < 1100;

    if (mobile) {
      camera.position.set(0, 2.45, 15.1);
      camera.lookAt(0, 2.65, 0);
    } else if (tablet) {
      camera.position.set(0, 2.55, 13.8);
      camera.lookAt(0, 2.7, 0);
    } else {
      camera.position.set(0, 2.6, 15.8);
      camera.lookAt(0, 2.72, 0);
    }

    camera.updateProjectionMatrix();
  }, [camera, size.width]);

  return null;
}

function NightGround() {
  const horizonLights = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const x = -13 + index * 0.64;
        const y = -2.9 + (index % 4) * 0.025;
        const z = -10.5 - (index % 5) * 0.32;

        return {
          position: [x, y, z] as Vec3,
          scale: index % 6 === 0 ? 0.055 : 0.03,
          warm: index % 5 === 0,
        };
      }),
    [],
  );

  return (
    <group>
      {/* Proper dark-blue ground instead of a flat black bottom */}
      <mesh
        position={[0, -3.2, -1.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[44, 34]} />

        <meshStandardMaterial
          color="#0a1830"
          roughness={0.9}
          metalness={0.08}
        />
      </mesh>

      {/* Soft illuminated platform below the main pole */}
      <mesh
        position={[0, -3.17, 0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[5.8, 96]} />

        <meshPhysicalMaterial
          color="#12315b"
          emissive="#0d315f"
          emissiveIntensity={0.72}
          metalness={0.34}
          roughness={0.52}
          clearcoat={0.18}
          transparent
          opacity={0.82}
        />
      </mesh>

      <mesh
        position={[0, -3.145, 0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[3.6, 3.67, 96]} />

        <meshBasicMaterial
          color="#286fba"
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>

      {/* Distant horizon haze */}
      <mesh position={[0, -2.05, -14.2]}>
        <planeGeometry args={[36, 5.5]} />

        <meshBasicMaterial
          color="#0b2143"
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, -2.55, -12.8]}>
        <planeGeometry args={[34, 1.2]} />

        <meshBasicMaterial
          color="#15528b"
          transparent
          opacity={0.30}
          depthWrite={false}
        />
      </mesh>

      {horizonLights.map((light, index) => (
        <mesh
          key={`horizon-light-${index}`}
          position={light.position}
          scale={light.scale}
        >
          <sphereGeometry args={[1, 12, 12]} />

          <meshBasicMaterial
            color={light.warm ? "#ffd29a" : "#70bfff"}
            transparent
            opacity={0.74}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

type CometProps = {
  start: Vec3;
  speed: number;
  delay: number;
  scale: number;
};

function Comet({
  start,
  speed,
  delay,
  scale,
}: CometProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startedRef = useRef(false);

  useFrame((state, delta) => {
    const group = groupRef.current;

    if (!group) return;

    if (state.clock.elapsedTime < delay) {
      group.visible = false;
      return;
    }

    if (!startedRef.current) {
      group.position.set(...start);
      group.visible = true;
      startedRef.current = true;
    }

    group.position.x -= delta * speed;
    group.position.y -= delta * speed * 0.12;

    if (group.position.x < -13) {
      group.position.x = 13;
      group.position.y = start[1] + Math.random() * 1.1;
    }
  });

  return (
    <group
      ref={groupRef}
      position={start}
      rotation={[0, 0, -0.12]}
      scale={scale}
    >
      <mesh>
        <sphereGeometry args={[0.052, 18, 18]} />

        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.94}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0.68, 0, 0]}>
        <boxGeometry args={[1.35, 0.022, 0.022]} />

        <meshBasicMaterial
          color="#80cfff"
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}


type BackgroundLightProps = {
  position: Vec3;
  intensity?: number;
};

function BackgroundLight({
  position,
  intensity = 4.5,
}: BackgroundLightProps) {
  return (
    <pointLight
      position={position}
      intensity={intensity}
      distance={8}
      decay={2}
      color="#4ca6ff"
    />
  );
}

function SceneContent() {
  return (
    <>
      <FixedCamera />
      <NightSkyBackdrop />

      <fog
        attach="fog"
        args={["#07152d", 19, 46]}
      />

      <ambientLight intensity={0.88} />

      <hemisphereLight
        intensity={1.18}
        color="#9ad1ff"
        groundColor="#08152b"
      />

      <directionalLight
        position={[5, 9, 7]}
        intensity={2.15}
        color="#d7ecff"
      />

      <spotLight
        position={[-6, 6, 7]}
        intensity={24}
        angle={0.58}
        penumbra={0.92}
        color="#347dff"
      />

      <pointLight
        position={[6, 5, 3]}
        intensity={11}
        distance={16}
        decay={2}
        color="#36b0ff"
      />

      <NightGround />

      <Stars
        radius={34}
        depth={22}
        count={1250}
        factor={2.7}
        saturation={0.12}
        fade
        speed={0.06}
      />

      <Comet
        start={[11.5, 5.4, -12]}
        speed={1.7}
        delay={1.3}
        scale={1}
      />

      <Comet
        start={[13, 4.1, -15]}
        speed={1.18}
        delay={6}
        scale={0.72}
      />

      {/* Larger and brighter background UNIPOLEs */}
      <StaticBackgroundUnipole
        position={[-5.1, -3.14, -4.2]}
        rotation={[0, 0.22, 0]}
        scale={0.48}
      />

      <BackgroundLight
        position={[-5.0, 0.3, -2.7]}
        intensity={12.0}
      />

      <StaticBackgroundUnipole
        position={[5.2, -3.14, -4.5]}
        rotation={[0, -0.24, 0]}
        scale={0.50}
      />

      <BackgroundLight
        position={[5.15, 0.45, -3.0]}
        intensity={12.5}
      />

      <StaticBackgroundUnipole
        position={[-2.9, -3.16, -7.4]}
        rotation={[0, 0.08, 0]}
        scale={0.31}
      />

      <BackgroundLight
        position={[-2.8, -0.6, -6.3]}
        intensity={8.0}
      />

      <StaticBackgroundUnipole
        position={[3.0, -3.17, -7.7]}
        rotation={[0, -0.1, 0]}
        scale={0.30}
      />

      <BackgroundLight
        position={[2.9, -0.65, -6.6]}
        intensity={7.8}
      />

      {/* Larger foreground model, intentionally framed closer */}
      <MainAutoRotatingUnipole
        position={[0, -5.75, 0.65]}
        scale={1.12}
      />


      <ContactShadows
        position={[0, -3.14, 0]}
        opacity={0.3}
        scale={19}
        blur={3.4}
        far={9}
        color="#010309"
      />
    </>
  );
}

export default function CTAUnipoleScene() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-label="Cinematic rotating 3D UNIPOLE presentation"
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: [0, 2.6, 12.8],
          fov: 40,
          near: 0.1,
          far: 80,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        shadows={false}
        style={{
          touchAction: "none",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.82;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color
          attach="background"
          args={["#07152d"]}
        />

        <SceneContent />
      </Canvas>
    </div>
  );
}