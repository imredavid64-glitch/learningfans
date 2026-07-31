import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { BookOpen } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-bold text-lg">
        <BookOpen className="h-6 w-6 text-primary" />
        LearningFans
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your LearningFans account</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="login" error={error !== "auth" ? error : undefined} message={message} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create one free
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
