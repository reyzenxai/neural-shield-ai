"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { ScanStats } from "@/lib/scans";
import type { RiskLevel, ScanType } from "@/types";

type Tone = "primary" | "secondary" | "success" | "danger";
const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
  danger: "text-danger",
};

/** A single KPI tile. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card variant="glass" className="p-5">
      <div className={cn("grid h-9 w-9 place-items-center rounded-lg bg-background/60 ring-1 ring-white/10", TONE_TEXT[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

const RISK_COLOR: Record<RiskLevel, string> = {
  safe: "var(--success)",
  low: "var(--secondary)",
  medium: "var(--warning)",
  high: "var(--danger)",
  critical: "var(--accent)",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  safe: "Safe",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** Donut of scans by risk level. */
export function RiskDonut({ distribution }: { distribution: ScanStats["riskDistribution"] }) {
  const data = distribution.filter((d) => d.count > 0);
  if (data.length === 0) {
    return <div className="grid h-72 place-items-center text-sm text-muted-foreground">No scans yet.</div>;
  }
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="level"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.level} fill={RISK_COLOR[d.level]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, item) => {
              const n = typeof value === "number" ? value : Number(value) || 0;
              const lvl = (item?.payload as { level?: RiskLevel } | undefined)?.level;
              return [`${n} scan${n === 1 ? "" : "s"}`, lvl ? RISK_LABEL[lvl] : ""];
            }}
            contentStyle={{
              background: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 12,
              color: "white",
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconSize={8}
            formatter={(value: string) => RISK_LABEL[value as RiskLevel]}
            wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

const TYPE_LABEL: Record<ScanType, string> = {
  message: "Message",
  url: "URL",
  email: "Email",
  screenshot: "Screenshot",
  qr: "QR Code",
  phone: "Phone",
  upi: "UPI",
};

/** Horizontal bar breakdown of scans by type. */
export function TypeBreakdown({ breakdown }: { breakdown: ScanStats["typeBreakdown"] }) {
  if (breakdown.length === 0) {
    return <div className="grid h-40 place-items-center text-sm text-muted-foreground">No scans yet.</div>;
  }
  return (
    <ul className="space-y-3">
      {breakdown.map(({ type, count, pct }) => (
        <li key={type} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-sm text-muted-foreground">{TYPE_LABEL[type]}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 3)}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {count} · {pct}%
          </span>
        </li>
      ))}
    </ul>
  );
}
