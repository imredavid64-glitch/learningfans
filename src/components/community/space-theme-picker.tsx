"use client";

import React, { useState } from "react";
import { Palette, Check } from "lucide-react";
import { toast } from "sonner";

const SPACE_THEMES = [
  { id: "default", label: "Default Indigo", bg: "bg-indigo-600" },
  { id: "emerald", label: "Emerald Study", bg: "bg-emerald-600" },
  { id: "amber", label: "Amber Focus", bg: "bg-amber-600" },
  { id: "violet", label: "Violet Night", bg: "bg-violet-600" },
  { id: "rose", label: "Rose Collab", bg: "bg-rose-600" },
];

export function SpaceThemePicker({
  currentTheme = "default",
}: {
  spaceId?: string;
  currentTheme?: string;
}) {
  const [selected, setSelected] = useState(currentTheme);

  const handleSelect = (themeId: string) => {
    setSelected(themeId);
    toast.success(`Space theme updated to ${themeId}`);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">Community Accent Theme</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Choose a custom color theme for this space to match your community&apos;s vibe.
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        {SPACE_THEMES.map((t) => {
          const isSelected = selected === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                isSelected
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border hover:bg-accent text-muted-foreground",
              )}
            >
              <span className={cn("h-3 w-3 rounded-full", t.bg)} />
              {t.label}
              {isSelected && <Check className="h-3 w-3 ml-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
