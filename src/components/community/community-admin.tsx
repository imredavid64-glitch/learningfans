"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  saveCommunityRules,
  saveCommunityFlairs,
  postAnnouncement,
  deleteAnnouncement,
} from "@/actions/community";
import {
  MAX_RULES,
  MAX_FLAIRS,
  MAX_FLAIR_LABEL,
  FLAIR_COLORS,
  FLAIR_SWATCH_CLASSES,
  type CommunityAnnouncement,
  type CommunityFlair,
  type CommunityRule,
  type FlairColorId,
} from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bookmark, Megaphone, Plus, Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CommunityAdmin({
  spaceId,
  initialRules,
  initialAnnouncements,
  initialFlairs,
}: {
  spaceId: string;
  initialRules: CommunityRule[];
  initialAnnouncements: CommunityAnnouncement[];
  initialFlairs: CommunityFlair[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState<CommunityRule[]>(initialRules);
  const [savingRules, setSavingRules] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleBody, setNewRuleBody] = useState("");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [flairs, setFlairs] = useState<CommunityFlair[]>(initialFlairs);
  const [savingFlairs, setSavingFlairs] = useState(false);
  const [newFlairLabel, setNewFlairLabel] = useState("");
  const [newFlairColor, setNewFlairColor] = useState<FlairColorId>("blue");

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

  async function handleSaveFlairs() {
    setSavingFlairs(true);
    const res = await saveCommunityFlairs(spaceId, flairs);
    setSavingFlairs(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't save flairs.");
      return;
    }
    toast.success("Post flairs saved.");
    router.refresh();
  }

  function addFlair() {
    const label = newFlairLabel.trim();
    if (!label) return;
    setFlairs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label, color: newFlairColor },
    ]);
    setNewFlairLabel("");
  }

  function updateFlair(id: string, patch: Partial<CommunityFlair>) {
    setFlairs((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  return (
    <div className="space-y-6">
      {/* Post flairs editor */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Tag className="h-4 w-4 text-primary" /> Post flairs
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Color-coded labels members can tag their posts with — like Homework
          help, Exam prep, or Resource.
        </p>
        {flairs.length === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">
            No flairs yet — add a few so members can label their posts.
          </p>
        )}
        <div className="space-y-2">
          {flairs.map((flair) => (
            <div key={flair.id} className="flex items-center gap-2">
              <Input
                value={flair.label}
                maxLength={MAX_FLAIR_LABEL}
                onChange={(e) => updateFlair(flair.id, { label: e.target.value })}
                className="h-8 flex-1 text-sm"
                placeholder="Flair label"
              />
              <div className="flex items-center gap-1">
                {FLAIR_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => updateFlair(flair.id, { color: c.id })}
                    title={c.label}
                    aria-label={`Set color to ${c.label}`}
                    className={cn(
                      "h-4 w-4 rounded-full transition-transform",
                      FLAIR_SWATCH_CLASSES[c.id],
                      flair.color === c.id
                        ? "ring-2 ring-ring ring-offset-1"
                        : "opacity-60 hover:opacity-100",
                    )}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => setFlairs((prev) => prev.filter((f) => f.id !== flair.id))}
                title="Remove flair"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {flairs.length < MAX_FLAIRS && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
            <Input
              value={newFlairLabel}
              maxLength={MAX_FLAIR_LABEL}
              onChange={(e) => setNewFlairLabel(e.target.value)}
              className="h-8 flex-1 min-w-40 text-sm"
              placeholder="New flair label, e.g. Homework help"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFlair();
                }
              }}
            />
            <div className="flex items-center gap-1">
              {FLAIR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNewFlairColor(c.id)}
                  title={c.label}
                  aria-label={`Choose ${c.label}`}
                  className={cn(
                    "h-5 w-5 rounded-full transition-transform",
                    FLAIR_SWATCH_CLASSES[c.id],
                    newFlairColor === c.id
                      ? "ring-2 ring-ring ring-offset-1"
                      : "opacity-60 hover:opacity-100",
                  )}
                />
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addFlair}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        )}
        <Button size="sm" className="mt-3" onClick={handleSaveFlairs} disabled={savingFlairs}>
          {savingFlairs ? "Saving…" : "Save flairs"}
        </Button>
      </div>

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
