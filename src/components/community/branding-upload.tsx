"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadCommunityAsset, removeCommunityAsset, type BrandingKind } from "@/actions/community";
import { MAX_BRANDING_IMAGE_BYTES } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandingUpload({
  spaceId,
  kind,
  label,
  hint,
  currentUrl,
  aspectClass,
}: {
  spaceId: string;
  kind: BrandingKind;
  label: string;
  hint: string;
  currentUrl: string | null;
  aspectClass: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BRANDING_IMAGE_BYTES) {
      toast.error("Images are limited to 5 MB.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadCommunityAsset(spaceId, kind, fd);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Upload failed.");
      return;
    }
    toast.success(`${label} updated.`);
    router.refresh();
  }

  async function handleRemove() {
    setBusy(true);
    const res = await removeCommunityAsset(spaceId, kind);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't remove it.");
      return;
    }
    toast.success(`${label} removed.`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-muted",
          aspectClass,
        )}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No {kind} yet
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {busy ? "Uploading…" : currentUrl ? "Replace image" : "Upload image"}
        </Button>
        {currentUrl && (
          <Button size="sm" variant="ghost" onClick={handleRemove} disabled={busy}>
            Remove
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
