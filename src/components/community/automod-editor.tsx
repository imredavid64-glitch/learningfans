"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveAutomodRules } from "@/actions/community";
import {
  MAX_AUTOMOD_RULES,
  MAX_RULE_NAME,
  MAX_RULE_KEYWORDS,
  type AutomodAction,
  type AutomodRule,
  type AutomodScope,
} from "@/lib/automod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Plus, Trash2 } from "lucide-react";

export function AutomodEditor({
  spaceId,
  initialRules,
}: {
  spaceId: string;
  initialRules: AutomodRule[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState<AutomodRule[]>(initialRules);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newScope, setNewScope] = useState<AutomodScope>("all");
  const [newAction, setNewAction] = useState<AutomodAction>("flag");

  async function handleSave() {
    setSaving(true);
    const res = await saveAutomodRules(spaceId, rules);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't save the rules.");
      return;
    }
    toast.success("Automod rules saved.");
    router.refresh();
  }

  function addRule() {
    const name = newName.trim();
    const keywords = newKeywords.trim();
    if (!name || !keywords) return;
    setRules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, keywords, scope: newScope, action: newAction },
    ]);
    setNewName("");
    setNewKeywords("");
  }

  function updateRule(id: string, patch: Partial<AutomodRule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Keyword rules applied when someone posts. <strong>Remove</strong> blocks
        the post outright; <strong>flag</strong> hides it and logs it to the mod
        log. Keywords are comma-separated, case-insensitive matches.
      </p>

      {rules.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No automod rules yet — add keywords like{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">free vip, referral code</code>.
        </p>
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={rule.name}
                maxLength={MAX_RULE_NAME}
                onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                className="h-8 flex-1 text-sm font-medium"
                placeholder="Rule name"
              />
              <select
                value={rule.scope}
                onChange={(e) => updateRule(rule.id, { scope: e.target.value as AutomodScope })}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                aria-label="Scope"
              >
                <option value="all">Threads + replies</option>
                <option value="thread">Threads only</option>
                <option value="post">Replies only</option>
              </select>
              <select
                value={rule.action}
                onChange={(e) => updateRule(rule.id, { action: e.target.value as AutomodAction })}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                aria-label="Action"
              >
                <option value="flag">Flag</option>
                <option value="remove">Remove</option>
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                title="Remove rule"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={rule.keywords}
              maxLength={MAX_RULE_KEYWORDS}
              onChange={(e) => updateRule(rule.id, { keywords: e.target.value })}
              className="h-8 text-sm"
              placeholder="Comma-separated keywords, e.g. free vip, earn money"
            />
          </div>
        ))}
      </div>

      {rules.length < MAX_AUTOMOD_RULES && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              maxLength={MAX_RULE_NAME}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 flex-1 text-sm"
              placeholder="Rule name, e.g. No spam links"
            />
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addRule}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <Input
            value={newKeywords}
            maxLength={MAX_RULE_KEYWORDS}
            onChange={(e) => setNewKeywords(e.target.value)}
            className="h-8 text-sm"
            placeholder="Keywords…"
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="new-scope" className="text-xs text-muted-foreground">
              Scope
            </Label>
            <select
              id="new-scope"
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as AutomodScope)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              <option value="all">Threads + replies</option>
              <option value="thread">Threads only</option>
              <option value="post">Replies only</option>
            </select>
            <Label htmlFor="new-action" className="text-xs text-muted-foreground">
              Action
            </Label>
            <select
              id="new-action"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value as AutomodAction)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              <option value="flag">Flag (hide + log)</option>
              <option value="remove">Remove (block)</option>
            </select>
          </div>
        </div>
      )}

      <Button size="sm" className="gap-1" onClick={handleSave} disabled={saving}>
        <Bot className="h-4 w-4" />
        {saving ? "Saving…" : "Save automod rules"}
      </Button>
    </div>
  );
}
