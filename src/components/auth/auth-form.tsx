import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export function AuthForm({
  mode,
  error,
  message,
}: {
  mode: "login" | "signup";
  error?: string;
  message?: string;
}) {
  return (
    <form action={mode === "login" ? "/api/login" : "/api/signup"} method="POST" className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {mode === "signup" && (
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" name="displayName" required />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
            className="pr-16"
          />
          {mode === "login" && (
            <Link
              href="/forgot-password"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary hover:underline"
            >
              Forgot?
            </Link>
          )}
        </div>
      </div>
      <Button type="submit" className="w-full">
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
