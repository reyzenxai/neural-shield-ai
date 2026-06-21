"use client";

import { useState } from "react";
import { ClipboardPaste, Eraser, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ResultPanel } from "@/components/scanner/ResultPanel";
import { ScannerShell } from "@/components/scanner/ScannerShell";
import { useScanner } from "@/hooks/useScanner";
import { scanner } from "@/services/scanner";

export default function MessageScannerPage() {
  const [text, setText] = useState("");
  const { result, loading, error, run } = useScanner();

  const analyze = () => {
    if (text.trim().length < 10) return;
    void run(() => scanner.message(text));
  };

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      /* clipboard permission denied */
    }
  };

  return (
    <ScannerShell
      active="message"
      title="Message Scanner"
      description="Paste any suspicious SMS, WhatsApp message, or DM. Neural Shield reads it like a fraud investigator and returns a verdict."
      input={
        <div className="glass rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            <span>Message text</span>
            <button
              type="button"
              onClick={paste}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 normal-case tracking-normal text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste
            </button>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") analyze();
            }}
            placeholder="Paste a WhatsApp message, SMS, job offer, or suspicious text…"
            className="min-h-[240px]"
            showCount
            maxLength={5000}
            aria-label="Message to analyze"
          />
          <div className="mt-4 flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted-foreground">⌘/Ctrl + Enter to scan</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={!text}>
                <Eraser className="h-4 w-4" /> Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={analyze}
                loading={loading}
                disabled={text.trim().length < 10}
              >
                {!loading && <Sparkles className="h-4 w-4" />} Analyze Message
              </Button>
            </div>
          </div>
        </div>
      }
      result={<ResultPanel loading={loading} error={error} result={result} />}
    />
  );
}
