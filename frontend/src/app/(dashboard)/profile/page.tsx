"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiKeys } from "@/components/profile/ApiKeys";
import { DangerZone } from "@/components/profile/DangerZone";
import { LinkedMembers } from "@/components/profile/LinkedMembers";
import { Notifications } from "@/components/profile/Notifications";
import { PersonalInfo } from "@/components/profile/PersonalInfo";
import { PlanUpgrade } from "@/components/profile/PlanUpgrade";
import { Security } from "@/components/profile/Security";
import { useAuth } from "@/hooks/useAuth";
import { getEffectivePlan } from "@/lib/members";
import { PLANS, type PlanId } from "@neural-shield/config";

function planLabel(p: string): string {
  return (PLANS as Record<string, { name: string }>)[p]?.name ?? p;
}

// Replace this placeholder with the real Google Form URL once the form exists.
const FEEDBACK_FORM_URL = "UPLOAD_GOOGLE_FORM_LINK_HERE";

export default function ProfilePage() {
  const { profile } = useAuth();
  const { data: effectivePlan } = useQuery({ queryKey: ["effective-plan"], queryFn: getEffectivePlan });
  const plan = (effectivePlan ?? profile?.plan ?? "free") as PlanId;
  const dailyCap = (PLANS[plan] ?? PLANS.free).dailyScans;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Profile &amp; settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account, plan, and preferences.</p>
      </div>

      <div className="space-y-4">
        <PersonalInfo />

        {/* Plan & usage */}
        <Card variant="glass" className="p-6">
          <h2 className="font-display text-base font-semibold">Plan &amp; usage</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Current plan</div>
              <div className="mt-1 font-display text-xl font-semibold">{planLabel(plan)}</div>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Scans today</div>
              <div className="mt-1 font-display text-xl font-semibold">
                {dailyCap == null ? "Unlimited" : `${profile?.daily_scan_count ?? 0} / ${dailyCap}`}
              </div>
            </div>
          </div>
          <PlanUpgrade />
        </Card>

        <LinkedMembers />

        <ApiKeys />
        <Notifications />

        {/* Feedback */}
        <Card variant="glass" className="p-6">
          <h2 className="font-display text-base font-semibold">Share feedback</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us what&apos;s working and what we can improve — it takes a minute.
          </p>
          <Button asChild variant="secondary" size="md" className="mt-4">
            <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">
              <MessageSquarePlus className="h-4 w-4" /> Open feedback form
            </a>
          </Button>
        </Card>

        <Security />
        <DangerZone />
      </div>
    </div>
  );
}
