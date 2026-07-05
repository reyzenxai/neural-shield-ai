"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, Loader2, Upload } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { getMyLatestPayment, makeReference, submitPaymentRequest } from "@/lib/payments";
import { getEffectivePlan, getIsLinkedMember } from "@/lib/members";
import { PLANS, PLAN_ORDER, type PlanId } from "@neural-shield/config";

const UPI_VPA = process.env.NEXT_PUBLIC_UPI_VPA ?? "";
const UPI_PAYEE = process.env.NEXT_PUBLIC_UPI_PAYEE ?? "Neural Shield AI";

const RANK: Record<string, number> = Object.fromEntries(PLAN_ORDER.map((p, i) => [p, i]));
const PAID = PLAN_ORDER.filter((p) => p !== "free");

function upiLink(amount: number, note: string): string {
  const params = new URLSearchParams({ pa: UPI_VPA, pn: UPI_PAYEE, am: String(amount), tn: note, cu: "INR" });
  return `upi://pay?${params.toString()}`;
}

/** UPI upgrade flow: pick a plan, pay by UPI, upload the screenshot for review. */
export function PlanUpgrade() {
  const { profile, refreshProfile } = useAuth();
  const plan = profile?.plan ?? "free";
  const queryClient = useQueryClient();

  const { data: latest } = useQuery({ queryKey: ["my-payment"], queryFn: getMyLatestPayment });
  const { data: isLinkedMember } = useQuery({ queryKey: ["is-linked-member"], queryFn: getIsLinkedMember });
  const { data: effectivePlan } = useQuery({ queryKey: ["effective-plan"], queryFn: getEffectivePlan });

  const [selected, setSelected] = useState<PlanId | null>(null);
  const [reference] = useState(makeReference);
  const [upiRef, setUpiRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show a pending banner while a submitted payment is awaiting review.
  if (latest?.status === "pending") {
    return (
      <div className="mt-4">
        <Alert tone="info">
          Your payment for the {latest.plan} plan is pending review. We will activate it shortly.
        </Alert>
      </div>
    );
  }

  // Linked members inherit a shared plan and are not eligible to upgrade themselves —
  // the plan owner must unlink them first (which returns them to Free).
  if (isLinkedMember) {
    const shared = (PLANS as Record<string, { name: string }>)[effectivePlan ?? "free"]?.name ?? "shared";
    return (
      <div className="mt-4">
        <Alert tone="info">
          You&apos;re on a shared {shared} plan. To change your own plan, ask the plan owner to
          unlink your account first — you&apos;ll return to Free and can then upgrade.
        </Alert>
      </div>
    );
  }

  const upgrades = PAID.filter((p) => RANK[p] > (RANK[plan] ?? 0));
  if (upgrades.length === 0) return null;

  const chosen = selected ? PLANS[selected] : null;

  const submit = async () => {
    if (!selected || !file || !upiRef.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await submitPaymentRequest({
        plan: selected,
        amountInr: PLANS[selected].priceInr,
        referenceNote: reference,
        upiReference: upiRef.trim(),
        file,
      });
      await queryClient.invalidateQueries({ queryKey: ["my-payment"] });
      await refreshProfile();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}

      {!selected ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {upgrades.map((id) => {
            const p = PLANS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background/40 p-4 text-left transition hover:border-primary/40"
              >
                <div className="font-display text-base font-semibold">
                  {p.name} <span className="text-muted-foreground">· ₹{p.priceInr}/mo</span>
                </div>
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-background/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-base font-semibold">
              Pay ₹{chosen!.priceInr} for {chosen!.name}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Change plan
            </button>
          </div>

          {!UPI_VPA ? (
            <Alert tone="warning">Payments are not configured yet (missing UPI ID).</Alert>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="UPI QR code"
                width={176}
                height={176}
                className="h-44 w-44 rounded-xl bg-white p-2"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(upiLink(chosen!.priceInr, reference))}`}
              />
              <div className="space-y-1.5 text-sm">
                <div>
                  UPI ID: <span className="font-mono">{UPI_VPA}</span>
                </div>
                <div>
                  Amount: <span className="font-semibold">₹{chosen!.priceInr}</span>
                </div>
                <div>
                  Add this note to your payment:{" "}
                  <span className="font-mono font-semibold text-primary">{reference}</span>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Scan the QR or pay to the UPI ID, then enter the reference and upload the screenshot below.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <Input
              value={upiRef}
              onChange={(e) => setUpiRef(e.target.value)}
              placeholder="UPI transaction / reference number"
              aria-label="UPI reference number"
            />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground hover:border-primary/40">
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{file ? file.name : "Upload payment screenshot"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={submit}
              disabled={!file || !upiRef.trim() || busy || !UPI_VPA}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Submit for verification
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Pay by UPI, then upload the screenshot. We verify and activate your plan.
      </p>
    </div>
  );
}
