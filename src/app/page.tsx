import Link from "next/link";
import { BookOpen, Calendar, MessageSquare, Shield } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-6 w-6" />
            LearningFans
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/login" variant="ghost">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup">Get started</ButtonLink>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Study together, safely
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Join study spaces, share materials, prioritize what matters, and keep
            your schedule — all in a moderated environment built for students.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <ButtonLink href="/signup" size="lg">
              Create free account
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="outline">
              Sign in
            </ButtonLink>
          </div>
        </section>
        <section className="border-t border-border bg-card/30 py-16">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: MessageSquare,
                title: "Discuss",
                desc: "Threads and realtime replies in study spaces.",
              },
              {
                icon: BookOpen,
                title: "Share tools",
                desc: "Files, links, notes, and flashcards with quotas.",
              },
              {
                icon: Calendar,
                title: "Schedule",
                desc: "Personal planner plus shared group events.",
              },
              {
                icon: Shield,
                title: "Stay safe",
                desc: "Reports, mod queue, and sanctions for bad actors.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-6">
                <Icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        LearningFans — built for the Supabase free tier
      </footer>
    </div>
  );
}
