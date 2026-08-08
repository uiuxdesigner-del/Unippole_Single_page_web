"use client";

import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useState,
  type ReactNode,
} from "react";

import type { CTAUnipoleSceneProps } from "./CTAUnipoleScene";

const CTAUnipoleScene = dynamic<CTAUnipoleSceneProps>(
  () => import("./CTAUnipoleScene"),
  {
    ssr: false,
    loading: () => null,
  },
);

/*
 * If WebGL context creation or the 3D subtree throws (unsupported
 * browser, driver issue, etc.), this keeps the failure local instead of
 * crashing the rest of Inventory.
 */
class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function ProposalBanner3D({
  active = true,
}: {
  active?: boolean;
}) {
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] =
    useState(false);

  const handleReady = useCallback(() => {
    setHasRenderedFirstFrame(true);
  }, []);

  /* Force the frameloop active long enough to capture the very first
     frame regardless of scroll position — Inventory is typically still
     far below the viewport at mount time. Once that frame has rendered,
     control hands over to the caller's proximity-based `active` prop so
     rendering can pause while Inventory is far away and resume as it
     approaches. */
  const isSceneActive = hasRenderedFirstFrame ? active : true;

  return (
    <article className="relative min-h-[470px] overflow-hidden rounded-[10px] bg-[#020611] sm:col-span-2 lg:min-h-[500px] xl:col-span-2 2xl:col-span-3 2xl:min-h-[516px]">
      <SceneErrorBoundary>
        <CTAUnipoleScene active={isSceneActive} onReady={handleReady} />
      </SceneErrorBoundary>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[#06142b]/18 to-transparent"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-[10px] ring-1 ring-inset ring-white/10"
      />
    </article>
  );
}
