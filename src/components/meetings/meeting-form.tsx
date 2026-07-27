"use client";

import { createMeeting } from "@/actions/meetings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function MeetingForm({ spaces }: { spaces: { id: string; name: string }[] }) {
  return (
    <form action={createMeeting} className="space-y-4">
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

      <Button type="submit" className="w-full">Schedule meeting</Button>
    </form>
  );
}
