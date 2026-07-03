"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, type AdminFeedbackRow } from "@/lib/admin-api";
import { timeAgo } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function AdminFeedbackPage() {
  const [items, setItems]   = useState<AdminFeedbackRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getFeedback({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setItems(res.feedback);
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
        <h1 className="text-2xl font-bold">User Feedback</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} feedback entries</p>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Error: {error}</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No feedback yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((f) => (
              <div key={f.id} className="px-4 py-3 hover:bg-card/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      {f.is_accurate ? (
                        <span className="flex items-center gap-1 text-green-400"><ThumbsUp className="h-3.5 w-3.5" /> Accurate</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400"><ThumbsDown className="h-3.5 w-3.5" /> Inaccurate</span>
                      )}
                      {f.scan_type && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">{f.scan_type}</span>
                      )}
                      {f.risk_level && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">{f.risk_level}</span>
                      )}
                    </div>
                    {f.comment && <p className="text-sm text-foreground/80">{f.comment}</p>}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{f.user_email ?? "Anonymous"}</span>
                      <span>{timeAgo(f.created_at)}</span>
                    </div>
                  </div>
                  {f.scam_probability !== null && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(Number(f.scam_probability) * 100).toFixed(0)}% scam
                    </span>
                  )}
                </div>
              </div>
            ))}
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
