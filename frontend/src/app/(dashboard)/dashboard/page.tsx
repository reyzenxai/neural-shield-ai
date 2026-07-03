"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Radar,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import { Badge, riskBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { RiskDonut, StatCard, TypeBreakdown } from "@/components/dashboard/widgets";
import { useAuth } from "@/hooks/useAuth";
import { useScans } from "@/hooks/useScans";
import { computeStats, scanPreview } from "@/lib/scans";
import { timeAgo } from "@/lib/utils";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: scans, isLoading, isError } = useScans();

  const stats = computeStats(scans ?? []);
  const recent = (scans ?? []).slice(0, 10);
  const plan = profile?.plan ?? "free";
  const todayUsage =
    plan === "free" ? `${profile?.daily_scan_count ?? 0}/10` : "Unlimited";

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your scan activity and threat insights at a glance.
          </p>
        </div>
        <Button asChild variant="primary" size="md">
          <Link href="/analyzer/message">
            <ScanLine className="h-4 w-4" /> New scan
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatCard icon={Activity} label="Total scans" value={String(stats.total)} tone="primary" />
            <StatCard icon={AlertTriangle} label="Scams caught" value={String(stats.scamsCaught)} tone="danger" />
            <StatCard icon={ShieldCheck} label="Today's usage" value={todayUsage} hint={`${plan} plan`} tone="success" />
            <StatCard icon={Gauge} label="Avg trust score" value={String(stats.avgTrust)} hint="0-100" tone="secondary" />
          </>
        )}
      </div>

      {isError && (
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Couldn&apos;t load your scans. Check that Supabase is configured and you&apos;re signed in.
        </div>
      )}

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card variant="glass" className="p-5">
          <PanelHeader icon={ScanLine} title="Scans by type" />
          {isLoading ? <Skeleton className="h-40" /> : <TypeBreakdown breakdown={stats.typeBreakdown} />}
        </Card>
        <Card variant="glass" className="p-5">
          <PanelHeader icon={Radar} title="Risk distribution" />
          {isLoading ? <Skeleton className="h-72" /> : <RiskDonut distribution={stats.riskDistribution} />}
        </Card>
      </div>

      {/* Recent scans */}
      <Card variant="glass" className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <PanelHeader icon={Activity} title="Recent scans" />
          <Link href="/history" className="text-xs text-primary hover:underline">
            View all →
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyRecent />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Preview</th>
                  <th className="pb-2 pr-3 font-medium">Risk</th>
                  <th className="pb-2 pr-3 text-right font-medium">Trust</th>
                  <th className="pb-2 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="rounded-md bg-card/60 px-2 py-0.5 font-mono text-[11px] capitalize text-muted-foreground">
                        {s.scan_type}
                      </span>
                    </td>
                    <td className="max-w-[260px] truncate py-2.5 pr-3 text-foreground/90">
                      {scanPreview(s)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge variant={riskBadgeVariant(s.risk_level)} size="sm">
                        {s.risk_level}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground">{s.trust_score}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{timeAgo(s.created_at)}</td>
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

function PanelHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <div className="text-sm font-semibold">{title}</div>
    </div>
  );
}

function EmptyRecent() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 px-6 py-12 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
        <ScanLine className="h-5 w-5 text-primary" />
      </div>
      <div className="font-display text-base font-semibold">No scans yet</div>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        Run your first scan and your results will show up here.
      </p>
      <Button asChild variant="primary" size="sm" className="mt-4">
        <Link href="/analyzer/message">Scan a message</Link>
      </Button>
    </div>
  );
}
