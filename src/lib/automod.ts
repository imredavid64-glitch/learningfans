// Pure automod helpers: rule validation + keyword matching. Unit-tested,
// shared by the save action (validation) and thread/post creation (enforcement).

export const MAX_AUTOMOD_RULES = 25;
export const MAX_RULE_NAME = 60;
export const MAX_RULE_KEYWORDS = 500;

export type AutomodScope = "thread" | "post" | "all";
export type AutomodAction = "flag" | "remove";

export interface AutomodRule {
  id: string;
  name: string;
  /** Comma-separated keywords; case-insensitive substring match. */
  keywords: string;
  scope: AutomodScope;
  action: AutomodAction;
}

export type AutomodValidation =
  | { ok: true; rules: AutomodRule[] }
  | { ok: false; error: string };

const SCOPES: AutomodScope[] = ["thread", "post", "all"];
const ACTIONS: AutomodAction[] = ["flag", "remove"];

export function validateAutomodRules(raw: unknown): AutomodValidation {
  if (!Array.isArray(raw)) return { ok: false, error: "Rules must be a list." };
  if (raw.length > MAX_AUTOMOD_RULES) {
    return { ok: false, error: `Communities can have up to ${MAX_AUTOMOD_RULES} automod rules.` };
  }

  const rules: AutomodRule[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") return { ok: false, error: "Invalid rule." };
    const rec = r as Record<string, unknown>;

    const name = String(rec.name ?? "").trim();
    if (!name) return { ok: false, error: "Every rule needs a name." };
    if (name.length > MAX_RULE_NAME) {
      return { ok: false, error: `Rule names are limited to ${MAX_RULE_NAME} characters.` };
    }

    const keywords = String(rec.keywords ?? "").trim();
    if (!keywords) return { ok: false, error: "Every rule needs keywords." };
    if (keywords.length > MAX_RULE_KEYWORDS) {
      return { ok: false, error: `Keywords are limited to ${MAX_RULE_KEYWORDS} characters.` };
    }

    const scope = String(rec.scope ?? "");
    if (!SCOPES.includes(scope as AutomodScope)) {
      return { ok: false, error: "Invalid rule scope." };
    }
    const action = String(rec.action ?? "");
    if (!ACTIONS.includes(action as AutomodAction)) {
      return { ok: false, error: "Invalid rule action." };
    }

    const id = typeof rec.id === "string" && rec.id ? rec.id : crypto.randomUUID();
    if (seen.has(id)) return { ok: false, error: "Duplicate rule ids." };
    seen.add(id);

    rules.push({ id, name, keywords, scope: scope as AutomodScope, action: action as AutomodAction });
  }

  return { ok: true, rules };
}

/** Do any of the rule's comma-separated keywords appear (case-insensitive)? */
export function ruleMatchesKeywords(rule: AutomodRule, content: string): boolean {
  const haystack = content.toLowerCase();
  return rule.keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .some((keyword) => haystack.includes(keyword));
}

/**
 * Check content against the community's automod rules for a given scope.
 * Returns the first matching rule (enforcement decides flag vs remove).
 */
export function checkAutomod(
  rules: AutomodRule[],
  content: string,
  scope: AutomodScope,
): AutomodRule | null {
  for (const rule of rules) {
    if (rule.scope !== "all" && rule.scope !== scope) continue;
    if (ruleMatchesKeywords(rule, content)) return rule;
  }
  return null;
}
