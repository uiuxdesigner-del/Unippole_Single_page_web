"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { UnipoleModel } from "@/components/three/UnipoleModel";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { MousePointer2 } from "lucide-react";

const stages = [
  "Foundation", "Pole", "Support", "Frame", "Display", "Lighting", "Campaign Surface", "Complete",
];

export function AssemblyScene() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  const rotationRef = useRef({ x: 0, y: 0 });
  const [displayProgress, setDisplayProgress] = useState(reduced ? 1 : 0);
  const [rotatable, setRotatable] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [interactionUsed, setInteractionUsed] = useState(false);

  useEffect(() => {
    if (reduced) { progressRef.current = 1; setDisplayProgress(1); setRotatable(true); return; }
    let raf = 0;
    const onScroll = () => {
      const el = sectionRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const scrolled = Math.min(total, Math.max(0, -rect.top));
      const p = total <= 0 ? 1 : scrolled / total;
      progressRef.current = p;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setDisplayProgress(p);
        setRotatable(p >= 0.98);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [reduced]);

  // Drag rotation on completed model
  useEffect(() => {
    if (!rotatable) return;
    let dragStart: { x: number; y: number } | null = null;
    let startRot = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      const target = e.currentTarget as HTMLElement;
      dragStart = { x: e.clientX, y: e.clientY };
      startRot = { ...rotationRef.current };
      target.setPointerCapture(e.pointerId);
      setDragging(true);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragStart) return;
      const dx = (e.clientX - dragStart.x) / 180;
      const dy = (e.clientY - dragStart.y) / 300;
      rotationRef.current = { x: Math.max(-0.3, Math.min(0.3, startRot.x + dy)), y: startRot.y + dx };
      if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04) setInteractionUsed(true);
    };
    const onUp = () => { dragStart = null; setDragging(false); };
    const canvas = document.getElementById("assembly-canvas");
    if (!canvas) return;
    canvas.addEventListener("pointerdown", onDown as EventListener);
    canvas.addEventListener("pointermove", onMove as EventListener);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown as EventListener);
      canvas.removeEventListener("pointermove", onMove as EventListener);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [rotatable]);

  // Reset rotation when scrolling back below completion
  useEffect(() => {
    if (!rotatable) rotationRef.current = { x: 0, y: 0 };
  }, [rotatable]);

  const activeStage = Math.min(stages.length - 1, Math.floor(displayProgress * stages.length));

  return (
    <section ref={sectionRef} className="relative bg-white" style={{ height: reduced ? "auto" : "300vh" }}>
      <div className="sticky top-0 min-h-screen flex items-center py-16">
        <div className="container-x grid gap-8 lg:grid-cols-[1fr_1.4fr] items-center w-full">
          <div className="order-2 lg:order-1">
            <span className="text-xs uppercase tracking-[0.25em] text-adinn-red font-medium">Scroll-driven assembly</span>
            <h2 className="mt-3 text-h2 text-adinn-ink">
              How a UNIPOLE takes shape.
            </h2>
            <p className="mt-4 text-adinn-ink-2 leading-relaxed max-w-md">
              Scroll to assemble the structure step by step. Scroll back to reverse it.
              When complete, drag the model to rotate it.
            </p>
            <ol className="mt-8 space-y-1.5">
              {stages.map((s, i) => {
                const on = i <= activeStage;
                return (
                  <li key={s} className={`flex items-center gap-4 py-1.5 text-sm transition-colors ${on ? "text-adinn-ink" : "text-adinn-muted"}`}>
                    <span className={`w-8 text-xs tracking-widest ${on ? "text-adinn-red" : "text-adinn-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1">{s}</span>
                    <span className={`h-px flex-1 ${on ? "bg-adinn-ink" : "bg-adinn-border"}`} />
                  </li>
                );
              })}
            </ol>
            {rotatable && !interactionUsed && (
              <div className="mt-6 inline-flex items-center gap-2 text-xs text-adinn-muted">
                <MousePointer2 size={14} strokeWidth={1.5} />
                <span>Drag to rotate</span>
              </div>
            )}
          </div>
          <div id="assembly-canvas" className={`order-1 lg:order-2 relative h-[380px] sm:h-[480px] lg:h-[560px] rounded-2xl overflow-hidden border border-adinn-border bg-adinn-warm ${rotatable ? "cursor-grab" : ""} ${dragging ? "cursor-grabbing" : ""}`} style={{ touchAction: "pan-y" }}>
            <Canvas dpr={[1, 1.5]} camera={{ position: [5, 3.5, 6.5], fov: 38 }} gl={{ antialias: true, alpha: true }}>
              <color attach="background" args={["#FAFAF8"]} />
              <ambientLight intensity={0.65} />
              <hemisphereLight args={["#ffffff", "#d8d4cc", 0.75]} />
              <directionalLight position={[6, 8, 4]} intensity={1.2} castShadow />
              <directionalLight position={[-5, 3, -4]} intensity={0.35} />
              <Suspense fallback={null}>
                <group position={[0, -2, 0]} scale={0.65}>
                  <UnipoleModel progressRef={progressRef} rotationRef={rotationRef} reducedMotion={reduced} />
                </group>
                <ContactShadows position={[0, -1.4, 0]} opacity={0.25} blur={2.5} scale={10} />
              </Suspense>
            </Canvas>
          </div>
        </div>
      </div>
    </section>
  );
}
