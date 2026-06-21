"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ResultPanel } from "@/components/scanner/ResultPanel";
import { ScannerShell } from "@/components/scanner/ScannerShell";
import { useScanner } from "@/hooks/useScanner";
import { scanner } from "@/services/scanner";

const HANDLES = ["@okaxis", "@oksbi", "@okicici", "@ybl", "@paytm", "@apl"];

export default function UpiScannerPage() {
  const [upiId, setUpiId] = useState("");
  const { result, loading, error, run } = useScanner();

  const valid = /^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/i.test(upiId.trim());

  const analyze = () => {
    if (!valid) return;
    void run(() => scanner.upi(upiId.trim()));
  };

  return (
    <ScannerShell
      active="upi"
      title="UPI Guard"
      description="Verify a UPI ID before you pay. We check for fake merchant names and known fraud patterns."
      input={
        <div className="glass rounded-3xl p-5">
          <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">UPI ID</div>
          <Input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") analyze();
            }}
            placeholder="merchant@okaxis"
            aria-label="UPI ID to analyze"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {HANDLES.map((h) => (
              <span key={h} className="rounded-md bg-card/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {h}
              </span>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="md" onClick={analyze} loading={loading} disabled={!valid}>
              {!loading && <Sparkles className="h-4 w-4" />} Verify UPI
            </Button>
          </div>
        </div>
      }
      result={<ResultPanel loading={loading} error={error} result={result} />}
    />
  );
}
