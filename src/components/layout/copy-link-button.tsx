"use client";

import React, { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CopyLinkButton({
  url,
  label = "Copy Link",
  variant = "outline",
  size = "sm",
}: {
  url?: string;
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "xs" | "icon";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const linkToCopy = url || window.location.href;
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (size === "icon") {
    return (
      <Button variant={variant} size="icon" onClick={handleCopy} title={label}>
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size === "xs" ? "sm" : size} onClick={handleCopy} className="gap-1.5 text-xs">
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-500" /> Copied!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> {label}
        </>
      )}
    </Button>
  );
}
