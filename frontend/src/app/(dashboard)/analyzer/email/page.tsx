"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { ResultPanel } from "@/components/scanner/ResultPanel";
import { ScannerShell } from "@/components/scanner/ScannerShell";
import { useScanner } from "@/hooks/useScanner";
import { scanner } from "@/services/scanner";

export default function EmailScannerPage() {
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const { result, loading, error, run } = useScanner();

  const analyze = () => {
    if (body.trim().length < 5) return;
    void run(() => scanner.email({ sender: sender.trim(), subject: subject.trim(), body }));
  };

  return (
    <ScannerShell
      active="email"
      title="Email Analyzer"
      description="Paste a suspicious email. We flag phishing, sender spoofing, and impersonation."
      input={
        <div className="glass rounded-3xl p-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sender">From (sender)</Label>
              <Input
                id="sender"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="support@bank-secure.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Urgent: verify your account"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Email body</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Paste the full email content, including any links…"
                className="min-h-[200px]"
                showCount
                maxLength={20000}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="md" onClick={analyze} loading={loading} disabled={body.trim().length < 5}>
              {!loading && <Sparkles className="h-4 w-4" />} Analyze Email
            </Button>
          </div>
        </div>
      }
      result={<ResultPanel loading={loading} error={error} result={result} />}
    />
  );
}
