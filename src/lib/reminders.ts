const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

interface MeetingInfo {
  title: string;
  description: string | null;
  startsAt: string;
  callUrl: string | null;
  organizerName: string;
  participantCount: number;
}

interface ReminderResult {
  text: string;
  scheduledFor: Date;
}

export async function generateReminder(meeting: MeetingInfo, hoursUntil: number): Promise<ReminderResult> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that writes friendly, concise meeting reminders for students.
            Return ONLY a JSON object with:
            - "text": a short reminder message (1-2 sentences, warm tone, include the meeting title and time relative to now)
            
            Rules:
            - Keep it under 120 characters
            - Don't use emojis
            - Sound natural and helpful
            - Include the meeting title`,
          },
          {
            role: "user",
            content: JSON.stringify({
              title: meeting.title,
              description: meeting.description,
              startsAt: meeting.startsAt,
              hoursUntil,
              organizerName: meeting.organizerName,
              participantCount: meeting.participantCount,
            }),
          },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const contentText = data.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(contentText);
      if (parsed.text) {
        const scheduledFor = new Date(new Date(meeting.startsAt).getTime() - hoursUntil * 60 * 60 * 1000);
        return { text: parsed.text.slice(0, 200), scheduledFor };
      }
    } catch {}
  } catch {}

  const meetingTime = new Date(meeting.startsAt);
  const timeStr = meetingTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const fallback = `Reminder: "${meeting.title}" starts at ${timeStr}. ${meeting.callUrl ? "Join via " + meeting.callUrl : ""}`;

  const scheduledFor = new Date(meetingTime.getTime() - hoursUntil * 60 * 60 * 1000);
  return { text: fallback, scheduledFor };
}

export function getReminderSchedule(startsAt: string, _durationMinutes: number): number[] {
  const now = new Date();
  const start = new Date(startsAt);
  const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

  const reminders: number[] = [];

  if (hoursUntil > 24) {
    reminders.push(24);
  }
  if (hoursUntil > 2) {
    reminders.push(1);
  }
  reminders.push(0.083);

  return reminders.filter((h) => h <= hoursUntil);
}
