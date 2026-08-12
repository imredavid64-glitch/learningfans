"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  saveCommunityRules,
  postAnnouncement,
  deleteAnnouncement,
} from "@/actions/community";
import {
  MAX_RULES,
  type CommunityAnnouncement,
  type CommunityRule,
} from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bookmark, Megaphone, Plus, Trash2 } from "lucide-react";

export function CommunityAdmin({
  spaceId,
  initialRules,
  initialAnnouncements,
}: {
  spaceId: string;
  initialRules: CommunityRule[];
  initialAnnouncements: CommunityAnnouncement[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState<CommunityRule[]>(initialRules);
  const [savingRules, setSavingRules] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleBody, setNewRuleBody] = useState("");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function handleSaveRules() {
    setSavingRules(true);
    const res = await saveCommunityRules(spaceId, rules);
    setSavingRules(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't save rules.");
      return;
    }
    toast.success("Community rules saved.");
    router.refresh();
  }

  function addRule() {
    const title = newRuleTitle.trim();
    if (!title) return;
    setRules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title, body: newRuleBody.trim() || undefined },
    ]);
    setNewRuleTitle("");
    setNewRuleBody("");
  }

  function updateRule(id: string, patch: Partial<CommunityRule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handlePostAnnouncement() {
    const title = annTitle.trim();
    if (!title) return;
    setPosting(true);
    const res = await postAnnouncement(spaceId, title, annBody);
    setPosting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't post the announcement.");
      return;
    }
    toast.success("Announcement posted.");
    setAnnTitle("");
    setAnnBody("");
    router.refresh();
  }

  async function handleDeleteAnnouncement(id: string) {
    const res = await deleteAnnouncement(spaceId, id);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't delete the announcement.");
      return;
    }
    toast.success("Announcement deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Rules editor */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Bookmark className="h-4 w-4 text-primary" /> Community rules
        </h3>
        {rules.length === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">
            No rules yet — add the guidelines members should follow.
          </p>
        )}
        <ol className="space-y-3">
          {rules.map((rule, i) => (
            <li key={rule.id} className="space-y-1.5 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <Input
                  value={rule.title}
                  maxLength={140}
                  onChange={(e) => updateRule(rule.id, { title: e.target.value })}
                  className="h-8 flex-1 text-sm font-medium"
                  placeholder="Rule title"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  title="Remove rule"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={rule.body ?? ""}
                maxLength={500}
                onChange={(e) => updateRule(rule.id, { body: e.target.value })}
                rows={2}
                className="text-sm"
                placeholder="What does this rule mean? (optional)"
              />
            </li>
          ))}
        </ol>
        {rules.length < MAX_RULES && (
          <div className="mt-3 space-y-2 rounded-lg border border-dashed border-border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={newRuleTitle}
                maxLength={140}
                onChange={(e) => setNewRuleTitle(e.target.value)}
                className="h-8 flex-1 text-sm"
                placeholder="New rule title"
              />
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addRule}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <Input
              value={newRuleBody}
              maxLength={500}
              onChange={(e) => setNewRuleBody(e.target.value)}
              className="h-8 text-sm"
              placeholder="Short description (optional)"
            />
          </div>
        )}
        <Button
          size="sm"
          className="mt-3"
          onClick={handleSaveRules}
          disabled={savingRules}
        >
          {savingRules ? "Saving…" : "Save rules"}
        </Button>
      </div>

      {/* Announcement composer */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Megaphone className="h-4 w-4 text-primary" /> Post an announcement
        </h3>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={annTitle}
              maxLength={140}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="e.g. Midterm study session this Friday"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Message</Label>
            <Textarea
              id="ann-body"
              value={annBody}
              maxLength={2000}
              onChange={(e) => setAnnBody(e.target.value)}
              rows={3}
              placeholder="Details, links, or anything the community should know…"
            />
          </div>
          <Button size="sm" onClick={handlePostAnnouncement} disabled={posting || !annTitle.trim()}>
            {posting ? "Posting…" : "Post announcement"}
          </Button>
        </div>

        {initialAnnouncements.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current announcements
            </p>
            {initialAnnouncements.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.author_name} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => handleDeleteAnnouncement(a.id)}
                  title="Delete announcement"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
