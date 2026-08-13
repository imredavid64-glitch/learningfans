"use client";

import { useActionState, useEffect } from "react";
import { createStudyRoom, type ActionResult } from "@/actions/study-rooms";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function StudyRoomForm({
  spaces,
  defaultSpaceId,
}: {
  spaces: { id: string; name: string }[];
  defaultSpaceId?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => createStudyRoom(_prev, formData),
    null,
  );

  useEffect(() => {
    if (state?.redirect) {
      window.location.href = state.redirect;
    }
  }, [state?.redirect]);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Room name</Label>
        <Input id="name" name="name" required placeholder="e.g. Calculus final cram" maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">What are you studying? (optional)</Label>
        <Textarea id="description" name="description" rows={2} maxLength={500} placeholder="Topic, goal, or what to bring…" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startsAt">Start time (optional — schedule a study party)</Label>
        <Input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          placeholder="Leave blank to start now"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to start now, or pick a future time so people can RSVP and join when it starts.
        </p>
      </div>
      {spaces.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="spaceId">Link to a space (optional)</Label>
          <select
            id="spaceId"
            name="spaceId"
            defaultValue={defaultSpaceId ?? ""}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Open room — anyone can join</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create study room"}
      </Button>
    </form>
  );
}
