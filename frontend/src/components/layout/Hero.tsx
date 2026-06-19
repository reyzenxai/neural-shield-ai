"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="py-28 text-center">
      <div className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 rounded-full px-4 py-2 text-xs uppercase tracking-widest text-blue-400 mb-8">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
        Neural Shield Online
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-5xl mx-auto text-5xl md:text-7xl leading-tight"
        style={{
          fontFamily: "var(--font-fraunces)",
        }}
      >
        Before you trust anything online,
        <br />
        <span className="text-blue-500">
          run it through us.
        </span>
      </motion.h1>

      <p className="max-w-2xl mx-auto mt-8 text-lg text-gray-400">
        Paste a message, email, job offer, or link.
        Our AI reads it the way a fraud investigator
        would.
      </p>
    </section>
  );
}