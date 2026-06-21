"use client";

import { ImageUploader } from "@/components/scanner/ImageScanner";
import { ProScannerNotice } from "@/components/scanner/ProScannerNotice";
import { ResultPanel } from "@/components/scanner/ResultPanel";
import { ScannerShell } from "@/components/scanner/ScannerShell";
import { useAuth } from "@/hooks/useAuth";
import { useScanner } from "@/hooks/useScanner";
import { scanner } from "@/services/scanner";

export default function QrScannerPage() {
  const { profile } = useAuth();
  const isPro = profile?.plan === "pro" || profile?.plan === "business";
  const { result, loading, error, run } = useScanner();

  return (
    <ScannerShell
      active="qr"
      title="QR Code Detector"
      description="Upload a QR code image. We decode the destination and scan it before you ever visit it."
      input={
        isPro ? (
          <ImageUploader kind="qr" loading={loading} onAnalyze={(file) => run(() => scanner.qr(file))} />
        ) : (
          <ProScannerNotice kind="qr" />
        )
      }
      result={
        isPro ? (
          <div className="space-y-3">
            {result?.decodedText && (
              <div className="glass rounded-2xl p-4">
                <div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  Decoded link
                </div>
                <p className="break-words font-mono text-xs text-foreground/90">{result.decodedText}</p>
              </div>
            )}
            <ResultPanel loading={loading} error={error} result={result} />
          </div>
        ) : (
          <div className="glass-strong grid min-h-[420px] place-items-center rounded-3xl p-8 text-center text-sm text-muted-foreground">
            QR decoding is a Pro feature. Upgrade to scan QR codes before you visit them.
          </div>
        )
      }
    />
  );
}
