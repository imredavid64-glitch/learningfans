import { updateProfile } from "@/actions/profile";
import { getCurrentProfile } from "@/lib/auth";
import { USER_STORAGE_QUOTA_BYTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeLimitSetting } from "@/components/layout/time-limit-setting";
import { ButtonLink } from "@/components/ui/button-link";
import { PushNotificationSetting } from "@/components/settings/push-notification-setting";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { MAX_BIO_LENGTH, MAX_INTERESTS } from "@/lib/validation";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const usedMb = (profile!.storage_used_bytes / 1024 / 1024).toFixed(2);
  const quotaMb = USER_STORAGE_QUOTA_BYTES / 1024 / 1024;
  const pct = Math.min(
    100,
    Math.round((profile!.storage_used_bytes / USER_STORAGE_QUOTA_BYTES) * 100),
  );

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Profile and storage usage</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AvatarUpload
            avatarUrl={profile!.avatar_url}
            displayName={profile!.display_name}
          />
          <form action={updateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={profile!.display_name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="major">Major</Label>
              <Input
                id="major"
                name="major"
                placeholder="e.g. Computer Science"
                defaultValue={profile!.major ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interests">
                Interests (comma separated, up to {MAX_INTERESTS})
              </Label>
              <Input
                id="interests"
                name="interests"
                placeholder="e.g. math, flashcards, design"
                defaultValue={profile!.interests?.join(", ") ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                rows={3}
                placeholder="A short intro for your profile"
                maxLength={MAX_BIO_LENGTH}
                defaultValue={profile!.bio ?? ""}
              />
              <p className="text-right text-xs text-muted-foreground">
                {MAX_BIO_LENGTH} max
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Role: {profile!.role}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save</Button>
              <ButtonLink href={`/app/profile/${profile!.id}`} variant="outline">
                View my profile
              </ButtonLink>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>
            Free tier: {quotaMb} MB per user, 1 GB total project storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {usedMb} MB / {quotaMb} MB used ({pct}%)
          </p>
        </CardContent>
      </Card>

      <TimeLimitSetting />

      <Card>
        <CardHeader>
          <CardTitle>Offline</CardTitle>
          <CardDescription>
            Flashcard decks saved on this device stay reviewable without a connection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink href="/app/offline" variant="outline" size="sm">
            Manage offline decks
          </ButtonLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Get notified even when the app isn&apos;t open. Works on installed apps and modern browsers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushNotificationSetting />
        </CardContent>
      </Card>
    </div>
  );
}
