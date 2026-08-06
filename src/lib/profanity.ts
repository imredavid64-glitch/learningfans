const PROFANITY_LIST = [
  "fuck", "shit", "ass", "bitch", "damn", "crap", "dick", "bastard",
  "piss", "slut", "whore", "cunt", "douche", "wank", "prick", "cock",
  "motherfucker", "asshole", "dumbass", "jackass", "goddamn",
  "nigga", "nigger", "faggot", "dyke", "retard", "spic", "chink",
  "gook", "kike", "raghead", "towelhead", "tranny", "heeb",
];

const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "2": "z", "3": "e", "4": "a",
  "5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
  "@": "a", "$": "s", "!": "i", "+": "t",
};

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .split("")
    .map((c) => LEET_MAP[c] || c)
    .join("")
    .replace(/[^a-z]/g, "")
    .trim();
}

// Common safe inflections to catch ("shitting", "bitches", "asshole(s)") without
// false-positive substring hits like "ass" inside "class"/"assignment"/"pass".
const SUFFIXES = ["ing", "ed", "er", "s", "es"];

function matchesWord(profane: string, normalized: string): boolean {
  if (normalized === profane) return true;

  // Only allow inflections for words long enough that a suffix can't
  // accidentally form a shorter profanity (e.g. never "ass" via "class").
  if (profane.length < 4) return false;

  for (const suffix of SUFFIXES) {
    if (normalized === profane + suffix) return true;
    if (normalized === profane + suffix + suffix) return true;

    // Handle doubled final consonant ("shitting" -> "shit"+ing, "runner" -> "run"+er)
    const stem = normalized.endsWith(suffix)
      ? normalized.slice(0, -suffix.length)
      : "";
    if (stem.length === profane.length + 1 && stem.slice(0, -1) === profane && stem.endsWith(stem.slice(-2, -1))) {
      return true;
    }
  }
  return false;
}

export function containsProfanity(text: string): { clean: boolean; words: string[] } {
  const words = text.toLowerCase().split(/[\s.,!?;:()"']+/);
  const found: string[] = [];

  for (const raw of words) {
    const normalized = normalizeWord(raw);
    if (normalized.length < 2) continue;

    for (const profane of PROFANITY_LIST) {
      if (matchesWord(profane, normalized)) {
        found.push(profane);
        break;
      }
    }
  }

  return { clean: found.length === 0, words: [...new Set(found)] };
}

export function containsSpam(text: string): { isSpam: boolean; reason: string | null } {
  const excessiveCaps = (text.match(/[A-Z]/g)?.length || 0) > text.length * 0.7 && text.length > 20;
  if (excessiveCaps) return { isSpam: true, reason: "Excessive capitalization" };

  const repeatedChars = text.match(/(.)\1{4,}/g);
  if (repeatedChars) return { isSpam: true, reason: "Repeated characters" };

  const urlCount = (text.match(/https?:\/\/[^\s]+/g) || []).length;
  if (urlCount > 3) return { isSpam: true, reason: "Too many URLs" };

  const repeatedPhrases = text.match(/(.{10,})\1{2,}/g);
  if (repeatedPhrases) return { isSpam: true, reason: "Repeated phrases" };

  return { isSpam: false, reason: null };
}
