"use client";

import {
  useFrame,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";

type Vec3 = [number, number, number];

type BeamProps = {
  start: Vec3;
  end: Vec3;
  thickness: number;
  material: ReactNode;
};

function Beam({
  start,
  end,
  thickness,
  material,
}: BeamProps) {
  const transform = useMemo(() => {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const direction = to.clone().sub(from);
    const length = direction.length();
    const midpoint = from.clone().add(to).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );

    return {
      midpoint,
      quaternion,
      length,
    };
  }, [end, start]);

  return (
    <mesh
      position={transform.midpoint}
      quaternion={transform.quaternion}
      castShadow
      receiveShadow
    >
      <boxGeometry
        args={[
          thickness,
          transform.length,
          thickness,
        ]}
      />
      {material}
    </mesh>
  );
}

function Steel({
  opacity = 1,
  bright = false,
}: {
  opacity?: number;
  bright?: boolean;
}) {
  return (
    <meshPhysicalMaterial
      color={bright ? "#486f9e" : "#17325b"}
      metalness={0.92}
      roughness={0.20}
      clearcoat={0.55}
      clearcoatRoughness={0.20}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}

function DarkSteel({
  opacity = 1,
}: {
  opacity?: number;
}) {
  return (
    <meshPhysicalMaterial
      color="#07152e"
      metalness={0.94}
      roughness={0.18}
      clearcoat={0.45}
      clearcoatRoughness={0.22}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}

function createMainBillboardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;

  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const base = context.createLinearGradient(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  base.addColorStop(0, "#02071a");
  base.addColorStop(0.50, "#06317f");
  base.addColorStop(1, "#0b7cff");

  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(
    1500,
    350,
    40,
    1500,
    350,
    920,
  );

  glow.addColorStop(0, "rgba(130, 215, 255, 0.95)");
  glow.addColorStop(0.28, "rgba(28, 115, 255, 0.48)");
  glow.addColorStop(1, "rgba(2, 8, 29, 0)");

  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.translate(1420, 160);
  context.rotate(-0.32);

  const streak = context.createLinearGradient(0, 0, 760, 0);
  streak.addColorStop(0, "rgba(255,255,255,0)");
  streak.addColorStop(0.48, "rgba(130,210,255,0.82)");
  streak.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = streak;
  context.fillRect(-300, -12, 1120, 24);
  context.restore();

  context.strokeStyle = "rgba(135, 206, 255, 0.88)";
  context.lineWidth = 9;
  context.strokeRect(
    48,
    48,
    canvas.width - 96,
    canvas.height - 96,
  );

  context.fillStyle = "rgba(230, 244, 255, 0.96)";
  context.font = "600 44px Arial";
  context.fillText("ADINN UNIPOLE", 148, 170);

  context.fillStyle = "#ffffff";
  context.font = "700 145px Arial";
  context.fillText("ELEVATE", 150, 495);
  context.fillText("YOUR BRAND", 150, 665);

  context.fillStyle = "rgba(222, 239, 255, 0.88)";
  context.font = "500 46px Arial";
  context.fillText(
    "HIGH-IMPACT UNIPOLE VISIBILITY",
    154,
    790,
  );

  context.fillStyle = "#72c6ff";
  context.fillRect(154, 850, 560, 14);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return texture;
}

function createBackgroundBillboardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;

  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const gradient = context.createLinearGradient(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  gradient.addColorStop(0, "#02071b");
  gradient.addColorStop(0.55, "#07347f");
  gradient.addColorStop(1, "#0d71ef");

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.translate(620, 110);
  context.rotate(-0.34);

  const streak = context.createLinearGradient(0, 0, 500, 0);
  streak.addColorStop(0, "rgba(255,255,255,0)");
  streak.addColorStop(0.52, "rgba(118,202,255,0.80)");
  streak.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = streak;
  context.fillRect(-220, -8, 760, 16);
  context.restore();

  context.strokeStyle = "rgba(108, 182, 255, 0.60)";
  context.lineWidth = 6;
  context.strokeRect(
    28,
    28,
    canvas.width - 56,
    canvas.height - 56,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return texture;
}


function BlinkingLamp({ phase = 0 }: { phase?: number }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const pulse =
      (Math.sin(state.clock.elapsedTime * 1.15 + phase) + 1) / 2;

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.9 + pulse * 3.8;
    }

    if (lightRef.current) {
      lightRef.current.intensity = 0.45 + pulse * 2.2;
    }
  });

  return (
    <>
      <mesh position={[0, 0, 0.115]}>
        <boxGeometry args={[0.22, 0.10, 0.020]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#e7f5ff"
          emissive="#5fb8ff"
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>

      <pointLight
        ref={lightRef}
        position={[0, -0.08, 0.30]}
        intensity={0.45}
        distance={2.8}
        decay={2}
        color="#7fcaff"
      />
    </>
  );
}

function BlinkingFrameLight({
  width,
  height,
  centerY,
  frontZ,
  background,
}: {
  width: number;
  height: number;
  centerY: number;
  frontZ: number;
  background: boolean;
}) {
  const glowLightRef = useRef<THREE.PointLight>(null);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: background ? "#61aef9" : "#d7f1ff",
        emissive: background ? "#2577d6" : "#55b8ff",
        emissiveIntensity: background ? 0.7 : 1.7,
        metalness: 0.08,
        roughness: 0.22,
        transparent: true,
        opacity: background ? 0.82 : 0.98,
        toneMapped: false,
      }),
    [background],
  );

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    // Slow, clearly visible breathing blink.
    const pulse =
      (Math.sin(state.clock.elapsedTime * 0.82) + 1) / 2;

    material.emissiveIntensity = background
      ? 0.55 + pulse * 1.15
      : 1.15 + pulse * 4.2;

    material.opacity = background
      ? 0.66 + pulse * 0.22
      : 0.78 + pulse * 0.20;

    if (glowLightRef.current) {
      glowLightRef.current.intensity = background
        ? 0.8 + pulse * 1.3
        : 2.0 + pulse * 4.0;
    }
  });

  const barDepth = 0.035;
  const barThickness = background ? 0.052 : 0.065;
  const z = frontZ + 0.045;

  return (
    <group>
      <mesh position={[0, centerY + height / 2 - 0.035, z]}>
        <boxGeometry args={[width, barThickness, barDepth]} />
        <primitive object={material} attach="material" />
      </mesh>

      <mesh position={[0, centerY - height / 2 + 0.035, z]}>
        <boxGeometry args={[width, barThickness, barDepth]} />
        <primitive object={material} attach="material" />
      </mesh>

      <mesh position={[-width / 2 + 0.035, centerY, z]}>
        <boxGeometry args={[barThickness, height, barDepth]} />
        <primitive object={material} attach="material" />
      </mesh>

      <mesh position={[width / 2 - 0.035, centerY, z]}>
        <boxGeometry args={[barThickness, height, barDepth]} />
        <primitive object={material} attach="material" />
      </mesh>

      <pointLight
        ref={glowLightRef}
        position={[0, centerY, frontZ + 1.3]}
        intensity={background ? 0.8 : 2.0}
        distance={background ? 5.5 : 9}
        decay={2}
        color="#57b9ff"
      />
    </group>
  );
}

