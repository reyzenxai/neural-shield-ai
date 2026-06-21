"use client";

import { useState } from "react";
import { ClipboardPaste, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ResultPanel } from "@/components/scanner/ResultPanel";
import { ScannerShell } from "@/components/scanner/ScannerShell";
import { useScanner } from "@/hooks/useScanner";
import { scanner } from "@/services/scanner";

export default function UrlScannerPage() {
  const [url, setUrl] = useState("");
  const { result, loading, error, run } = useScanner();

  const analyze = () => {
    if (!url.trim()) return;
    void run(() => scanner.url(url.trim()));
  };

  const paste = async () => {
    try {
      setUrl((await navigator.clipboard.readText()).trim());
    } catch {
      /* clipboard permission denied */
    }
  };

  return (
    <ScannerShell
      active="url"
      title="URL Scanner"
      description="Check a link before you click. We analyze the domain, structure, and known phishing patterns in real time."
      input={
        <div className="glass rounded-3xl p-5">
          <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Link / URL</div>
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") analyze();
              }}
              placeholder="https://example.com/verify…"
              inputMode="url"
              aria-label="URL to analyze"
            />
            <Button variant="secondary" size="md" onClick={paste} title="Paste from clipboard">
              <ClipboardPaste className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="md" onClick={analyze} loading={loading} disabled={!url.trim()}>
              {!loading && <Sparkles className="h-4 w-4" />} Analyze URL
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: paste the full link including <span className="font-mono">https://</span>. We never
            open the link in your browser.
          </p>
        </div>
      }
      result={<ResultPanel loading={loading} error={error} result={result} />}
    />
  );
}
