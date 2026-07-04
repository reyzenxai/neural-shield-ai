"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Lock, Plus, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { createApiKey, fetchApiKeys, revokeApiKey } from "@/lib/profile";
import { timeAgo } from "@/lib/utils";
import type { ApiKey } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export function ApiKeys() {
  const { profile } = useAuth();
  const isPro = profile?.plan === "pro";
  const queryClient = useQueryClient();

  const { data: keys = [], isLoading, error: queryError } = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
    enabled: isPro,
  });

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = isLoading;

  const onCreate = async () => {
    if (!name.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const { key, secret: full } = await createApiKey(name.trim());
      queryClient.setQueryData<ApiKey[]>(["api-keys"], (old) => [key, ...(old ?? [])]);
      setSecret(full);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create key.");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    await revokeApiKey(id);
    queryClient.setQueryData<ApiKey[]>(["api-keys"], (old) =>
      (old ?? []).map((key) => (key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key)),
    );
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card variant="glass" className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">API keys</h2>
        <Badge variant="accent" size="sm">
          Pro
        </Badge>
      </div>

      {!isPro ? (
        <div className="mt-4 grid place-items-center rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center">
          <Lock className="mb-3 h-7 w-7 text-muted-foreground" />
          <div className="text-sm font-medium">API access is a Pro feature</div>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Upgrade your plan for programmatic access to the Neural Shield API.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Use these keys to call the Neural Shield API. Keep them secret.
          </p>

          {(error || queryError) && (
            <Alert tone="danger" className="mt-4">
              {error ?? (queryError instanceof Error ? queryError.message : "Could not load keys.")}
            </Alert>
          )}

          {secret && (
            <Alert tone="warning" className="mt-4">
              <div className="w-full">
                <div className="font-medium text-foreground">Copy your key now - you won&apos;t see it again.</div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background/60 px-2 py-1 font-mono text-xs">{secret}</code>
                  <Button variant="secondary" size="sm" onClick={copySecret}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          <div className="mt-4 flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate();
              }}
              placeholder="Key name (e.g. Production)"
              aria-label="API key name"
            />
            <Button variant="primary" size="md" onClick={onCreate} loading={creating} disabled={!name.trim()}>
              {!creating && <Plus className="h-4 w-4" />} Generate
            </Button>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading keys…</div>
            ) : keys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                No API keys yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/30 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {k.name}{" "}
                          {k.revoked_at && (
                            <span className="ml-1 font-mono text-[10px] uppercase text-danger">revoked</span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {k.key_prefix}_••••{k.last_four} · created {timeAgo(k.created_at)}
                        </div>
                      </div>
                    </div>
                    {!k.revoked_at && (
                      <button
                        type="button"
                        onClick={() => onRevoke(k.id)}
                        aria-label="Revoke key"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-danger/40 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-border bg-background/40 p-4">
            <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Use your key</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/80">
{`curl -X POST ${API_URL}/scan/message \\
  -H "X-API-Key: nsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Your account will be blocked, verify KYC at bit.ly/x"}'`}
            </pre>
          </div>
        </>
      )}
    </Card>
  );
}
