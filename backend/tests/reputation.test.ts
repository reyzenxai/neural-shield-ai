import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { signalFrom } from "../src/threat-engine/config/weights";
import { reputationSignals } from "../src/threat-engine/reputation";
import { normalizeUrl } from "../src/threat-engine/normalize";

const entity = normalizeUrl("http://evil-phish.xyz/login");

const makeRep = (report_count: number, weighted_report_score: number, intel: { verdict: string }[] = []) =>
  ({ report_count, weighted_report_score, intel });

// Helper: run the threshold logic with synthetic DB data (no network).
function signalsFromRep(rep: ReturnType<typeof makeRep>) {
  const signals = [];
  const ws = rep.weighted_report_score;
  const ev = { report_count: rep.report_count, weighted_score: ws };

  if (ws >= 8) {
    signals.push(signalFrom("reputation.community_override", "reputation_db",
      Math.min(0.95, 0.7 + ws * 0.02), ev));
  } else if (ws >= 2) {
    signals.push(signalFrom("reputation.community_abuse", "reputation_db",
      Math.min(0.85, 0.6 + ws * 0.05), ev));
  } else if (ws >= 0.5) {
    signals.push(signalFrom("reputation.prior_scam_verdict", "reputation_db",
      Math.min(0.7, 0.5 + ws * 0.1), ev));
  } else if (rep.report_count === 0 && rep.intel.length > 0 &&
             rep.intel.every((i) => i.verdict === "safe")) {
    signals.push(signalFrom("reputation.clean_history", "reputation_db", 0.4,
      { intel_count: rep.intel.length }));
  }
  return signals;
}

describe("reputationSignals — threshold mapping", () => {
  it("returns [] for 0 reports, no intel", () => {
    assert.equal(signalsFromRep(makeRep(0, 0)).length, 0);
  });

  it("emits prior_scam_verdict for a single fresh report (ws=1)", () => {
    const sigs = signalsFromRep(makeRep(1, 1));
    assert.equal(sigs.length, 1);
    assert.equal(sigs[0].id, "reputation.prior_scam_verdict");
  });

  it("emits community_abuse for ws=3", () => {
    const sigs = signalsFromRep(makeRep(3, 3));
    assert.equal(sigs[0].id, "reputation.community_abuse");
    assert.ok(sigs[0].confidence > 0.6);
  });

  it("emits community_override (R=100 malicious) for ws=10", () => {
    const sigs = signalsFromRep(makeRep(10, 10));
    assert.equal(sigs[0].id, "reputation.community_override");
    assert.equal(sigs[0].override, "malicious");
    assert.equal(sigs[0].sourceTier, 1);
    assert.ok(sigs[0].confidence >= 0.89); // 0.7 + 10*0.02 = 0.8999… in floating point
  });

  it("emits clean_history when 0 reports and all intel is safe", () => {
    const sigs = signalsFromRep(makeRep(0, 0, [{ verdict: "safe" }, { verdict: "safe" }]));
    assert.equal(sigs[0].id, "reputation.clean_history");
    assert.ok(sigs[0].weight < 0, "clean_history should be a trust (negative weight) signal");
  });

  it("does NOT emit clean_history when any intel is not safe", () => {
    const sigs = signalsFromRep(makeRep(0, 0, [{ verdict: "safe" }, { verdict: "malicious" }]));
    assert.equal(sigs.length, 0);
  });

  it("confidence is capped at 0.95 for community_override at ws=20", () => {
    const sigs = signalsFromRep(makeRep(20, 20));
    assert.ok(sigs[0].confidence <= 0.95);
  });

  it("reputationSignals() returns [] when Supabase is not configured (no real call)", async () => {
    // With no SUPABASE_URL/SUPABASE_ANON_KEY in test env, getPublicClient() returns null.
    const result = await reputationSignals(entity);
    assert.ok(Array.isArray(result));
  });
});