type DetailedUnipoleProps = {
  background?: boolean;
  simplified?: boolean;
};

export function DetailedUnipole({
  background = false,
  simplified = false,
}: DetailedUnipoleProps) {
  const mainTexture = useMemo(
    () => createMainBillboardTexture(),
    [],
  );

  const backgroundTexture = useMemo(
    () => createBackgroundBillboardTexture(),
    [],
  );

  const texture = background
    ? backgroundTexture
    : mainTexture;

  const opacity = background ? 0.86 : 1;

  const poleHeight = 7.15;
  const billboardWidth = 6.65;
  const billboardHeight = 3.72;
  const billboardDepth = 0.46;
  const billboardCenterY = 9.55;
  const billboardBottom = billboardCenterY - billboardHeight / 2;
  const billboardTop = billboardCenterY + billboardHeight / 2;
  const frontZ = billboardDepth / 2 + 0.014;
  const rearZ = -billboardDepth / 2 - 0.014;
  const frameThickness = 0.145;
  const supportThickness = 0.18;

  return (
    <group>
      {!simplified && (
        <>
          <mesh
            position={[0, -0.28, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.25, 0.58, 1.25]} />
            <meshStandardMaterial
              color="#2d3b52"
              roughness={0.84}
            />
          </mesh>

          <mesh
            position={[0, 0.06, 0]}
            castShadow
          >
            <boxGeometry args={[0.86, 0.10, 0.86]} />
            <DarkSteel />
          </mesh>

          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (Math.PI * 2 * index) / 12;

            return (
              <group
                key={`anchor-${index}`}
                position={[
                  Math.cos(angle) * 0.32,
                  0.16,
                  Math.sin(angle) * 0.32,
                ]}
              >
                <mesh castShadow>
                  <cylinderGeometry
                    args={[0.028, 0.028, 0.23, 16]}
                  />
                  <DarkSteel />
                </mesh>

                <mesh position={[0, 0.11, 0]}>
                  <cylinderGeometry
                    args={[0.052, 0.052, 0.045, 6]}
                  />
                  <Steel bright />
                </mesh>
              </group>
            );
          })}
        </>
      )}

      {/* Tapered pole */}
      <mesh
        position={[0, poleHeight / 2 + 0.10, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[
            0.235,
            0.34,
            poleHeight,
            simplified ? 24 : 64,
            1,
          ]}
        />
        <Steel
          opacity={opacity}
          bright={!background}
        />
      </mesh>

      {!simplified && (
        <>
          {Array.from({ length: 5 }).map((_, index) => (
            <mesh
              key={`pole-ring-${index}`}
              position={[
                0,
                1.15 + index * 1.24,
                0,
              ]}
            >
              <torusGeometry
                args={[
                  0.31 - index * 0.012,
                  0.022,
                  12,
                  48,
                ]}
              />
              <DarkSteel />
            </mesh>
          ))}

          <mesh position={[0, poleHeight + 0.12, 0]}>
            <boxGeometry args={[0.74, 0.11, 0.74]} />
            <DarkSteel />
          </mesh>

          {[-0.24, 0.24].map((x) => (
            <Beam
              key={`gusset-${x}`}
              start={[x, poleHeight - 0.05, 0]}
              end={[x * 1.6, poleHeight + 0.60, rearZ]}
              thickness={0.10}
              material={<DarkSteel />}
            />
          ))}
        </>
      )}

      {/* Billboard face */}
      <mesh
        position={[0, billboardCenterY, frontZ]}
        castShadow
        receiveShadow
      >
        <planeGeometry
          args={[
            billboardWidth,
            billboardHeight,
          ]}
        />
        <meshPhysicalMaterial
          map={texture}
          emissive={background ? "#082350" : "#0b5fff"}
          emissiveIntensity={background ? 0.72 : 0.74}
          roughness={0.20}
          metalness={0.08}
          clearcoat={0.35}
          transparent={background}
          opacity={opacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      <BlinkingFrameLight
        width={billboardWidth - 0.10}
        height={billboardHeight - 0.10}
        centerY={billboardCenterY}
        frontZ={frontZ}
        background={background}
      />

      <mesh
        position={[0, billboardCenterY, rearZ]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry
          args={[
            billboardWidth,
            billboardHeight,
          ]}
        />
        <meshPhysicalMaterial
          color="#07152c"
          metalness={0.62}
          roughness={0.28}
          transparent={background}
          opacity={background ? 0.58 : 1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Deep perimeter frame */}
      <mesh position={[0, billboardTop + 0.075, 0]}>
        <boxGeometry
          args={[
            billboardWidth + frameThickness * 2,
            frameThickness,
            billboardDepth,
          ]}
        />
        <DarkSteel opacity={opacity} />
      </mesh>

      <mesh position={[0, billboardBottom - 0.075, 0]}>
        <boxGeometry
          args={[
            billboardWidth + frameThickness * 2,
            frameThickness,
            billboardDepth,
          ]}
        />
        <DarkSteel opacity={opacity} />
      </mesh>

      <mesh
        position={[
          -billboardWidth / 2 - 0.075,
          billboardCenterY,
          0,
        ]}
      >
        <boxGeometry
          args={[
            frameThickness,
            billboardHeight,
            billboardDepth,
          ]}
        />
        <DarkSteel opacity={opacity} />
      </mesh>

      <mesh
        position={[
          billboardWidth / 2 + 0.075,
          billboardCenterY,
          0,
        ]}
      >
        <boxGeometry
          args={[
            frameThickness,
            billboardHeight,
            billboardDepth,
          ]}
        />
        <DarkSteel opacity={opacity} />
      </mesh>

      {/* Internal depth rails */}
      {!simplified &&
        [-0.15, 0.15].map((z) => (
          <group key={`depth-frame-${z}`}>
            <mesh
              position={[
                0,
                billboardTop - 0.16,
                z,
              ]}
            >
              <boxGeometry
                args={[
                  billboardWidth * 0.96,
                  0.065,
                  0.065,
                ]}
              />
              <Steel opacity={opacity} />
            </mesh>

            <mesh
              position={[
                0,
                billboardBottom + 0.16,
                z,
              ]}
            >
              <boxGeometry
                args={[
                  billboardWidth * 0.96,
                  0.065,
                  0.065,
                ]}
              />
              <Steel opacity={opacity} />
            </mesh>
          </group>
        ))}

      {/* Head mast and truss */}
      <mesh
        position={[
          0,
          poleHeight + 1.38,
          rearZ,
        ]}
      >
        <boxGeometry
          args={[
            supportThickness,
            2.62,
            supportThickness,
          ]}
        />
        <DarkSteel opacity={opacity} />
      </mesh>

      <mesh
        position={[
          0,
          billboardCenterY,
          rearZ,
        ]}
      >
        <boxGeometry
          args={[
            billboardWidth * 0.74,
            supportThickness,
            supportThickness,
          ]}
        />
        <DarkSteel opacity={opacity} />
      </mesh>

      <Beam
        start={[0, poleHeight + 0.28, rearZ]}
        end={[
          -billboardWidth * 0.36,
          billboardCenterY,
          rearZ,
        ]}
        thickness={supportThickness * 0.70}
        material={<DarkSteel opacity={opacity} />}
      />

      <Beam
        start={[0, poleHeight + 0.28, rearZ]}
        end={[
          billboardWidth * 0.36,
          billboardCenterY,
          rearZ,
        ]}
        thickness={supportThickness * 0.70}
        material={<DarkSteel opacity={opacity} />}
      />

      {!simplified && (
        <>
          {[0.20, 0.40, 0.60, 0.80].map((ratio) => (
            <mesh
              key={`rear-horizontal-${ratio}`}
              position={[
                0,
                billboardBottom + billboardHeight * ratio,
                rearZ,
              ]}
            >
              <boxGeometry
                args={[
                  billboardWidth,
                  0.095,
                  0.095,
                ]}
              />
              <DarkSteel />
            </mesh>
          ))}

          {[0.17, 0.34, 0.50, 0.66, 0.83].map((ratio) => (
            <mesh
              key={`rear-vertical-${ratio}`}
              position={[
                -billboardWidth / 2 + billboardWidth * ratio,
                billboardCenterY,
                rearZ,
              ]}
            >
              <boxGeometry
                args={[
                  0.095,
                  billboardHeight,
                  0.095,
                ]}
              />
              <DarkSteel />
            </mesh>
          ))}

          <Beam
            start={[
              -billboardWidth / 2,
              billboardBottom,
              rearZ,
            ]}
            end={[
              billboardWidth / 2,
              billboardTop,
              rearZ,
            ]}
            thickness={0.060}
            material={<DarkSteel />}
          />

          <Beam
            start={[
              billboardWidth / 2,
              billboardBottom,
              rearZ,
            ]}
            end={[
              -billboardWidth / 2,
              billboardTop,
              rearZ,
            ]}
            thickness={0.060}
            material={<DarkSteel />}
          />

          {/* Catwalk deck */}
          <mesh
            position={[
              0,
              billboardBottom - 0.23,
              rearZ - 0.48,
            ]}
            castShadow
          >
            <boxGeometry
              args={[
                billboardWidth * 0.94,
                0.09,
                0.95,
              ]}
            />
            <DarkSteel />
          </mesh>

          {/* Catwalk lower joists */}
          {Array.from({ length: 10 }).map((_, index) => {
            const x =
              -billboardWidth * 0.43 +
              (billboardWidth * 0.86 * index) / 9;

            return (
              <mesh
                key={`joist-${index}`}
                position={[
                  x,
                  billboardBottom - 0.34,
                  rearZ - 0.48,
                ]}
              >
                <boxGeometry args={[0.055, 0.13, 0.95]} />
                <Steel />
              </mesh>
            );
          })}

          {/* Safety rail */}
          <Beam
            start={[
              -billboardWidth * 0.47,
              billboardBottom + 0.73,
              rearZ - 0.94,
            ]}
            end={[
              billboardWidth * 0.47,
              billboardBottom + 0.73,
              rearZ - 0.94,
            ]}
            thickness={0.040}
            material={<Steel bright />}
          />

          {Array.from({ length: 10 }).map((_, index) => {
            const x =
              -billboardWidth * 0.47 +
              (billboardWidth * 0.94 * index) / 9;

            return (
              <Beam
                key={`rail-post-${index}`}
                start={[
                  x,
                  billboardBottom - 0.12,
                  rearZ - 0.94,
                ]}
                end={[
                  x,
                  billboardBottom + 0.73,
                  rearZ - 0.94,
                ]}
                thickness={0.034}
                material={<Steel />}
              />
            );
          })}

          {/* Ladder */}
          <group position={[0, 0, rearZ - 0.18]}>
            <Beam
              start={[-0.22, 0.50, 0]}
              end={[-0.22, poleHeight - 0.20, 0]}
              thickness={0.035}
              material={<DarkSteel />}
            />

            <Beam
              start={[0.22, 0.50, 0]}
              end={[0.22, poleHeight - 0.20, 0]}
              thickness={0.035}
              material={<DarkSteel />}
            />

            {Array.from({ length: 20 }).map((_, index) => (
              <Beam
                key={`ladder-rung-${index}`}
                start={[
                  -0.22,
                  0.62 + index * 0.32,
                  0,
                ]}
                end={[
                  0.22,
                  0.62 + index * 0.32,
                  0,
                ]}
                thickness={0.027}
                material={<DarkSteel />}
              />
            ))}
          </group>

          {/* Eight light housings */}
          {Array.from({ length: 8 }).map((_, index) => {
            const x =
              -billboardWidth * 0.42 +
              (billboardWidth * 0.84 * index) / 7;

            return (
              <group
                key={`lamp-${index}`}
                position={[
                  x,
                  billboardBottom - 0.24,
                  frontZ + 0.26,
                ]}
                rotation={[-0.22, 0, 0]}
              >
                <mesh castShadow>
                  <boxGeometry args={[0.29, 0.16, 0.20]} />
                  <DarkSteel />
                </mesh>

                <BlinkingLamp phase={index * 0.22} />
              </group>
            );
          })}
        </>
      )}
    </group>
  );
}

type MainAutoRotatingUnipoleProps = {
  position: Vec3;
  scale: number;
};

export function MainAutoRotatingUnipole({
  position,
  scale,
}: MainAutoRotatingUnipoleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const draggingRef = useRef(false);
  const previousXRef = useRef(0);
  const previousYRef = useRef(0);
  const targetRotationXRef = useRef(0);
  const targetRotationYRef = useRef(-0.26);

  useFrame((state, delta) => {
    const group = groupRef.current;

    if (!group) return;

    if (!draggingRef.current) {
      targetRotationYRef.current += delta * 0.12;
    }

    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      targetRotationYRef.current,
      8,
      delta,
    );

    group.rotation.x = THREE.MathUtils.damp(
      group.rotation.x,
      targetRotationXRef.current,
      8,
      delta,
    );

    group.position.y =
      position[1] +
      Math.sin(state.clock.elapsedTime * 0.55) * 0.012;
  });

  const handlePointerDown = (
    event: ThreeEvent<PointerEvent>,
  ) => {
    event.stopPropagation();

    draggingRef.current = true;
    previousXRef.current = event.clientX;
    previousYRef.current = event.clientY;

    const target = event.target as Element;
    target.setPointerCapture?.(event.pointerId);

    document.body.style.cursor = "grabbing";
  };

  const handlePointerMove = (
    event: ThreeEvent<PointerEvent>,
  ) => {
    if (!draggingRef.current) return;

    event.stopPropagation();

    const movementX = event.clientX - previousXRef.current;
    const movementY = event.clientY - previousYRef.current;

    previousXRef.current = event.clientX;
    previousYRef.current = event.clientY;

    targetRotationYRef.current += movementX * 0.007;
    targetRotationXRef.current = THREE.MathUtils.clamp(
      targetRotationXRef.current + movementY * 0.003,
      -0.16,
      0.16,
    );
  };

  const stopDragging = (
    event: ThreeEvent<PointerEvent>,
  ) => {
    event.stopPropagation();
    draggingRef.current = false;

    const target = event.target as Element;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture?.(event.pointerId);
    }

    document.body.style.cursor = "grab";
  };

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      rotation={[0, -0.26, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        if (!draggingRef.current) {
          document.body.style.cursor = "default";
        }
      }}
    >
      <DetailedUnipole />
    </group>
  );
}

type StaticBackgroundUnipoleProps = {
  position: Vec3;
  rotation: Vec3;
  scale: number;
};

export function StaticBackgroundUnipole({
  position,
  rotation,
  scale,
}: StaticBackgroundUnipoleProps) {
  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <DetailedUnipole
        background
        simplified
      />
    </group>
  );
}