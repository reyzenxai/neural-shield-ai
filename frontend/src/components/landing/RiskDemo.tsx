"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Eraser,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Textarea } from "@/components/ui/Textarea";
import {
  DEMO_SAMPLES,
  demoAnalyze,
  type DemoResult,
  type DemoRiskLevel,
} from "@/lib/demo-analyze";

const LEVEL_META: Record<
  DemoRiskLevel,
  { label: string; badge: BadgeProps["variant"]; tone: string; icon: typeof Shield }
> = {
  safe: { label: "Safe", badge: "safe", tone: "text-success", icon: ShieldCheck },
  suspicious: { label: "Suspicious", badge: "suspicious", tone: "text-warning", icon: AlertTriangle },
  dangerous: { label: "Dangerous", badge: "dangerous", tone: "text-danger", icon: ShieldAlert },
  critical: { label: "Critical", badge: "critical", tone: "text-danger", icon: ShieldAlert },
};

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-muted-foreground/50",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * Interactive conversion demo (Section 4) — runs the local heuristic scorer with
 * no API call. "Try a sample" cycles through hardcoded Indian scam messages.
 */
export function RiskDemo() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sampleIdx, setSampleIdx] = useState(0);

  const run = (input: string) => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    window.setTimeout(() => {
      setResult(demoAnalyze(input));
      setLoading(false);
    }, 900);
  };

  const onSample = () => {
    const sample = DEMO_SAMPLES[sampleIdx % DEMO_SAMPLES.length];
    setSampleIdx((i) => i + 1);
    setText(sample);
    run(sample);
  };

  const meta = result ? LEVEL_META[result.riskLevel] : null;
  const Icon = meta?.icon ?? Sparkles;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
      {/* Input panel */}
      <div className="glass rounded-3xl p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Live demo · no sign-up
          </div>
          <span className="font-mono text-xs text-muted-foreground">heuristic preview</span>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(text);
          }}
          placeholder="Paste a suspicious message here… (try a fake KYC SMS, lottery win, or job offer)"
          className="min-h-[176px]"
          showCount
          maxLength={2000}
          aria-label="Message to analyze"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={onSample} type="button">
            <Sparkles className="h-4 w-4 text-primary" /> Try a sample
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                setText("");
                setResult(null);
              }}
            >
              <Eraser className="h-4 w-4" /> Clear
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              loading={loading}
              disabled={!text.trim()}
              onClick={() => run(text)}
            >
              {!loading && <Sparkles className="h-4 w-4" />} Analyze
            </Button>
          </div>
        </div>
      </div>

      {/* Result panel */}
      <div className="glass-strong relative min-h-[340px] overflow-hidden rounded-3xl p-6">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />

        <AnimatePresence mode="wait">
          {result && meta ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className={`grid h-11 w-11 place-items-center rounded-xl bg-background/60 ${meta.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Verdict</div>
                  <div className={`font-display text-xl font-semibold ${meta.tone}`}>{meta.label}</div>
                </div>
                <Badge variant={meta.badge}>{result.scamType}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Meter label="Trust score" value={result.trustScore} tone="success" />
                <Meter label="Scam probability" value={result.scamProbability} tone="danger" />
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                  Detected flags
                </div>
                <ul className="space-y-1.5">
                  {result.flags.map((f, i) => (
                    <motion.li
                      key={f.label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex gap-2 text-sm text-foreground/90"
                    >
                      <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[f.severity]}`} />
                      {f.label}
                    </motion.li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-background/50 p-3 text-sm">
                <span className="text-muted-foreground">Recommendation · </span>
                {result.recommendation}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid h-full min-h-[300px] place-items-center text-center"
            >
              <div>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="font-display text-lg font-semibold">
                  {loading ? "Analyzing…" : "Awaiting input"}
                </div>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  Paste a message or try a sample. Neural Shield reveals the risk in real time.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger";
}) {
  const text = tone === "success" ? "text-success" : "text-danger";
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-3xl font-semibold ${text}`}>
        {value}
        <span className="text-base text-muted-foreground">%</span>
      </div>
      <Progress value={value} tone={tone} className="mt-2" />
    </div>
  );
}
