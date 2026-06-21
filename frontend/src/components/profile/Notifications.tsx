"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useAuth } from "@/hooks/useAuth";
import { updateNotificationPrefs } from "@/lib/profile";
import type { NotificationPrefs } from "@/types";

const DEFAULTS: NotificationPrefs = {
  scam_alerts: true,
  weekly_digest: false,
  product_updates: true,
};

const ITEMS: { key: keyof NotificationPrefs; title: string; desc: string }[] = [
  { key: "scam_alerts", title: "Scam alerts", desc: "Get notified about active scam campaigns in your region." },
  { key: "weekly_digest", title: "Weekly digest", desc: "A weekly summary of your scans and threats caught." },
  { key: "product_updates", title: "Product updates", desc: "New scanners and features as they launch." },
];

export function Notifications() {
  const { profile, refreshProfile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(profile?.notification_prefs ?? DEFAULTS);
  const [saving, setSaving] = useState(false);

  const toggle = async (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    setSaving(true);
    try {
      await updateNotificationPrefs(next);
      await refreshProfile();
    } catch {
      setPrefs(prefs); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="glass" className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Notifications</h2>
        {saving && <span className="font-mono text-[11px] text-muted-foreground">saving…</span>}
      </div>
      <ul className="mt-4 divide-y divide-border">
        {ITEMS.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="text-sm font-medium">{item.title}</div>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch checked={prefs[item.key]} onChange={() => toggle(item.key)} label={item.title} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
