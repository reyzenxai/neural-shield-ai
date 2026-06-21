"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import { Badge, riskBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";
import type { RiskLevel, SavedScan } from "@/types";

const META: Record<RiskLevel, { label: string; tone: string; ring: string; glow: string; icon: typeof ShieldCheck }> = {
  safe: { label: "Safe", tone: "text-success", ring: "ring-success/40", glow: "bg-success/20", icon: ShieldCheck },
  low: { label: "Low risk", tone: "text-success", ring: "ring-success/40", glow: "bg-success/20", icon: ShieldCheck },
  medium: { label: "Suspicious", tone: "text-warning", ring: "ring-warning/40", glow: "bg-warning/20", icon: AlertTriangle },
  high: { label: "Dangerous", tone: "text-danger", ring: "ring-danger/40", glow: "bg-danger/25", icon: ShieldAlert },
  critical: { label: "Critical", tone: "text-danger", ring: "ring-danger/40", glow: "bg-danger/25", icon: ShieldAlert },
};

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-muted-foreground/50",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * Animated scan verdict: risk badge, trust + scam meters, flags, AI analysis,
 * recommendation, and actions. Slides in and fills the meters on mount.
 */
export function ResultCard({ result }: { result: SavedScan }) {
  const meta = META[result.riskLevel];
  const Icon = meta.icon;
  const scamPct = Math.round(result.scamProbability * 100);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn("glass-strong relative overflow-hidden rounded-3xl p-6 ring-1", meta.ring)}
    >
      <div className={cn("absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl", meta.glow)} />

      {/* Verdict header */}
      <div className="flex items-start gap-4">
        <div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-background/60 ring-1", meta.ring, meta.tone)}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            Verdict
            {result.scamType && <span className="font-mono normal-case">· {result.scamType}</span>}
          </div>
          <div className={cn("font-display text-3xl font-semibold", meta.tone)}>{meta.label}</div>
        </div>
        <Badge
          variant={riskBadgeVariant(result.riskLevel)}
          dot={result.riskLevel === "high" || result.riskLevel === "critical"}
        >
          {result.riskLevel}
        </Badge>
      </div>

      {/* Meters */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Meter label="Trust score" value={result.trustScore} tone="success" suffix="/100" />
        <Meter label="Scam probability" value={scamPct} tone="danger" suffix="%" />
      </div>

      {/* Flags */}
      {result.flags.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Detected flags
          </div>
          <ul className="space-y-2">
            {result.flags.map((f, i) => (
              <motion.li
                key={`${f.flag}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="flex gap-2.5 rounded-xl border border-border bg-background/30 p-3"
              >
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[f.severity])} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{f.flag}</div>
                  {f.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{f.description}</div>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* AI analysis */}
      {result.detailedAnalysis && (
        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">AI analysis</div>
          <p className="text-sm leading-relaxed text-foreground/90">{result.detailedAnalysis}</p>
        </div>
      )}

      {/* Recommendation */}
      <div className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-sm">
        <span className="text-muted-foreground">Recommendation · </span>
        {result.recommendation}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" disabled title="PDF export is available on Pro">
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Accurate?</span>
          <button
            type="button"
            aria-label="Mark accurate"
            onClick={() => setFeedback("up")}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border border-border transition hover:border-primary/40",
              feedback === "up" && "border-success/50 text-success",
            )}
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Mark inaccurate"
            onClick={() => setFeedback("down")}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border border-border transition hover:border-primary/40",
              feedback === "down" && "border-danger/50 text-danger",
            )}
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>model · {result.aiModel}</span>
        <span>{result.processingTimeMs} ms</span>
      </div>
    </motion.div>
  );
}

function Meter({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: number;
  tone: "success" | "danger";
  suffix: string;
}) {
  const text = tone === "success" ? "text-success" : "text-danger";
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-3xl font-semibold", text)}>
        {value}
        <span className="text-base text-muted-foreground">{suffix}</span>
      </div>
      <Progress value={value} tone={tone} className="mt-2" />
    </div>
  );
}
