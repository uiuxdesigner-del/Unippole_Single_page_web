"use client";

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { UnipoleModel } from "./UnipoleModel";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function HeroScene() {
  const reduced = useReducedMotion();
  const progressRef = useRef(1);
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [4.5, 3.5, 6], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={["#FAFAF8"]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#ffffff", "#d8d4cc", 0.8]} />
      <directionalLight position={[6, 8, 4]} intensity={1.2} />
      <directionalLight position={[-5, 2, -3]} intensity={0.3} />
      <Suspense fallback={null}>
        <group position={[0, -2, 0]} scale={0.7}>
          <UnipoleModel progressRef={progressRef} reducedMotion={reduced} />
        </group>
        <ContactShadows position={[0, -1.4, 0]} opacity={0.25} blur={2.5} scale={10} />
      </Suspense>
    </Canvas>
  );
}