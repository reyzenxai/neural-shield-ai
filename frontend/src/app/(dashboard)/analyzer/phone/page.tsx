"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ResultPanel } from "@/components/scanner/ResultPanel";
import { ScannerShell } from "@/components/scanner/ScannerShell";
import { useScanner } from "@/hooks/useScanner";
import { scanner } from "@/services/scanner";

export default function PhoneScannerPage() {
  const [phone, setPhone] = useState("");
  const { result, loading, error, run } = useScanner();

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length >= 6;

  const analyze = () => {
    if (!valid) return;
    void run(() => scanner.phone(digits));
  };

  return (
    <ScannerShell
      active="phone"
      title="Phone Scanner"
      description="Check a number that called or messaged you against common Indian fraud patterns."
      input={
        <div className="glass rounded-3xl p-5">
          <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Phone number</div>
          <div className="flex items-stretch gap-2">
            <span className="inline-flex items-center rounded-xl border border-border bg-background/40 px-3 font-mono text-sm text-muted-foreground">
              +91
            </span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") analyze();
              }}
              placeholder="98765 43210"
              inputMode="tel"
              aria-label="Phone number to analyze"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="md" onClick={analyze} loading={loading} disabled={!valid}>
              {!loading && <Sparkles className="h-4 w-4" />} Analyze Number
            </Button>
          </div>
        </div>
      }
      result={<ResultPanel loading={loading} error={error} result={result} />}
    />
  );
}
