import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Pure-logic tests for the batch type-mapping and response shapes —
// no network, no DB, no engine call.

type BatchEntityType = "url" | "domain" | "email" | "phone" | "upi" | "text";
type ScanType = "url" | "message" | "email" | "phone" | "upi";

const TYPE_TO_SCAN: Record<BatchEntityType, ScanType> = {
  url: "url",
  domain: "url",
  email: "email",
  phone: "phone",
  upi: "upi",
  text: "message",
};

describe("extension batch — type mapping", () => {
  it("maps url → url", () => assert.equal(TYPE_TO_SCAN["url"], "url"));
  it("maps domain → url", () => assert.equal(TYPE_TO_SCAN["domain"], "url"));
  it("maps email → email", () => assert.equal(TYPE_TO_SCAN["email"], "email"));
  it("maps phone → phone", () => assert.equal(TYPE_TO_SCAN["phone"], "phone"));
  it("maps upi → upi", () => assert.equal(TYPE_TO_SCAN["upi"], "upi"));
  it("maps text → message", () => assert.equal(TYPE_TO_SCAN["text"], "message"));
});

describe("extension batch — input validation", () => {
  function validate(entities: unknown[]): { ok: boolean; error?: string } {
    if (!Array.isArray(entities) || entities.length === 0) return { ok: false, error: "empty" };
    if (entities.length > 10) return { ok: false, error: "max 10" };
    const VALID_TYPES = new Set(["url", "domain", "email", "phone", "upi", "text"]);
    for (const e of entities) {
      if (typeof e !== "object" || e === null) return { ok: false, error: "not object" };
      const { type, value } = e as Record<string, unknown>;
      if (!VALID_TYPES.has(String(type))) return { ok: false, error: "bad type" };
      if (typeof value !== "string" || value.length === 0 || value.length > 2048)
        return { ok: false, error: "bad value" };
    }
    return { ok: true };
  }

  it("accepts valid batch of 1", () => assert.ok(validate([{ type: "url", value: "https://a.com" }]).ok));
  it("accepts max batch of 10", () =>
    assert.ok(validate(Array.from({ length: 10 }, (_, i) => ({ type: "url", value: `https://${i}.com` }))).ok));
  it("rejects empty array", () => assert.equal(validate([]).ok, false));
  it("rejects 11 entities", () =>
    assert.equal(validate(Array.from({ length: 11 }, () => ({ type: "url", value: "x" }))).ok, false));
  it("rejects unknown type", () => assert.equal(validate([{ type: "ip", value: "1.1.1.1" }]).ok, false));
  it("rejects empty value", () => assert.equal(validate([{ type: "url", value: "" }]).ok, false));
  it("rejects value > 2048 chars", () =>
    assert.equal(validate([{ type: "url", value: "a".repeat(2049) }]).ok, false));
});

describe("extension config shape", () => {
  const BAND_THRESHOLDS = { critical: 80, high: 50, medium: 20, low: 5 };

  function buildConfig(engineV2: boolean) {
    return {
      engineVersion: "trust-engine@2.0.0",
      engineV2,
      thresholds: BAND_THRESHOLDS,
      maxBatchSize: 10,
      supportedTypes: ["url", "domain", "email", "phone", "upi", "text"],
    };
  }

  it("config has all required fields", () => {
    const cfg = buildConfig(true);
    assert.ok(cfg.engineVersion);
    assert.equal(cfg.maxBatchSize, 10);
    assert.equal(cfg.supportedTypes.length, 6);
  });

  it("critical threshold is highest", () => {
    assert.ok(BAND_THRESHOLDS.critical > BAND_THRESHOLDS.high);
    assert.ok(BAND_THRESHOLDS.high > BAND_THRESHOLDS.medium);
    assert.ok(BAND_THRESHOLDS.medium > BAND_THRESHOLDS.low);
  });

  it("reflects engineV2 flag correctly (true)", () => assert.equal(buildConfig(true).engineV2, true));
  it("reflects engineV2 flag correctly (false)", () => assert.equal(buildConfig(false).engineV2, false));
});
