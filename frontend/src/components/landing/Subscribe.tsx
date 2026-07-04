"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { subscribe } from "@/lib/subscribe";

/** Email capture for product updates. Posts to the app_subscribe RPC. */
export function Subscribe() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setState("busy");
    try {
      await subscribe(email.trim());
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-primary">
        <Check className="h-4 w-4" /> You are on the list. We will email you when there is news.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email for product updates"
          className="w-full rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary/50"
        />
        <button
          type="submit"
          disabled={state === "busy" || !email.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {state === "busy" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Notify me <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
