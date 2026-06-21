"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { scorePassword } from "@/lib/password";

const BAR_TONE = ["bg-danger", "bg-danger", "bg-warning", "bg-success", "bg-success"];
const TEXT_TONE = [
  "text-danger",
  "text-danger",
  "text-warning",
  "text-success",
  "text-success",
];

/**
 * Real-time password strength meter + policy checklist for the signup form.
 */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, checks } = scorePassword(password);

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i < score ? BAR_TONE[score] : "bg-white/10",
              )}
            />
          ))}
        </div>
        <span className={cn("font-mono text-[11px]", TEXT_TONE[score])}>{label}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((c) => (
          <li
            key={c.label}
            className={cn(
              "flex items-center gap-1.5 text-[11px]",
              c.met ? "text-success" : "text-muted-foreground",
            )}
          >
            {c.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
