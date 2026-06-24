"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, type AdminScanRow } from "@/lib/admin-api";
import { timeAgo } from "@/lib/utils";

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
                      <div className="text-xs font-medium">{s.user_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.user_email}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{s.scan_type}</td>
                    <td className="px-4 py-3">
                      <Badge variant={RISK_BADGE[s.risk_level] ?? "default"} size="sm" className="capitalize">{s.risk_level}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{(Number(s.scam_probability) * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.trust_score}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${s.user_id}`} className="text-xs text-primary hover:underline">User</Link>
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
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
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
    </div>
  );
}
