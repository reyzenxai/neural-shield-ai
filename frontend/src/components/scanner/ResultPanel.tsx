"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Loader2, ShieldX, Sparkles } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { ResultCard } from "@/components/scanner/ResultCard";
import type { SavedScan } from "@/types";

const STEPS = ["Ingest", "Decompose", "Reason", "Cross-check", "Score", "Verdict"];

/** Right-hand panel that swaps between empty, loading, error, and result states. */
export function ResultPanel({
  loading,
  error,
  result,
}: {
  loading: boolean;
  error: string | null;
  result: SavedScan | null;
}) {
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <LoadingPanel key="loading" />
      ) : result ? (
        <ResultCard key={result.createdAt} result={result} />
      ) : error ? (
        <ErrorPanel key="error" message={error} />
      ) : (
        <EmptyPanel key="empty" />
      )}
    </AnimatePresence>
  );
}

function EmptyPanel() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="glass-strong grid min-h-[420px] place-items-center rounded-3xl p-8 text-center"
    >
      <div>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="font-display text-lg font-semibold">Awaiting input</div>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Paste content on the left and run the scan. Neural Shield returns a verdict in seconds.
        </p>
      </div>
    </motion.div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="glass-strong grid min-h-[420px] place-items-center rounded-3xl p-8 text-center"
    >
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger ring-1 ring-danger/30">
          <ShieldX className="h-6 w-6" />
        </div>
        <div className="mb-3 font-display text-lg font-semibold">Couldn&apos;t complete the scan</div>
        <Alert tone="danger">{message}</Alert>
      </div>
    </motion.div>
  );
}

function LoadingPanel() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="glass-strong rounded-3xl p-6"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
          <Cpu className="h-5 w-5 animate-pulse text-primary" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
          <div className="font-display text-lg font-semibold text-primary">Analyzing…</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {STEPS.map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0.3, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="font-mono text-xs text-muted-foreground">agent.{s.toLowerCase()}()</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">running…</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
