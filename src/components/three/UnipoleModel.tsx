"use client";

import { useRef, forwardRef, type ForwardedRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface UnipoleModelProps {
  /** Assembly progress ref (0..1) */
  progressRef: React.MutableRefObject<number>;
  /** Rotation ref for completed model (radians, y-axis) */
  rotationRef?: React.MutableRefObject<{ x: number; y: number }>;
  reducedMotion?: boolean;
}

function stageOffset(t: number) {
  // Ease: components separated at t=0, assembled at t=1
  return (1 - t);
}

export const UnipoleModel = forwardRef(function UnipoleModel(
  { progressRef, rotationRef, reducedMotion }: UnipoleModelProps,
  fwd: ForwardedRef<THREE.Group>,
) {
  const rootRef = useRef<THREE.Group | null>(null);
  const foundationRef = useRef<THREE.Group | null>(null);
  const poleRef = useRef<THREE.Group | null>(null);
  const supportRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<THREE.Group | null>(null);
  const panelRef = useRef<THREE.Group | null>(null);
  const lightingRef = useRef<THREE.Group | null>(null);
  const surfaceRef = useRef<THREE.Group | null>(null);

  useFrame(() => {
    const t = reducedMotion ? 1 : THREE.MathUtils.clamp(progressRef.current, 0, 1);
    const s = stageOffset(t);
    // Each part moves in from its own offset toward zero
    if (foundationRef.current) foundationRef.current.position.y = -s * 2.5;
    if (poleRef.current) poleRef.current.position.y = s * 3;
    if (supportRef.current) { supportRef.current.position.x = -s * 4; supportRef.current.position.y = s * 1; }
    if (frameRef.current) { frameRef.current.position.x = s * 4; frameRef.current.position.y = s * 1.2; }
    if (panelRef.current) { panelRef.current.position.z = -s * 3; panelRef.current.position.y = s * 0.5; }
    if (lightingRef.current) { lightingRef.current.position.y = s * 4; }
    if (surfaceRef.current) { surfaceRef.current.position.z = s * 3; }

    // Rotate whole model when assembled & rotation ref provided
    if (rootRef.current && rotationRef && t > 0.98) {
      rootRef.current.rotation.y = rotationRef.current.y;
      rootRef.current.rotation.x = THREE.MathUtils.clamp(rotationRef.current.x, -0.3, 0.3);
    } else if (rootRef.current && (!rotationRef || t < 0.98)) {
      // ease back to neutral while assembling
      rootRef.current.rotation.y *= 0.9;
      rootRef.current.rotation.x *= 0.9;
    }
  });

  return (
    <group ref={(g: THREE.Group | null) => { rootRef.current = g; if (typeof fwd === "function") fwd(g); else if (fwd) (fwd as React.MutableRefObject<THREE.Group | null>).current = g; }}>
      {/* Foundation */}
      <group ref={foundationRef} position={[0, 0, 0]}>
        <mesh position={[0, -0.05, 0]} receiveShadow>
          <boxGeometry args={[1.6, 0.2, 1.6]} />
          <meshStandardMaterial color="#8b8680" roughness={0.9} />
        </mesh>
      </group>
      {/* Pole */}
      <group ref={poleRef} position={[0, 2, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.22, 4, 24]} />
          <meshStandardMaterial color="#dcdcd6" metalness={0.35} roughness={0.55} />
        </mesh>
      </group>
      {/* Support bracket */}
      <group ref={supportRef} position={[0, 4.05, 0]}>
        <mesh>
          <boxGeometry args={[0.7, 0.15, 0.3]} />
          <meshStandardMaterial color="#cdcbc4" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
      {/* Display frame */}
      <group ref={frameRef} position={[0, 4.4, 0]}>
        <mesh>
          <boxGeometry args={[3.2, 1.6, 0.08]} />
          <meshStandardMaterial color="#3a3a38" roughness={0.7} />
        </mesh>
      </group>
      {/* Advertising panel */}
      <group ref={panelRef} position={[0, 4.4, 0.06]}>
        <mesh>
          <boxGeometry args={[3.05, 1.45, 0.04]} />
          <meshStandardMaterial color="#fafaf8" roughness={0.85} />
        </mesh>
      </group>
      {/* Lighting */}
      <group ref={lightingRef} position={[0, 5.35, 0.15]}>
        <mesh position={[-1, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.7, 12]} />
          <meshStandardMaterial color="#cfcdc6" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[1, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.7, 12]} />
          <meshStandardMaterial color="#cfcdc6" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
      {/* Campaign surface (branded overlay) */}
      <group ref={surfaceRef} position={[0, 4.4, 0.09]}>
        <mesh>
          <planeGeometry args={[2.9, 1.35]} />
          <meshStandardMaterial color="#D71920" roughness={0.6} />
        </mesh>
      </group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.16, 0]} receiveShadow>
        <circleGeometry args={[6, 48]} />
        <meshStandardMaterial color="#f0efe9" roughness={1} />
      </mesh>
    </group>
  );
});