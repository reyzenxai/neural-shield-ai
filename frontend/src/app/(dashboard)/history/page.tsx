"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  Search,
  Trash2,
} from "lucide-react";

import { Badge, riskBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDeleteScans, useScans } from "@/hooks/useScans";
import { scanPreview, scansToCsv } from "@/lib/scans";
import { cn, timeAgo } from "@/lib/utils";
import type { RiskLevel, ScanRowWithFlags, ScanType } from "@/types";

const PAGE_SIZE = 20;
const RISKS: RiskLevel[] = ["safe", "low", "medium", "high", "critical"];
const TYPES: ScanType[] = ["message", "url", "email", "screenshot", "qr", "phone", "upi"];
const RANGES = [
  { label: "All time", ms: Infinity },
  { label: "Last 24h", ms: 24 * 3600_000 },
  { label: "Last 7 days", ms: 7 * 24 * 3600_000 },
  { label: "Last 30 days", ms: 30 * 24 * 3600_000 },
];

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-muted-foreground/50",
  warning: "bg-warning",
  danger: "bg-danger",
};

export default function HistoryPage() {
  const { data: scans, isLoading } = useScans();
  const deleteScans = useDeleteScans();

  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [type, setType] = useState<ScanType | "all">("all");
  const [rangeIdx, setRangeIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Relative-time filtering is intentionally evaluated at render time.
    // eslint-disable-next-line react-hooks/purity
    const cutoff = Date.now() - RANGES[rangeIdx].ms;
    return (scans ?? []).filter((s) => {
      if (risk !== "all" && s.risk_level !== risk) return false;
      if (type !== "all" && s.scan_type !== type) return false;
      if (RANGES[rangeIdx].ms !== Infinity && new Date(s.created_at).getTime() < cutoff) return false;
      if (q) {
        const hay = `${s.input_text ?? ""} ${s.input_url ?? ""} ${s.scam_type ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scans, search, risk, type, rangeIdx]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((s) => selected.has(s.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageRows.forEach((s) => next.delete(s.id));
      else pageRows.forEach((s) => next.add(s.id));
      return next;
    });
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const resetPage = () => setPage(0);

  const exportCsv = () => {
    const csv = scansToCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neural-shield-scans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDeleteSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    await deleteScans.mutateAsync(ids);
    setSelected(new Set());
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every scan you&apos;ve run, searchable and exportable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={onDeleteSelected} loading={deleteScans.isPending}>
              <Trash2 className="h-4 w-4" /> Delete ({selected.size})
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card variant="glass" className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              placeholder="Search content or scam type…"
              className="pl-9"
              aria-label="Search scans"
            />
          </div>
          <Select value={risk} onChange={(v) => { setRisk(v as RiskLevel | "all"); resetPage(); }} options={[["all", "All risks"], ...RISKS.map((r) => [r, cap(r)] as const)]} />
          <Select value={type} onChange={(v) => { setType(v as ScanType | "all"); resetPage(); }} options={[["all", "All types"], ...TYPES.map((t) => [t, cap(t)] as const)]} />
          <Select
            value={String(rangeIdx)}
            onChange={(v) => { setRangeIdx(Number(v)); resetPage(); }}
            options={RANGES.map((r, i) => [String(i), r.label] as const)}
          />
        </div>
      </Card>

      {/* Table */}
      <Card variant="glass" className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty hasScans={(scans ?? []).length > 0} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="w-10 py-3 pl-5">
                    <Checkbox checked={allOnPageSelected} onChange={toggleAll} aria-label="Select all on page" />
                  </th>
                  <th className="py-3 pr-3 font-medium">Type</th>
                  <th className="py-3 pr-3 font-medium">Preview</th>
                  <th className="py-3 pr-3 font-medium">Risk</th>
                  <th className="py-3 pr-3 text-right font-medium">Trust</th>
                  <th className="py-3 pr-3 text-right font-medium">When</th>
                  <th className="w-10 py-3 pr-5" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <Row
                    key={s.id}
                    scan={s}
                    selected={selected.has(s.id)}
                    onSelect={() => toggleOne(s.id)}
                    expanded={expanded === s.id}
                    onToggle={() => setExpanded((e) => (e === s.id ? null : s.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
              Previous
            </Button>
            <span className="font-mono text-xs">
              {safePage + 1} / {pageCount}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  scan,
  selected,
  onSelect,
  expanded,
  onToggle,
}: {
  scan: ScanRowWithFlags;
  selected: boolean;
  onSelect: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={cn("border-b border-border/40 transition-colors hover:bg-card/30", selected && "bg-primary/5")}>
        <td className="py-2.5 pl-5">
          <Checkbox checked={selected} onChange={onSelect} aria-label="Select scan" />
        </td>
        <td className="py-2.5 pr-3">
          <span className="rounded-md bg-card/60 px-2 py-0.5 font-mono text-[11px] capitalize text-muted-foreground">
            {scan.scan_type}
          </span>
        </td>
        <td className="max-w-[280px] truncate py-2.5 pr-3 text-foreground/90">{scanPreview(scan)}</td>
        <td className="py-2.5 pr-3">
          <Badge variant={riskBadgeVariant(scan.risk_level)} size="sm">
            {scan.risk_level}
          </Badge>
        </td>
        <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground">{scan.trust_score}</td>
        <td className="py-2.5 pr-3 text-right text-muted-foreground">{timeAgo(scan.created_at)}</td>
        <td className="py-2.5 pr-5 text-right">
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/40 bg-background/30">
          <td colSpan={7} className="px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">Input</div>
                <p className="rounded-xl border border-border bg-background/40 p-3 text-sm text-foreground/90">
                  {scan.input_text || scan.input_url || scan.input_file_path || "-"}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
                  <span>scam {Math.round(scan.scam_probability * 100)}%</span>
                  <span>model · {scan.ai_model}</span>
                  {scan.scam_type && <span>type · {scan.scam_type}</span>}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  Flags ({scan.scan_flags.length})
                </div>
                {scan.scan_flags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No flags recorded.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {scan.scan_flags.map((f) => (
                      <li key={f.id} className="flex gap-2 text-sm">
                        <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[f.severity])} />
                        <span className="text-foreground/90">{f.flag}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 rounded-xl border border-border bg-background/40 px-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v} className="bg-background text-foreground">
          {label}
        </option>
      ))}
    </select>
  );
}

function Empty({ hasScans }: { hasScans: boolean }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="font-display text-base font-semibold">
        {hasScans ? "No scans match your filters" : "No scans yet"}
      </div>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        {hasScans ? "Try clearing the search or filters." : "Run your first scan to start building history."}
      </p>
      {!hasScans && (
        <Button asChild variant="primary" size="sm" className="mt-4">
          <Link href="/analyzer/message">Scan a message</Link>
        </Button>
      )}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
