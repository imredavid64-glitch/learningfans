import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { DownloadPageClient } from "@/components/download/download-page-client";

export default function DownloadPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <BookOpen className="h-6 w-6 text-primary" />
            LearningFans
          </Link>
          <div className="flex items-center gap-3">
            <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
            <ButtonLink href="/signup">Get started</ButtonLink>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <DownloadPageClient />
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <span>Built for students.</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
