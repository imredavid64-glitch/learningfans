"use client";

import { useState } from "react";
import { createThread } from "@/actions/discussion";
import type { CommunityFlair } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function NewThreadForm({
  spaceId,
  flairs = [],
}: {
  spaceId: string;
  flairs?: CommunityFlair[];
}) {
  const [kind, setKind] = useState<"discussion" | "question">("discussion");
  const [whatTried, setWhatTried] = useState("");

  const isQuestion = kind === "question";

  return (
    <form action={createThread.bind(null, spaceId)} className="space-y-4">
      <div className="flex gap-2">
        {(["discussion", "question"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              kind === k
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {k === "question" ? "🙋 Ask the community" : "💬 Discussion"}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />

      <div className="space-y-2">
        <Label htmlFor="title">{isQuestion ? "Question" : "Title"}</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder={isQuestion ? "e.g. How do I solve this integral?" : "Title"}
        />
      </div>

      {flairs.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="flair">Flair</Label>
          <select
            id="flair"
            name="flair"
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">No flair</option>
            {flairs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="body">{isQuestion ? "Details" : "First post"}</Label>
        <Textarea id="body" name="body" rows={4} required />
      </div>

      {isQuestion && (
        <div className="space-y-2">
          <Label htmlFor="what_tried">
            What have you tried? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="what_tried"
            name="what_tried"
            rows={3}
            required
            value={whatTried}
            onChange={(e) => setWhatTried(e.target.value)}
            placeholder="Show your work so the community can help where you're stuck."
          />
          <p className="text-xs text-muted-foreground">
            Questions that show effort get better answers.
          </p>
        </div>
      )}

      <Button type="submit">
        {isQuestion ? "Ask question" : "Create thread"}
      </Button>
    </form>
  );
}
