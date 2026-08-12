"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { hapticLight } from "@/lib/haptics";
import { dismissReminder, getMeetingReminders } from "@/actions/meetings";

const POLL_INTERVAL_MS = 60_000;

/**
 * Surfaces due meeting reminders as toasts. Reminders are created when a
 * meeting is scheduled (see scheduleReminders in src/actions/meetings.ts) and
 * become due at their scheduled_for time — this component is what actually
 * delivers them to the user.
 */
export function MeetingReminderNotifier() {
  const router = useRouter();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    async function check() {
      const reminders = await getMeetingReminders();
      if (!active) return;

      for (const r of reminders) {
        if (seen.current.has(r.id)) continue;
        seen.current.add(r.id);
        void hapticLight();

        toast(`⏰ ${r.meetingTitle}`, {
          description: r.text,
          action: {
            label: "View meeting",
            onClick: () => router.push(`/app/meetings/${r.meetingId}`),
          },
          cancel: {
            label: "Dismiss",
            onClick: () => {
              void dismissReminder(r.id);
            },
          },
          duration: 20_000,
        });
      }
    }

    void check();
    const interval = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
