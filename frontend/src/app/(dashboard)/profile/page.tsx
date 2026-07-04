"use client";

import { useQuery } from "@tanstack/react-query";

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
        <Security />
        <DangerZone />
      </div>
    </div>
  );
}
