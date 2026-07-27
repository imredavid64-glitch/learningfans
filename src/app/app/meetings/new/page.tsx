import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetingForm } from "@/components/meetings/meeting-form";

export default async function NewMeetingPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Schedule a meeting</CardTitle>
          <CardDescription>
            Create a video call or study session. AI reminders will be sent automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MeetingForm spaces={spaces || []} />
        </CardContent>
      </Card>
    </div>
  );
}
