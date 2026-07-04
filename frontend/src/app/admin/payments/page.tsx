"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminApi, type AdminPaymentRow } from "@/lib/admin-api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { payments } = await adminApi.getPayments("pending");
      setRows(payments);

      // Signed URLs for the private screenshots (admins can read via RLS).
      const supabase = getSupabaseBrowserClient();
      const entries = await Promise.all(
        payments
          .filter((p) => p.screenshot_path)
          .map(async (p) => {
            const { data } = await supabase.storage
              .from("payment-proofs")
              .createSignedUrl(p.screenshot_path as string, 300);
            return [p.id, data?.signedUrl ?? ""] as const;
          }),
      );
      setProofs(Object.fromEntries(entries));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    setError(null);
    try {
      if (action === "approve") await adminApi.approvePayment(id);
      else await adminApi.rejectPayment(id);
      setRows((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Review UPI payment proofs, then approve to activate the plan. Match the amount and the
          reference against what actually arrived in your UPI app before approving.
        </p>
      </div>

      {error && <Card className="p-4 text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No pending payments.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.user_email}</div>
                <div className="text-sm text-muted-foreground">
                  {p.plan} · <span className="font-semibold text-foreground">₹{p.amount_inr}</span> ·{" "}
                  {timeAgo(p.created_at)}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  note {p.reference_note} · ref {p.upi_reference ?? "-"}
                </div>
              </div>

              {proofs[p.id] ? (
                <a href={proofs[p.id]} target="_blank" rel="noreferrer" className="mt-3 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proofs[p.id]}
                    alt="payment proof"
                    className="max-h-56 w-full rounded-xl border border-border object-contain"
                  />
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                    <ExternalLink className="h-3 w-3" /> Open full size
                  </span>
                </a>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  No screenshot uploaded
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => act(p.id, "approve")}
                  disabled={busy === p.id}
                >
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => act(p.id, "reject")}
                  disabled={busy === p.id}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
