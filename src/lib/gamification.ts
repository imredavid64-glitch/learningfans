export function xpToLevel(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / 100);
}

export function levelProgress(xp: number): { current: number; next: number; pct: number } {
  const current = xp % 100;
  const next = 100;
  return { current, next, pct: Math.round((current / next) * 100) };
}
