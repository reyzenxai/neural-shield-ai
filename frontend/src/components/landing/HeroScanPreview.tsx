"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";

type Phase = "idle" | "scanning" | "result";

const SAMPLE =
  "Dear customer, your SBI account will be BLOCKED today. Complete KYC immediately at bit.ly/sbi-kyc-verify or call 90XXXXXX21.";

const FLAGS = [
  "Impersonates SBI + urgency ('blocked today')",
  "Shortened link hides real destination",
  "Requests KYC / OTP outside official app",
];

/**
 * Self-looping hero visual: shows a blurred incoming message, an AI "scanning"
 * pass, then reveals a DANGEROUS verdict at 94% scam probability. Frontend-only.
 */
export function HeroScanPreview() {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      setPhase("idle");
      timers.push(setTimeout(() => setPhase("scanning"), 900));
      timers.push(setTimeout(() => setPhase("result"), 2600));
      timers.push(setTimeout(cycle, 6200));
    };
    cycle();
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Glow behind the card */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/15 blur-3xl" />

      <div className="glass-strong relative overflow-hidden rounded-3xl p-5">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Neural Shield · live
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">SMS · unknown sender</span>
        </div>

        {/* Incoming message (blurred until scan completes) */}
        <div
          className={`rounded-2xl border border-border bg-background/40 p-4 text-sm leading-relaxed text-foreground/90 transition-all duration-500 ${
            phase === "result" ? "blur-0" : "blur-[3px] select-none"
          }`}
        >
          {SAMPLE}
        </div>

        {/* Scanning bar */}
        <div className="mt-4 h-9">
          <AnimatePresence mode="wait">
            {phase === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.6, ease: "easeInOut" }}
                  />
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">analyzing…</span>
              </motion.div>
            )}

            {phase === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-danger" />
                  <Badge variant="critical" size="sm">
                    Dangerous
                  </Badge>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  scam probability <span className="text-danger">94%</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Verdict detail */}
        <AnimatePresence>
          {phase === "result" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-3 overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Trust
                  </div>
                  <div className="font-mono text-2xl font-semibold text-danger">6</div>
                  <Progress value={6} tone="danger" className="mt-1.5" />
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Scam type
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">Fake KYC</div>
                  <div className="font-mono text-[11px] text-muted-foreground">phishing · UPI</div>
                </div>
              </div>
              <ul className="space-y-1.5">
                {FLAGS.map((f, i) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.1 }}
                    className="flex gap-2 text-xs text-foreground/80"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger" />
                    {f}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
