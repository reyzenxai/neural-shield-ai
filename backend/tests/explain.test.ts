import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  inferScamType,
  parseExplanation,
  templatedExplanation,
  type ExplainInput,
} from "../src/services/ai.service";

const SCORE_KEYS = ["scamProbability", "trustScore", "riskScore", "riskLevel", "confidence"];

describe("parseExplanation — AI can never produce a score", () => {
  it("reads only the narrative fields and DROPS any score the model emits", () => {
    const raw = JSON.stringify({
      summary: "Looks like a phishing attempt.",
      recommendation: "Do not click.",
      scamType: "phishing",
      // a model trying to smuggle a score back in:
      scamProbability: 0.99,
      trustScore: 1,
      riskLevel: "critical",
    });
    const out = parseExplanation(raw);
    assert.deepEqual(Object.keys(out).sort(), ["recommendation", "scamType", "summary"]);
    for (const k of SCORE_KEYS) {
      assert.ok(!(k in out), `explanation must not contain "${k}"`);
    }
  });
});

describe("templatedExplanation — deterministic fallback", () => {
  const base: ExplainInput = {
    entityType: "url",
    verdict: { riskLevel: "high", trustScore: 30, confidence: 0.8 },
    signals: [
      { id: "content.kyc_request", label: "Asks you to update KYC", source: "rule_engine" },
      { id: "infra.shortener", label: "Shortened link hides its destination", source: "structural" },
    ],
    rawContext: "update your kyc at bit.ly/x",
  };

  it("returns only narrative fields (no numeric score keys)", () => {
    const out = templatedExplanation(base);
    assert.deepEqual(Object.keys(out).sort(), ["recommendation", "scamType", "summary"]);
    for (const k of SCORE_KEYS) assert.ok(!(k in out));
  });

  it("summarizes the evidence and infers a scam type", () => {
    const out = templatedExplanation(base);
    assert.ok(out.summary.includes("2 risk indicators"));
    assert.equal(out.scamType, "fake_kyc");
    assert.ok(out.recommendation.length > 0);
  });

  it("handles the no-signal case honestly", () => {
    const out = templatedExplanation({ ...base, signals: [], verdict: { riskLevel: "safe", trustScore: 100, confidence: 0.6 } });
    assert.ok(out.summary.toLowerCase().includes("couldn't find"));
    assert.equal(out.scamType, null);
  });
});

describe("inferScamType", () => {
  it("maps signal ids to advisory labels", () => {
    assert.equal(inferScamType(["content.credential_request"]), "phishing");
    assert.equal(inferScamType(["content.lottery_prize"]), "lottery_fraud");
    assert.equal(inferScamType(["pay.upi_unknown_psp"]), "upi_fraud");
    assert.equal(inferScamType(["content.too_good_returns"]), "fake_investment");
    assert.equal(inferScamType([]), null);
  });
});
