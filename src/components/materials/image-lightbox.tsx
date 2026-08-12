"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Click a trigger (thumbnail or full image) to open it fullscreen. Closes on
 * Escape, backdrop click, or the X button; locks body scroll while open.
 */
export function ImageLightbox({
  src,
  alt,
  title,
  triggerClassName,
  trigger,
}: {
  src: string;
  alt: string;
  title?: string;
  triggerClassName?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "block cursor-zoom-in"}
        aria-label={`View ${title ?? alt} fullscreen`}
      >
        {trigger ?? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="h-auto w-full" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title ?? alt}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          {title && (
            <p className="absolute bottom-4 left-1/2 max-w-[80%] -translate-x-1/2 truncate text-center text-sm text-white/80">
              {title}
            </p>
          )}
        </div>
      )}
    </>
  );
}
