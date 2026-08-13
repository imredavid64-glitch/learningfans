// Study-party reminder sweep. Finds parties starting within the reminder lead
// window and pings every RSVPed user who hasn't been reminded yet via the
// existing bell (`create_notification`, type `party_reminder` — the daily push
// cron then turns them into web pushes). `reminded_at` on the RSVP dedupes.
//
// Called by the cron routes as a safety net AND lazily from the hub/room pages
// so reminders still fire between daily cron runs. Best-effort — never throws.

import { createAdminClient } from "@/lib/supabase/admin";
import { PARTY_REMINDER_LEAD_MINUTES, partyReminderDue } from "@/lib/study-room-utils";

export async function sendPartyReminders(): Promise<{ reminded: number }> {
  try {
    const admin = createAdminClient();
    const now = Date.now();
    const leadMs = PARTY_REMINDER_LEAD_MINUTES * 60_000;

    // Parties that start within the next lead window (not yet past).
    const { data: parties } = await admin
      .from("study_rooms")
      .select("id, name, starts_at")
      .eq("status", "active")
      .not("starts_at", "is", null)
      .gt("starts_at", new Date(now).toISOString())
      .lt("starts_at", new Date(now + leadMs).toISOString())
      .limit(50);

    let reminded = 0;
    for (const party of parties ?? []) {
      if (!partyReminderDue(new Date(party.starts_at).getTime(), now)) continue;

      const { data: rsvps } = await admin
        .from("study_room_rsvps")
        .select("user_id")
        .eq("room_id", party.id)
        .is("reminded_at", null)
        .limit(100);

      for (const rsvp of rsvps ?? []) {
        await admin.rpc("create_notification", {
          p_user_id: rsvp.user_id,
          p_title: `${String(party.name).slice(0, 80)} starts soon`,
          p_body: "Your study party starts in a few minutes — hop in!",
          p_type: "party_reminder",
          p_link: `/app/study-rooms/${party.id}`,
        });
        await admin
          .from("study_room_rsvps")
          .update({ reminded_at: new Date().toISOString() })
          .eq("room_id", party.id)
          .eq("user_id", rsvp.user_id);
        reminded += 1;
      }
    }
    return { reminded };
  } catch {
    // Pre-migration or transient — reminders are best-effort.
    return { reminded: 0 };
  }
}
