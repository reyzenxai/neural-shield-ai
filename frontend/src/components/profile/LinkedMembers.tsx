"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, UserPlus, X } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { linkMember, listMembers, unlinkMember, type Member } from "@/lib/members";
import { PLANS, type PlanId } from "@neural-shield/config";

const MULTI_USER: PlanId[] = ["two_person", "family"];

/** Owner-only: link the members on a Two-person or Family plan by their signup email. */
export function LinkedMembers() {
  const { profile } = useAuth();
  const plan = (profile?.plan ?? "free") as PlanId;
  const queryClient = useQueryClient();

  const [edit, setEdit] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = MULTI_USER.includes(plan);
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: listMembers, enabled });

  if (!enabled) return null;

  const seats = PLANS[plan].seats - 1; // members besides the owner
  const bySlot: Record<number, Member> = Object.fromEntries(members.map((m) => [m.slot, m]));

  const save = async (slot: number) => {
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await linkMember(slot, email.trim());
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      setEdit(null);
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slot: number) => {
    setError(null);
    setBusy(true);
    try {
      await unlinkMember(slot);
      await queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="glass" className="p-6">
      <h2 className="font-display text-base font-semibold">Linked members</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add the people on your {PLANS[plan].name} plan by the email they signed up with. Each member
        gets their own scan quota. You can change a member only once a month.
      </p>

      {error && (
        <Alert tone="danger" className="mt-3">
          {error}
        </Alert>
      )}

      <div className="mt-4 space-y-2">
        {Array.from({ length: seats }).map((_, i) => {
          const slot = i + 1;
          const m = bySlot[slot];
          const locked = !!m?.email_locked_until && new Date(m.email_locked_until) > new Date();

          return (
            <div key={slot} className="rounded-xl border border-border bg-background/40 p-3">
              {edit === slot ? (
                <div className="flex gap-2">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@gmail.com"
                    aria-label={`Member ${slot} email`}
                  />
                  <Button variant="primary" size="md" onClick={() => save(slot)} disabled={busy || !email.trim()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setEdit(null);
                      setEmail("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {m?.member_email ?? (
                        <span className="text-muted-foreground">Member {slot} (not set)</span>
                      )}
                    </div>
                    {m && (
                      <div className="text-xs text-muted-foreground">
                        {m.member_id ? "Active" : "Pending - waiting for them to sign up"}
                        {locked ? " · change locked until next month" : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEdit(slot);
                        setEmail(m?.member_email ?? "");
                      }}
                      disabled={busy || locked}
                    >
                      {m ? (
                        "Change"
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" /> Add
                        </>
                      )}
                    </Button>
                    {m && (
                      <button
                        type="button"
                        onClick={() => remove(slot)}
                        disabled={busy || locked}
                        aria-label="Remove member"
                        className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-danger/40 hover:text-danger disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
