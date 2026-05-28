import Link from "next/link";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DatabaseSetup() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center py-12">
      <Card>
        <CardHeader>
          <CardTitle>Database setup required</CardTitle>
          <CardDescription>
            You are signed in, but the LearningFans tables are not in your Supabase
            project yet. This is why the app looked blank after login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              Open the{" "}
              <a
                href="https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Supabase SQL Editor
              </a>
            </li>
            <li>
              Paste the full migration from{" "}
              <code className="rounded bg-muted px-1">
                supabase/migrations/20260520100000_initial_schema.sql
              </code>
            </li>
            <li>Click Run, then refresh this page</li>
          </ol>
          <p className="text-muted-foreground">
            Also add{" "}
            <code className="rounded bg-muted px-1">
              http://localhost:3000/auth/callback
            </code>{" "}
            under Authentication → URL Configuration → Redirect URLs.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href="https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
            >
              Open SQL Editor
            </a>
            <ButtonLink href="/app" variant="outline">
              Refresh after migration
            </ButtonLink>
            <form action={signOut}>
              <Button type="submit" variant="ghost">
                Sign out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
