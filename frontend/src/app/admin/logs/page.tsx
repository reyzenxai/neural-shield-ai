"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, type AdminLogRow } from "@/lib/admin-api";
import { timeAgo } from "@/lib/utils";

const PAGE_SIZE = 50;

const ACTION_COLOR: Record<string, string> = {
  view_stats:    "text-blue-400",
  view_users:    "text-purple-400",
  view_user:     "text-purple-300",
  view_scans:    "text-orange-400",
  view_feedback: "text-green-400",
  export_users:  "text-yellow-400",
};

export default function AdminLogsPage() {
  const [logs, setLogs]       = useState<AdminLogRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getLogs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} log entries</p>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Error: {error}</p>
        ) : logs.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No audit logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-card/50">
                    <td className="px-4 py-2">
                      <div className="text-xs font-medium">{l.admin_name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{l.admin_email}</div>
                    </td>
                    <td className={`px-4 py-2 text-xs font-mono ${ACTION_COLOR[l.action] ?? "text-muted-foreground"}`}>
                      {l.action}
                    </td>
                    <td className="px-4 py-2 text-xs capitalize text-muted-foreground">{l.resource}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{l.ip_address ?? "-"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{timeAgo(l.created_at)}</td>
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
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
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
