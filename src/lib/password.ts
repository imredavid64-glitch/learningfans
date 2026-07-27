import { createHash, randomBytes } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(salt + password)
    .digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = createHash("sha256")
    .update(salt + password)
    .digest("hex");
  return computed === hash;
}

export function validatePassword(password: string): string | null {
  if (password.length < 4) return "Password must be at least 4 characters";
  if (password.length > 100) return "Password too long";
  return null;
}
