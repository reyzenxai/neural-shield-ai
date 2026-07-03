"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, type AdminUser } from "@/lib/admin-api";
import { timeAgo } from "@/lib/utils";

const PAGE_SIZE = 20;

const PLAN_VARIANT: Record<string, "default" | "secondary" | "accent"> = {
  free:     "default",
  pro:      "secondary",
  business: "accent",
};

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [search, setSearch]   = useState("");
  const [plan, setPlan]       = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getUsers({
        limit:  PAGE_SIZE,
        offset: page * PAGE_SIZE,
        search: search || undefined,
        plan:   plan   || undefined,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, search, plan]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} registered users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search email or name…"
            className="w-64 pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select
          value={plan}
          onChange={(e) => { setPlan(e.target.value); setPage(0); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Error: {error}</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Scans</th>
                  <th className="px-4 py-3">Last Scan</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-card/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {u.is_admin && (
                        <span className="inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Admin</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PLAN_VARIANT[u.plan] ?? "default"} size="sm" className="uppercase">{u.plan}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{Number(u.total_scans).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.last_scan_at ? timeAgo(u.last_scan_at) : "Never"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="text-xs text-primary hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
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
    </div>
  );
}
