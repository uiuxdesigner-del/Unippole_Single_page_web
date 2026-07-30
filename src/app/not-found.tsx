import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-adinn-warm px-5 py-16 text-adinn-ink">
      <div className="max-w-xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-adinn-red">404</p>
        <h1 className="mt-4 text-h1">This page is not available.</h1>
        <p className="mt-5 text-base leading-7 text-adinn-ink-2">
          The link may be outdated. Return to the ADINN UNIPOLE experience to explore locations
          and plan your campaign.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-adinn-red px-5 text-sm font-medium text-white transition-colors hover:bg-adinn-red-hover"
        >
          Return to homepage
        </Link>
      </div>
    </main>
  );
}
