"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        We hit an unexpected error loading this page. You can try again or head
        back to the homepage.
      </p>
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-border/40 px-5 py-2 text-sm font-medium hover:bg-accent/5 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
