"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-adinn-warm px-5 py-16 text-adinn-ink">
      <div className="max-w-xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-adinn-red">
          Something went wrong
        </p>
        <h1 className="mt-4 text-h1">The experience could not be loaded.</h1>
        <p className="mt-5 text-base leading-7 text-adinn-ink-2">
          Please try again. Your locally saved campaign plan remains in this browser.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-adinn-red px-5 text-sm font-medium text-white transition-colors hover:bg-adinn-red-hover"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
