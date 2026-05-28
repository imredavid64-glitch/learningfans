"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
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
    <div className="mx-auto max-w-lg space-y-4 py-12">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        {error.message ||
          "The app could not load this page. If you just signed up, run the database migration in Supabase first."}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <a
          href="/app"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-sm"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
