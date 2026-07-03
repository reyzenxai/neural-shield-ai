"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";

/**
 * Signature hero visual - rotating orbit rings, orbiting particles, pulse rings,
 * and a glowing glass core. Ported from the Lovable design system.
 */
export function NeuralOrb() {
  return (
    <div className="relative mx-auto h-[420px] w-[420px] max-w-full" aria-hidden="true">
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_45%,transparent),transparent_60%)] blur-2xl" />

      {/* Rotating orbit rings */}
      <div
        className="absolute inset-6 rounded-full border border-primary/20 animate-spin-slow"
        style={{ borderStyle: "dashed" }}
      />
      <div className="absolute inset-16 rounded-full border border-secondary/25 animate-spin-reverse" />
      <div className="absolute inset-24 rounded-full border border-accent/30 animate-spin-slow" />

      {/* Pulse rings */}
      <div className="absolute inset-20 rounded-full border border-primary/40 animate-pulse-ring" />
      <div
        className="absolute inset-20 rounded-full border border-primary/30 animate-pulse-ring"
        style={{ animationDelay: "1.2s" }}
      />

      {/* Orbiting particles */}
      {Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const r = 150 + (i % 3) * 20;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]"
            animate={{ x: [x, x * 1.05, x], y: [y, y * 1.05, y], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.15 }}
          />
        );
      })}

      {/* Core */}
      <motion.div
        className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          <div className="absolute -inset-10 rounded-full bg-primary/30 blur-2xl" />
          <div className="relative grid h-28 w-28 place-items-center rounded-3xl glass-strong glow-primary">
            <Shield className="h-12 w-12 text-primary" strokeWidth={1.5} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
