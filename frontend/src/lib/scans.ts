import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RiskLevel, ScanRowWithFlags, ScanType } from "@/types";

/** Fetch the current user's scans (RLS-scoped) with their flags, newest first. */
export async function fetchScans(limit = 1000): Promise<ScanRowWithFlags[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("scans")
    .select("*, scan_flags(*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ScanRowWithFlags[]) ?? [];
}

/** Delete scans by id (RLS-scoped). */
export async function deleteScans(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("scans").delete().in("id", ids);
  if (error) throw error;
}

const DANGEROUS: RiskLevel[] = ["high", "critical"];

export interface ScanStats {
  total: number;
  scamsCaught: number;
  avgTrust: number;
  riskDistribution: { level: RiskLevel; count: number }[];
  typeBreakdown: { type: ScanType; count: number; pct: number }[];
}

const RISK_ORDER: RiskLevel[] = ["safe", "low", "medium", "high", "critical"];

/** Aggregate dashboard stats from a list of scans (client-side). */
export function computeStats(scans: ScanRowWithFlags[]): ScanStats {
  const total = scans.length;
  const scamsCaught = scans.filter((s) => DANGEROUS.includes(s.risk_level)).length;
  const avgTrust = total
    ? Math.round(scans.reduce((sum, s) => sum + s.trust_score, 0) / total)
    : 0;

  const riskDistribution = RISK_ORDER.map((level) => ({
    level,
    count: scans.filter((s) => s.risk_level === level).length,
  }));

  const typeCounts = new Map<ScanType, number>();
  for (const s of scans) typeCounts.set(s.scan_type, (typeCounts.get(s.scan_type) ?? 0) + 1);
  const typeBreakdown = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  return { total, scamsCaught, avgTrust, riskDistribution, typeBreakdown };
}

/** Short preview of a scan's input for tables. */
export function scanPreview(scan: ScanRowWithFlags): string {
  const raw = scan.input_text || scan.input_url || scan.input_file_path || "—";
  return raw.length > 64 ? `${raw.slice(0, 64)}…` : raw;
}

/** Export scans to a CSV string. */
export function scansToCsv(scans: ScanRowWithFlags[]): string {
  const header = ["Date", "Type", "Risk", "Trust", "ScamProbability", "ScamType", "Preview"];
  const rows = scans.map((s) => [
    new Date(s.created_at).toISOString(),
    s.scan_type,
    s.risk_level,
    String(s.trust_score),
    String(Math.round(s.scam_probability * 100)),
    s.scam_type ?? "",
    (s.input_text || s.input_url || "").replace(/"/g, '""'),
  ]);
  return [header, ...rows]
    .map((cols) => cols.map((c) => `"${c}"`).join(","))
    .join("\n");
}
