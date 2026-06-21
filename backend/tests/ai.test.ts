import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { clampNumber, extractJson, normalize } from "../src/services/ai.service";

describe("clampNumber", () => {
  it("clamps within range", () => {
    assert.equal(clampNumber(5, 0, 10, 0), 5);
    assert.equal(clampNumber(-3, 0, 10, 0), 0);
    assert.equal(clampNumber(99, 0, 10, 0), 10);
  });

  it("falls back for non-finite / wrong-typed input", () => {
    assert.equal(clampNumber("nope", 0, 1, 0.5), 0.5);
    assert.equal(clampNumber(NaN, 0, 1, 0.5), 0.5);
    assert.equal(clampNumber(undefined, 0, 100, 50), 50);
    assert.equal(clampNumber(Infinity, 0, 1, 0.5), 0.5);
  });
});

describe("extractJson", () => {
  it("reads a raw JSON object", () => {
    assert.equal(extractJson('{"a":1}'), '{"a":1}');
  });

  it("strips ```json fences", () => {
    const raw = '```json\n{"a":1}\n```';
    assert.equal(JSON.parse(extractJson(raw)).a, 1);
  });

  it("extracts the object from surrounding prose", () => {
    const raw = 'Here is the result:\n{"riskLevel":"high"} — done.';
    assert.equal(JSON.parse(extractJson(raw)).riskLevel, "high");
  });

  it("throws when there is no JSON object", () => {
    assert.throws(() => extractJson("no json here"));
  });
});

describe("normalize", () => {
  it("passes through a well-formed result", () => {
    const out = normalize({
      scamProbability: 0.92,
      trustScore: 8,
      riskLevel: "critical",
      scamType: "fake_kyc",
      flags: [{ flag: "urgency", severity: "danger", description: "creates panic" }],
      recommendation: "Do not click.",
      detailedAnalysis: "Classic KYC scam.",
    });
    assert.equal(out.scamProbability, 0.92);
    assert.equal(out.trustScore, 8);
    assert.equal(out.riskLevel, "critical");
    assert.equal(out.scamType, "fake_kyc");
    assert.equal(out.flags.length, 1);
  });

  it("defaults an invalid riskLevel to 'medium'", () => {
    assert.equal(normalize({ riskLevel: "apocalyptic" }).riskLevel, "medium");
  });

  it("clamps out-of-range probability and rounds/clamps trustScore", () => {
    const out = normalize({ scamProbability: 5, trustScore: 250.7 });
    assert.equal(out.scamProbability, 1);
    assert.equal(out.trustScore, 100);
  });

  it("coerces a null scamType and supplies safe defaults", () => {
    const out = normalize({});
    assert.equal(out.scamType, null);
    assert.equal(out.scamProbability, 0.5); // fallback
    assert.equal(out.trustScore, 50); // fallback
    assert.ok(out.recommendation.length > 0);
  });

  it("filters non-object flags and defaults a bad severity to 'warning'", () => {
    const out = normalize({
      flags: [
        null,
        "garbage",
        { flag: "x", severity: "explosive", description: "y" },
      ],
    });
    assert.equal(out.flags.length, 1);
    assert.equal(out.flags[0].severity, "warning");
  });
});
