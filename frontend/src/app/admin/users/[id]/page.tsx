"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, type AdminUserDetail } from "@/lib/admin-api";
import { timeAgo } from "@/lib/utils";

const RISK_COLORS: Record<string, string> = {
  safe: "#22c55e", low: "#86efac", medium: "#facc15", high: "#f97316", critical: "#ef4444",
};

const RISK_BADGE: Record<string, "safe" | "suspicious" | "dangerous" | "critical" | "default"> = {
  safe: "safe", low: "safe", medium: "suspicious", high: "dangerous", critical: "critical",
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData]     = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getUser(id)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Users
        </Link>
        <Card className="p-6 text-center text-muted-foreground">{error ?? "User not found."}</Card>
      </div>
    );
  }

  const { profile, effective_plan, total_scans, scans_by_risk, recent_scans, feedback_count, subscription } = data;
  const riskPie = Object.entries(scans_by_risk ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Users
      </Link>

      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-xl font-bold text-primary ring-1 ring-primary/30">
          {(profile.name || profile.email).slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-xl font-bold">{profile.name ?? "Unnamed"}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          <div className="mt-1 flex gap-2">
            <Badge variant="default" size="sm" className="uppercase">{effective_plan}</Badge>
            {effective_plan !== profile.plan && (
              <Badge variant="secondary" size="sm" className="uppercase">linked · own {profile.plan}</Badge>
            )}
            {profile.is_admin && <Badge variant="secondary" size="sm">Admin</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile details */}
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold">Account</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="font-mono text-xs">{profile.id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Joined</dt>
              <dd>{new Date(profile.created_at).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last Updated</dt>
              <dd>{timeAgo(profile.updated_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Scans</dt>
              <dd className="font-semibold">{Number(total_scans).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Feedback Given</dt>
              <dd>{feedback_count}</dd>
            </div>
            {subscription && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sub Status</dt>
                  <dd className="capitalize">{subscription.status}</dd>
                </div>
                {subscription.expires_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Expires</dt>
                    <dd>{new Date(subscription.expires_at).toLocaleDateString()}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </Card>

        {/* Risk pie */}
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold">Scans by Risk Level</p>
          {riskPie.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={riskPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {riskPie.map((e) => <Cell key={e.name} fill={RISK_COLORS[e.name] ?? "#6b7280"} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a0d35", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Recent scans */}
      <Card>
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Recent Scans</p>
        </div>
        {!recent_scans?.length ? (
          <p className="p-4 text-sm text-muted-foreground">No scans.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent_scans.map((s) => (
                  <tr key={s.id} className="hover:bg-card/50">
                    <td className="px-4 py-2 capitalize">{s.scan_type}</td>
                    <td className="px-4 py-2">
                      <Badge variant={RISK_BADGE[s.risk_level] ?? "default"} size="sm" className="capitalize">{s.risk_level}</Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{(Number(s.scam_probability) * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{timeAgo(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
