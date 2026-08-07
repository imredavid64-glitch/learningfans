"use client";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/50 dark:bg-muted/80",
        className
      )}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse">
      <div className="h-4 w-3/4 rounded bg-muted/50 mb-2" />
      <div className="h-3 w-1/2 rounded bg-muted/50 mb-4" />
      <div className="h-8 w-24 rounded bg-muted/50" />
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm animate-pulse sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <div className="h-5 w-5 rounded bg-muted/50" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 rounded bg-muted/50" />
              <div className="h-3 w-32 rounded bg-muted/50" />
              <div className="h-3 w-24 rounded bg-muted/50" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded bg-muted/50" />
            <div className="h-6 w-16 rounded bg-muted/50" />
            <div className="h-6 w-16 rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FlashcardSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse">
        <div className="h-6 w-48 rounded bg-muted/50 mb-4" />
        <div className="flex gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-muted/50" />
          <div className="space-y-1.5">
            <div className="h-4 w-24 rounded bg-muted/50" />
            <div className="h-3 w-16 rounded bg-muted/50" />
          </div>
        </div>
        <div className="min-h-[180px] w-full rounded-lg border border-border bg-muted/30 p-6 animate-pulse" />
        <div className="flex justify-between gap-2 pt-4">
          <div className="h-9 w-20 rounded bg-muted/50" />
          <div className="h-9 w-20 rounded bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-muted/50" />
          <div className="h-8 w-8 rounded bg-muted/50" />
          <div className="h-8 w-8 rounded bg-muted/50" />
          <div className="h-6 w-48 rounded bg-muted/50" />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <div className="h-7 w-16 rounded bg-muted/50" />
          <div className="h-7 w-16 rounded bg-muted/50" />
          <div className="h-7 w-16 rounded bg-muted/50" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm animate-pulse min-h-[350px]">
        <div className="grid grid-cols-7 border-b bg-muted/50 p-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-muted/50" />
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[300px]">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="border-r border-b p-2 last:border-r-0 last:pb-0" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-8 max-w-3xl mx-auto">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="text-center">
          <div className="h-8 w-16 rounded bg-muted/50 mx-auto mb-2" />
          <div className="h-4 w-32 rounded bg-muted/50 mx-auto" />
        </div>
      ))}
    </div>
  );
}
