"use client";

import { ImageUploader } from "@/components/scanner/ImageScanner";
import { ProScannerNotice } from "@/components/scanner/ProScannerNotice";
import { ResultPanel } from "@/components/scanner/ResultPanel";
import { ScannerShell } from "@/components/scanner/ScannerShell";
import { useAuth } from "@/hooks/useAuth";
import { useScanner } from "@/hooks/useScanner";
import { scanner } from "@/services/scanner";

export default function ScreenshotScannerPage() {
  const { profile } = useAuth();
  const isPro = profile?.plan === "pro";
  const { result, loading, error, run } = useScanner();

  return (
    <ScannerShell
      active="screenshot"
      title="Screenshot Reader"
      description="Upload a screenshot of a suspicious chat or email. Our OCR extracts the text and analyzes it."
      input={
        isPro ? (
          <ImageUploader
            kind="screenshot"
            loading={loading}
            onAnalyze={(file) => run(() => scanner.screenshot(file))}
          />
        ) : (
          <ProScannerNotice kind="screenshot" />
        )
      }
      result={
        isPro ? (
          <div className="space-y-3">
            {result?.extractedText && (
              <div className="glass rounded-2xl p-4">
                <div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  Extracted text
                </div>
                <p className="break-words font-mono text-xs text-foreground/90">{result.extractedText}</p>
              </div>
            )}
            <ResultPanel loading={loading} error={error} result={result} />
          </div>
        ) : (
          <div className="glass-strong grid min-h-[420px] place-items-center rounded-3xl p-8 text-center text-sm text-muted-foreground">
            Screenshot OCR is a Pro feature. Upgrade to read text from any image.
          </div>
        )
      }
    />
  );
}
