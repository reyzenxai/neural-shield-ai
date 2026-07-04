"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, type AdminScanRow } from "@/lib/admin-api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";

type ScanDetail = Record<string, unknown> & {
  flags?: { flag: string; severity: string; description?: string }[];
  feedback?: { is_accurate: boolean; review_status: string | null }[];
};

const PAGE_SIZE = 20;

const RISK_BADGE: Record<string, "safe" | "suspicious" | "dangerous" | "critical" | "default"> = {
  safe: "safe", low: "safe", medium: "suspicious", high: "dangerous", critical: "critical",
};

const RISKS = ["safe", "low", "medium", "high", "critical"];
const TYPES = ["message", "url", "email", "screenshot", "qr", "phone", "upi"];

export default function AdminScansPage() {
  const [scans, setScans]     = useState<AdminScanRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [riskFilter, setRisk] = useState("");
  const [typeFilter, setType] = useState("");
  const [dateFrom, setFrom]   = useState("");
  const [dateTo, setTo]       = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getScans({
        limit:      PAGE_SIZE,
        offset:     page * PAGE_SIZE,
        risk_level: riskFilter || undefined,
        scan_type:  typeFilter || undefined,
        date_from:  dateFrom   || undefined,
        date_to:    dateTo     || undefined,
      });
      setScans(res.scans);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, riskFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);

  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail({});
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("admin_get_scan_detail", { p_scan_id: id });
      if (error) throw error;
      setDetail(data as ScanDetail);
    } catch (e) {
      setDetail({ error: (e as Error).message });
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Scan History</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} total scans</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={riskFilter}
          onChange={(e) => { setRisk(e.target.value); setPage(0); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All risk levels</option>
          {RISKS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setType(e.target.value); setPage(0); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setFrom(e.target.value); setPage(0); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setTo(e.target.value); setPage(0); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <Card>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Error: {error}</p>
        ) : scans.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No scans found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Scam %</th>
                  <th className="px-4 py-3">Trust</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scans.map((s) => (
                  <tr key={s.id} className="hover:bg-card/50">
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium">{s.user_name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{s.user_email}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{s.scan_type}</td>
                    <td className="px-4 py-3">
                      <Badge variant={RISK_BADGE[s.risk_level] ?? "default"} size="sm" className="capitalize">{s.risk_level}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{(Number(s.scam_probability) * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.trust_score}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(s.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button onClick={() => openDetail(s.id)} className="text-xs text-primary hover:underline">Details</button>
                      <Link href={`/admin/users/${s.user_id}`} className="ml-3 text-xs text-primary hover:underline">User</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {detail !== null && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Scan detail</h2>
              <button onClick={() => setDetail(null)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {detailLoading ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : "error" in detail ? (
              <p className="text-sm text-red-400">{String(detail.error)}</p>
            ) : (
              <div className="space-y-3 text-sm">
                <DetailRow label="User" value={`${detail.user_name ?? "-"} (${detail.user_email ?? "-"})`} />
                <DetailRow label="Type" value={String(detail.scan_type ?? "-")} />
                <DetailRow label="Risk" value={String(detail.risk_level ?? "-")} />
                <DetailRow label="Scam probability" value={`${Math.round(Number(detail.scam_probability ?? 0) * 100)}%`} />
                <DetailRow label="Trust score" value={String(detail.trust_score ?? "-")} />
                <DetailRow label="Scam type" value={String(detail.scam_type ?? "-")} />
                <DetailRow label="Model" value={String(detail.ai_model ?? "-")} />
                {(Boolean(detail.input_text) || Boolean(detail.input_url)) && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Input</div>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/60 p-3 text-xs">
                      {String(detail.input_text || detail.input_url)}
                    </pre>
                  </div>
                )}
                {detail.flags && detail.flags.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Flags</div>
                    <ul className="mt-1 space-y-1">
                      {detail.flags.map((f, i) => (
                        <li key={i} className="rounded-lg bg-background/60 p-2 text-xs">
                          <span className="font-medium">{f.flag}</span>
                          {f.description ? ` — ${f.description}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.feedback && detail.feedback.length > 0 && (
                  <DetailRow
                    label="Feedback"
                    value={detail.feedback
                      .map((fb) => (fb.is_accurate ? "Satisfied" : `Unsatisfied${fb.review_status ? ` (${fb.review_status})` : ""}`))
                      .join(", ")}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right capitalize">{value}</span>
    </div>
  );
}
