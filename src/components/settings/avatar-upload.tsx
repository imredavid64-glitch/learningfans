"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadAvatar, removeAvatar } from "@/actions/profile";
import { Button } from "@/components/ui/button";

export function AvatarUpload({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar must be under 2 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setBusy("upload");
    const formData = new FormData();
    formData.set("avatar", file);
    await uploadAvatar(formData);
    setBusy(null);
    toast.success("Avatar updated");
  }

  async function handleRemove() {
    setBusy("remove");
    await removeAvatar();
    setBusy(null);
    toast.success("Avatar removed");
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 overflow-hidden rounded-full bg-primary/10 ring-1 ring-border">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={128}
            height={128}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "upload" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {avatarUrl ? "Change photo" : "Upload photo"}
        </Button>
        {avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive"
            disabled={busy !== null}
            onClick={() => void handleRemove()}
          >
            {busy === "remove" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
