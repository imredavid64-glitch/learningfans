"use client";

import { useState } from "react";
import Link from "next/link";
import { askCommunityTutor, type TutorCitation } from "@/actions/community-tutor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, Send } from "lucide-react";

export function CommunityTutor({ spaceSlug }: { spaceSlug: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<TutorCitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitations([]);
    const res = await askCommunityTutor(spaceSlug, q);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setAnswer(res.answer ?? "");
    setCitations(res.citations ?? []);
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Community librarian</h3>
          <p className="text-xs text-muted-foreground">
            Answers from this community&apos;s notes, quizzes &amp; discussions
          </p>
        </div>
      </div>

      <form onSubmit={ask} className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this topic…"
          maxLength={500}
          disabled={loading}
          className="h-9"
        />
        <Button type="submit" size="icon" className="h-9 w-9" disabled={loading || !question.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {answer && (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{answer}</p>
          {citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c, i) => (
                <Link key={`${c.href}-${i}`} href={c.href}>
                  <Badge variant="outline" className="gap-1 transition-colors hover:bg-accent">
                    <span className="text-muted-foreground">{c.kind}</span> {c.title}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
