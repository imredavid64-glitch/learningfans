import Link from "next/link";
import { BookOpen, Calendar, MessageSquare, Shield, Lock, Bell, Users, Clock, Monitor, Download, Zap, TrendingUp, Award } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";

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
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
            <Zap className="h-4 w-4" />
            <span>New: Creator-Fan Study Ecosystem</span>
            <Link href="/demo" className="ml-2">
              <Badge variant="secondary">Live Demo</Badge>
            </Link>
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Students drop traditional study apps because learning in isolation is boring.
            <br />
            <span className="text-primary">LearningFans combines creator dynamics with AI study feeds to drive 4x higher completion rates.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Join 1,240+ active learners in creator-led cohorts. Earn badges, maintain streaks, and access VIP study materials — all in a moderated, AI-protected environment.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <ButtonLink href="/signup" size="lg" className="px-8">
              Create free account
            </ButtonLink>
            <ButtonLink href="/demo" size="lg" variant="outline">
              <Zap className="h-4 w-4 mr-1" />
              Try the demo
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="ghost">
              Sign in
            </ButtonLink>
          </div>
          
          {/* Impact Metrics Bar */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-3xl mx-auto text-center">
            <div>
              <div className="text-3xl font-bold text-primary">4x</div>
              <div className="text-sm text-muted-foreground">Higher Completion</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">88%</div>
              <div className="text-sm text-muted-foreground">Quiz Completion Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">3.4h</div>
              <div className="text-sm text-muted-foreground">Weekly Engagement</div>
            </div>
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
                { icon: Zap, title: "AI Deck Generator", desc: "Upload notes → auto-generate flashcards. Gate VIP content for subscribers." },
                { icon: Award, title: "Gamified Learning", desc: "Streaks, badges, leaderboards, and creator loyalty rewards." },
                { icon: TrendingUp, title: "Creator Analytics", desc: "Track fan engagement, quiz completion, and revenue in real-time." },
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
              Escalating moderation: warnings → restrictions → automatic parent/principal notifications.
              Your study environment stays respectful and productive.
            </p>
            <div className="mt-8 flex justify-center gap-8 text-sm">
              {["AI Content Moderation", "Escalating Sanctions", "Parent/Principal Alerts", "Password Protection"].map((f) => (
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
