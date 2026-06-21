/**
 * Trust Engine v2 — shared types.
 *
 * The engine produces every numeric score deterministically from Signals. The AI
 * never produces a number (see docs/trust-engine-redesign.md §1). This contract is
 * intended to be shared with the Chrome extension (docs/chrome-extension.md).
 */

import type { RiskLevel, ScanFlag } from "../types";

/** Entity kinds the engine can normalize and score. */
export type EntityType = "url" | "domain" | "email" | "phone" | "upi" | "ip" | "text";

/** Signal categories — each has a cap in the scoring matrix (docs/scoring-matrix.md §1). */
export type SignalCategory =
  | "blocklist" // ti.*
  | "domain_age" // domain.*
  | "infra" // infra.*
  | "content" // content.*
  | "identity" // identity.*
  | "reputation" // reputation.*
  | "pay"; // pay.*

/** Who emitted a signal — feeds the source-tier reliability multiplier. */
export type SourceId =
  | "rule_engine"
  | "structural"
  | "reputation_db"
  | "gsb"
  | "virustotal"
  | "phishtank"
  | "openphish"
  | "urlhaus"
  | "spamhaus"
  | "abuseipdb"
  | "rdap"
  | "dns"
  | "tls";

export type SourceTier = 1 | 2 | 3;

/** Deterministic verdict shortcuts (docs/scoring-matrix.md §2). */
export type OverrideKind = "malicious" | "allowlist";

/**
 * One typed fact contributing to the risk score. The full Signal[] of a scan IS its
 * audit trail and is persisted to `scan_signals` (docs/reputation-database.md).
 */
export interface Signal {
  /** Stable key, e.g. "content.kyc_request", "infra.shortener". */
  id: string;
  category: SignalCategory;
  /** Signed base weight from the scoring matrix (+ raises risk, − raises trust). */
  weight: number;
  /** This signal's own certainty, 0–1. */
  confidence: number;
  /** Short human-readable label (used for flags + the templated explanation). */
  label: string;
  source: SourceId;
  sourceTier: SourceTier;
  /** Set when this signal can shortcut the verdict. */
  override?: OverrideKind;
  /** Raw proof, persisted for reproducibility (e.g. { ageDays: 4 }). */
  evidence?: Record<string, unknown>;
  /** True when the signal came from an extracted sub-entity (a link inside a message). */
  fromSubEntity?: boolean;
}

/** A normalized, canonical entity ready for collection. */
export interface Entity {
  type: EntityType;
  /** Canonical form used as the cache/reputation key. */
  value: string;
  /** The original, untrimmed input. */
  raw: string;
  parts: {
    host?: string; // full host for url
    domain?: string; // registrable domain (eTLD+1) for url/email
    tld?: string;
    scheme?: string;
    local?: string; // email local part
    psp?: string; // UPI handle suffix
    e164?: string; // normalized phone
  };
}

/** Output of the evidence-collection stage for one entity (+ its sub-entities). */
export interface CollectionResult {
  entity: Entity;
  signals: Signal[];
  sourcesQueried: SourceId[];
  sourcesFailed: SourceId[];
  subEntities: CollectionResult[];
}

/** Why a verdict came out the way it did — persisted for audit. */
export interface DecisionTrace {
  override: OverrideKind | null;
  firedRuleIds: string[];
  sourcesQueried: SourceId[];
  sourcesFailed: SourceId[];
}

/** The numbers, decided ONLY by the engine. */
export interface RiskOutput {
  riskScore: number; // R, 0–100
  scamProbability: number; // P, 0–1
  trustScore: number; // T, 0–100
  confidence: number; // C, 0–1
  riskLevel: RiskLevel;
  verdictLabel: string;
  override: OverrideKind | null;
}

/**
 * Extended scan result (docs/trust-engine-redesign.md §5). Extends the legacy
 * ScanResult so existing persistence + frontend keep working (additive, non-breaking).
 */
export interface ScanResultV2 {
  // ── decided by the engine (NOT the AI) ──
  scamProbability: number;
  trustScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  verdictLabel: string;
  signals: Signal[];
  decisionTrace: DecisionTrace;
  flags: ScanFlag[]; // derived from signals for frontend back-compat

  // ── written by the AI (explanation only) ──
  summary: string;
  recommendation: string;
  scamType: string | null;
  /** Legacy alias of `summary` so existing ScanResult consumers keep working. */
  detailedAnalysis: string;

  // ── metadata ──
  aiModel: string;
  engineVersion: string;
  processingTimeMs: number;
  cached: boolean;
}
