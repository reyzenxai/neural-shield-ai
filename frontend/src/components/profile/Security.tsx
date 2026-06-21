"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, LogOut, MonitorSmartphone } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuth } from "@/hooks/useAuth";
import { changePassword, signOutEverywhere } from "@/lib/profile";
import { scorePassword } from "@/lib/password";

export function Security() {
  const router = useRouter();
  const { user } = useAuth();

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const onChangePassword = async () => {
    setError(null);
    if (!scorePassword(pw).valid) {
      return setError("Password must be 8+ chars with an uppercase, a lowercase, and a number.");
    }
    if (pw !== confirm) return setError("Passwords do not match.");
    setSaving(true);
    try {
      await changePassword(pw);
      setDone(true);
      setPw("");
      setConfirm("");
      window.setTimeout(() => setDone(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  };

  const onSignOutEverywhere = async () => {
    setSigningOut(true);
    try {
      await signOutEverywhere();
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <Card variant="glass" className="p-6">
      <h2 className="font-display text-base font-semibold">Security</h2>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      {/* Change password */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-pw">New password</Label>
          <Input
            id="new-pw"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-pw">Confirm</Label>
          <Input
            id="confirm-pw"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>
      <div className="mt-3">
        <Button variant="primary" size="sm" onClick={onChangePassword} disabled={!pw || !confirm} loading={saving}>
          {!saving && (done ? <Check className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />)}
          {done ? "Password updated" : "Change password"}
        </Button>
      </div>

      {/* Sessions */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <MonitorSmartphone className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Active sessions</div>
              <p className="text-xs text-muted-foreground">
                Signed in as {user?.email}. Sign out everywhere to end all other sessions.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onSignOutEverywhere} loading={signingOut}>
            {!signingOut && <LogOut className="h-4 w-4" />} Sign out everywhere
          </Button>
        </div>
      </div>
    </Card>
  );
}
