import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { onboardingProgress, type OnboardingItem } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export function OnboardingChecklist({ items }: { items: OnboardingItem[] }) {
  const progress = onboardingProgress(items);
  if (progress === 100) return null;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Get the most out of Learning Fans</h2>
          <p className="text-xs text-muted-foreground">{items.filter((i) => !i.done).length} steps to go</p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-primary">{progress}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ul className="grid gap-1 p-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                item.done
                  ? "text-muted-foreground hover:bg-accent"
                  : "hover:bg-accent",
              )}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn(item.done && "line-through decoration-muted-foreground/50")}>
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}