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

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-bold text-lg">
        <BookOpen className="h-6 w-6 text-primary" />
        LearningFans
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Free for students. Join a study space or create your own.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="signup" error={error} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground">
        By creating an account, you agree to our community guidelines.
        All content is AI-moderated to ensure a safe learning environment.
      </p>
    </div>
  );
}
