"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/hooks/useAuth";
import { startCheckout, type PaidPlan } from "@/lib/billing";
import { cn } from "@/lib/utils";

const PLANS: { id: PaidPlan; name: string; price: string; blurb: string }[] = [
  { id: "individual", name: "Individual", price: "₹149", blurb: "150 scans/mo · 5 scanners · 30-day history" },
  { id: "two_person", name: "Two-person", price: "₹219", blurb: "2 users · 110 scans each · 30-day history" },
  { id: "family", name: "Family", price: "₹299", blurb: "4 users · 75 scans each · 30-day history" },
  { id: "pro", name: "Pro", price: "₹499", blurb: "Unlimited · all 7 scanners · 60-day history" },
];

const ORDER: Record<string, number> = { free: 0, individual: 1, two_person: 2, family: 3, pro: 4 };

/** Upgrade options (plans above the current one), wired to Razorpay checkout. */
export function PlanUpgrade() {
  const { profile, user, refreshProfile } = useAuth();
  const plan = profile?.plan ?? "free";
  const [busy, setBusy] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const upgrades = PLANS.filter((p) => ORDER[p.id] > (ORDER[plan] ?? 0));
  if (upgrades.length === 0) return null;

  const upgrade = (target: PaidPlan) => {
    setError(null);
    setSuccess(false);
    setBusy(target);
    void startCheckout(target, {
      name: profile?.name ?? undefined,
      email: user?.email ?? undefined,
      onSuccess: async () => {
        await refreshProfile();
        setSuccess(true);
        setBusy(null);
      },
      onError: (message) => {
        setError(message);
        setBusy(null);
      },
      onDismiss: () => setBusy(null),
    });
  };

  return (
    <div className="mt-4 space-y-3">
      {success && <Alert tone="success">You&apos;re upgraded - enjoy your new plan! 🎉</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-2 sm:grid-cols-2">
        {upgrades.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => upgrade(p.id)}
            disabled={busy !== null}
            className={cn(
              "flex items-start justify-between gap-3 rounded-2xl border border-border bg-background/40 p-4 text-left transition hover:border-primary/40 disabled:opacity-50",
              busy === p.id && "border-primary/50",
            )}
          >
            <div>
              <div className="font-display text-base font-semibold">
                {p.name} <span className="text-muted-foreground">· {p.price}/mo</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.blurb}</p>
            </div>
            {busy === p.id ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : success && p.id === plan ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            )}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Upgrade anytime.</p>
    </div>
  );
}
