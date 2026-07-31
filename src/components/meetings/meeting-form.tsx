"use client";

import { useActionState, useEffect, useRef } from "react";
import { createMeeting, type ActionResult } from "@/actions/meetings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function MeetingForm({ spaces }: { spaces: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => createMeeting(_prev, formData), null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.redirect) {
      window.location.href = state.redirect;
    }
  }, [state?.redirect]);

  function handleStartNow() {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 16);
    if (formRef.current) {
      const fd = new FormData(formRef.current);
      fd.set("startsAt", fmt(now));
      fd.set("endsAt", fmt(later));
      fd.set("is_immediate", "true");
      formAction(fd);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</div>
      )}
      <div className="space-y-2">
        <Label htmlFor="title">Meeting title</Label>
        <Input id="title" name="title" required placeholder="e.g. Calculus study group" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} placeholder="Agenda, topics, prep materials..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Start</Label>
          <Input id="startsAt" name="startsAt" type="datetime-local" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">End</Label>
          <Input id="endsAt" name="endsAt" type="datetime-local" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="callUrl">Call link (optional)</Label>
        <Input id="callUrl" name="callUrl" type="url" placeholder="https://meet.google.com/..." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="spaceId">Class / Space (optional)</Label>
        <select
          id="spaceId"
          name="spaceId"
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Personal meeting</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="participantIds">Invite by user ID (comma-separated, optional)</Label>
        <Input id="participantIds" name="participantIds" placeholder="user-id-1, user-id-2" />
        <p className="text-xs text-muted-foreground">Leave blank to share the link manually.</p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Creating..." : "Schedule meeting"}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" disabled={pending} onClick={handleStartNow}>
          Start now
        </Button>
      </div>
    </form>
  );
}
