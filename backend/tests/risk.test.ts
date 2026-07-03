import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { bandFor, computeRisk } from "../src/threat-engine/risk";
import type { OverrideKind, Signal, SignalCategory, SourceTier } from "../src/threat-engine/types";

/** Compact Signal builder for tests. */
function mk(
  id: string,
  category: SignalCategory,
  weight: number,
  confidence: number,
  sourceTier: SourceTier,
  override?: OverrideKind,
): Signal {
  return { id, category, weight, confidence, sourceTier, label: id, source: "structural", override };
}

const approx = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

describe("bandFor", () => {
  it("maps risk to bands at the thresholds", () => {
    assert.equal(bandFor(80), "critical");
    assert.equal(bandFor(50), "high");
    assert.equal(bandFor(20), "medium");
    assert.equal(bandFor(5), "low");
    assert.equal(bandFor(4), "safe");
  });
});

describe("computeRisk — worked example (docs/trust-engine-architecture.md §4)", () => {
  const signals = [
    mk("content.urgency_threat", "content", 16, 0.9, 3),
    mk("content.kyc_request", "content", 26, 0.9, 3),
    mk("identity.brand_impersonation", "identity", 14, 0.8, 3),
    mk("infra.shortener", "infra", 24, 1.0, 3),
    mk("domain.age_lt_30d", "domain_age", 25, 1.0, 1),
  ];

  it("accumulates to R≈61.5 → high, P≈0.615, T≈38.5", () => {
    const out = computeRisk(signals, 1);
    assert.ok(approx(out.riskScore, 61.5), `riskScore ${out.riskScore}`);
    assert.equal(out.riskLevel, "high");
    assert.ok(approx(out.scamProbability, 0.615));
    assert.ok(approx(out.trustScore, 38.5));
  });

  it("computes confidence ≈ 0.90", () => {
    const out = computeRisk(signals, 1);
    assert.ok(approx(out.confidence, 0.9), `confidence ${out.confidence}`);
  });
});

describe("computeRisk — overrides", () => {
  it("malicious override forces R=100 / critical / confidence≥0.95", () => {
    const out = computeRisk([mk("ti.phishtank.verified", "blocklist", 100, 0.95, 1, "malicious")], 1);
    assert.equal(out.riskScore, 100);
    assert.equal(out.riskLevel, "critical");
    assert.equal(out.override, "malicious");
    assert.ok(out.confidence >= 0.95);
  });

  it("a sub-threshold malicious signal does NOT trigger the override", () => {
    // tier 2 (not 1) → no hard override; scored normally.
    const out = computeRisk([mk("ti.virustotal.ratio_high", "blocklist", 45, 0.95, 2, "malicious")], 1);
    assert.notEqual(out.override, "malicious");
    assert.ok(out.riskScore < 100);
  });

  it("allowlist clamps risk to ≤ 10", () => {
    const out = computeRisk(
      [
        mk("domain.age_lt_30d", "domain_age", 25, 1.0, 1),
        mk("content.credential_request", "content", 32, 1.0, 3),
        mk("content.kyc_request", "content", 26, 1.0, 3),
        mk("reputation.trusted_domain", "reputation", -30, 1.0, 1, "allowlist"),
      ],
      1,
    );
    assert.equal(out.override, "allowlist");
    assert.equal(out.riskScore, 10);
  });

  it("malicious beats allowlist", () => {
    const out = computeRisk(
      [
        mk("reputation.trusted_domain", "reputation", -30, 1.0, 1, "allowlist"),
        mk("ti.gsb.malware", "blocklist", 100, 1.0, 1, "malicious"),
      ],
      1,
    );
    assert.equal(out.override, "malicious");
    assert.equal(out.riskScore, 100);
  });
});

describe("computeRisk — category caps", () => {
  it("caps the content category at 35 even when raw signals exceed it", () => {
    const out = computeRisk(
      [
        mk("content.credential_request", "content", 32, 1.0, 3),
        mk("content.kyc_request", "content", 26, 1.0, 3),
        mk("content.urgency_threat", "content", 16, 1.0, 3),
        mk("content.lottery_prize", "content", 22, 1.0, 3),
        mk("content.job_upfront_fee", "content", 20, 1.0, 3),
      ],
      1,
    );
    assert.equal(out.riskScore, 35);
  });
});

describe("computeRisk — no signals", () => {
  it("returns a safe verdict at zero risk", () => {
    const out = computeRisk([], 1);
    assert.equal(out.riskScore, 0);
    assert.equal(out.riskLevel, "safe");
    assert.equal(out.trustScore, 100);
    assert.equal(out.override, null);
  });
});
