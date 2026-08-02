"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "done">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) {
          setStatus("ready");
        } else if (window.location.hash.includes("type=recovery")) {
          setError("Could not validate your reset link. Please request a new one.");
        } else {
          router.replace("/forgot-password?error=Please%20request%20a%20reset%20link");
        }
      })
      .catch(() => {
        setError("Something went wrong. Please request a new reset link.");
      });
  }, [router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }

      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setStatus("done");
    },
    [password, confirm],
  );

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-bold text-lg">
        <BookOpen className="h-6 w-6 text-primary" />
        LearningFans
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Enter a new password for your account. You&apos;ll be able to sign in with it right away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Set new password
              </Button>
            </form>
          )}

          {status === "done" && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Your password was updated. You can sign in with your new password.
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Go to sign in
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}