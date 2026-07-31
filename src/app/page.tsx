import Link from "next/link";
import { BookOpen, Calendar, MessageSquare, Shield, Lock, Bell, Users, Clock, Monitor, Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-bold text-lg">
            <BookOpen className="h-6 w-6 text-primary" />
            LearningFans
          </div>
          <div className="flex items-center gap-3">
            <ButtonLink href="/download" variant="ghost">Download</ButtonLink>
            <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
            <ButtonLink href="/signup">Get started</ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Study together, <span className="text-primary">safely</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Create class communities, manage assignments, discuss topics in real-time, and stay on schedule —
            all in a moderated, AI-protected environment built for students.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <ButtonLink href="/signup" size="lg" className="px-8">
              Create free account
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="outline">
              Sign in
            </ButtonLink>
          </div>
        </section>

        <section className="border-t border-border bg-card/40 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center text-2xl font-bold">Everything you need</h2>
            <p className="mt-2 text-center text-muted-foreground">Tools designed for student success</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: MessageSquare, title: "Discussions", desc: "Threaded conversations with real-time updates and AI content moderation." },
                { icon: Users, title: "Study Spaces", desc: "Create or join classes with optional password protection. Keep your group private." },
                { icon: Calendar, title: "Schedule", desc: "Shared class calendar with events, RSVPs, and deadline tracking." },
                { icon: BookOpen, title: "Study Materials", desc: "Upload files, share links, create notes and flashcards with priority ranking." },
                { icon: Bell, title: "Meeting Calls", desc: "Schedule study sessions with AI-powered reminder notifications." },
                { icon: Clock, title: "Time Tracker", desc: "Built-in timer to help you manage how long you spend studying." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
                  <Icon className="mb-3 h-8 w-8 text-primary" />
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border py-20">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <Lock className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-4 text-2xl font-bold">Safety first</h2>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Every message is checked by AI for profanity, hate speech, spam, and inappropriate content.
              Moderators have full tools to manage spaces. Your study environment stays respectful and productive.
            </p>
            <div className="mt-8 flex justify-center gap-8 text-sm">
              {["AI Content Moderation", "User Reports", "Sanction System", "Password Protection"].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/40 py-20">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <Monitor className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-4 text-2xl font-bold">Take it with you</h2>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Get the LearningFans app on your phone or desktop — iOS, Android, macOS, Windows, and Linux.
              Your study community stays one tap away.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <ButtonLink href="/download" size="lg" className="px-8">
                <Download className="h-4 w-4 mr-1" />
                Download the app
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <span>Built for students.</span>
          <div className="flex gap-4">
            <Link href="/download" className="hover:text-foreground transition-colors">Download</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
