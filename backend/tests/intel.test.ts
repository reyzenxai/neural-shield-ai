import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { parseGsb } from "../src/engine/intel/gsb";
import { normalizeForFeed, openphishMatch } from "../src/engine/intel/openphish";
import { parsePhishtank } from "../src/engine/intel/phishtank";
import { parseUrlhaus } from "../src/engine/intel/urlhaus";
import { computeRisk } from "../src/engine/risk";
import type { Signal } from "../src/engine/types";

const ids = (s: Signal[]): string[] => s.map((x) => x.id);

describe("parseGsb", () => {
  it("maps threat types to override signals", () => {
    assert.deepEqual(ids(parseGsb({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] })), ["ti.gsb.social_engineering"]);
    assert.deepEqual(ids(parseGsb({ matches: [{ threatType: "MALWARE" }] })), ["ti.gsb.malware"]);
    assert.deepEqual(ids(parseGsb({ matches: [{ threatType: "UNWANTED_SOFTWARE" }] })), ["ti.gsb.malware"]);
    assert.deepEqual(parseGsb({}), []);
  });
});

describe("parseUrlhaus", () => {
  it("flags a known-bad URL only on query_status=ok", () => {
    assert.deepEqual(ids(parseUrlhaus({ query_status: "ok", threat: "malware_download" })), ["ti.urlhaus.malware"]);
    assert.deepEqual(parseUrlhaus({ query_status: "no_results" }), []);
  });
});

describe("parsePhishtank", () => {
  it("flags verified, in-database, valid phish (confidence scales with verified)", () => {
    const verified = parsePhishtank({ results: { in_database: true, valid: true, verified: true } });
    assert.deepEqual(ids(verified), ["ti.phishtank.verified"]);
    assert.equal(verified[0].confidence, 1);
    const unverified = parsePhishtank({ results: { in_database: true, valid: true, verified: false } });
    assert.equal(unverified[0].confidence, 0.9);
    assert.deepEqual(parsePhishtank({ results: { in_database: false } }), []);
  });
});

describe("openphishMatch", () => {
  const feed = new Set(["http://evil.example/login", "http://bad.test"].map(normalizeForFeed));
  it("matches regardless of trailing slash / case", () => {
    assert.equal(openphishMatch(feed, "http://evil.example/login"), true);
    assert.equal(openphishMatch(feed, "HTTP://Evil.Example/login/"), true);
    assert.equal(openphishMatch(feed, "http://good.example"), false);
  });
});

describe("override wiring — a TI parser result drives R=100", () => {
  it("GSB malware → malicious override → critical", () => {
    const out = computeRisk(parseGsb({ matches: [{ threatType: "MALWARE" }] }), 1);
    assert.equal(out.riskScore, 100);
    assert.equal(out.riskLevel, "critical");
    assert.equal(out.override, "malicious");
  });
});
