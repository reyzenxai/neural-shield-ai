"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, type AdminStats } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const RISK_COLORS: Record<string, string> = {
  safe:     "#22c55e",
  low:      "#86efac",
  medium:   "#facc15",
  high:     "#f97316",
  critical: "#ef4444",
};

const PLAN_COLORS: Record<string, string> = {
  free:     "#a855f7",
  pro:      "#3b82f6",
  business: "#f59e0b",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  accent?: string;
}

function StatCard({ label, value, icon: Icon, sub, accent }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-3xl font-bold", accent ?? "text-foreground")}>{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getStats()
      .then(setStats)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Card className="p-6 text-center text-muted-foreground">
          Failed to load stats: {error ?? "Unknown error"}
        </Card>
      </div>
    );
  }

  const riskPie = Object.entries(stats.scans_by_risk).map(([name, value]) => ({ name, value }));
  const typeBars = Object.entries(stats.scans_by_type).map(([name, value]) => ({ name, value }));
  const planPie  = Object.entries(stats.users_by_plan).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform-wide metrics and activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total Users"       value={stats.total_users.toLocaleString()}        icon={Users}         />
        <StatCard label="Active (30d)"      value={stats.active_users_30d.toLocaleString()}   icon={TrendingUp}    />
        <StatCard label="Total Scans"       value={stats.total_scans.toLocaleString()}        icon={Activity}      />
        <StatCard label="Scans Today"       value={stats.scans_today.toLocaleString()}        icon={Zap}           />
        <StatCard label="High-Risk Scans"   value={stats.high_risk_scans.toLocaleString()}    icon={AlertTriangle} accent="text-orange-400" />
        <StatCard label="Total Feedback"    value={stats.total_feedback.toLocaleString()}     icon={MessageSquare} />
      </div>

      {/* Daily scans chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold">Daily Scans (last 30 days)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.daily_scans}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} stroke="rgba(255,255,255,0.2)" />
              <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
              <Tooltip contentStyle={{ background: "#1a0d35", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Risk distribution pie */}
        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold">Risk Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={riskPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {riskPie.map((entry) => (
                  <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? "#6b7280"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a0d35", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Scan types + plan distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold">Scans by Type</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typeBars} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" width={60} />
              <Tooltip contentStyle={{ background: "#1a0d35", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8 }} />
              <Bar dataKey="value" fill="#a855f7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold">Users by Plan</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={planPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                {planPie.map((entry) => (
                  <Cell key={entry.name} fill={PLAN_COLORS[entry.name] ?? "#6b7280"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a0d35", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
