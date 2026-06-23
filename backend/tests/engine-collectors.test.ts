import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { IntelCache, verdictOf, withCache } from "../src/engine/cache";
import { ageToSignals, parseRdapRegistration } from "../src/engine/collectors/rdap";
import { certCheckToSignals } from "../src/engine/collectors/tls";
import { runCollectors } from "../src/engine/collectors/registry";
import { signalFrom } from "../src/engine/config/weights";
import { normalizeUrl } from "../src/engine/normalize";
import type { Collector } from "../src/engine/collectors/types";
import type { Signal } from "../src/engine/types";

const DAY = 86_400_000;
const ids = (s: Signal[]): string[] => s.map((x) => x.id);

describe("IntelCache", () => {
  it("derives verdicts from signals", () => {
    assert.equal(verdictOf([]), "clean");
    assert.equal(verdictOf([signalFrom("infra.suspicious_tld", "structural", 0.7)]), "unknown");
    assert.equal(verdictOf([signalFrom("ti.gsb.malware", "gsb", 1)]), "malicious");
  });

  it("round-trips and returns a clone (caller can't mutate the entry)", () => {
    const c = new IntelCache();
    const sig = signalFrom("infra.suspicious_tld", "structural", 0.7);
    c.set("k", [sig]);
    const got = c.get("k");
    assert.ok(got);
    got![0].weight = 999;
    assert.notEqual(c.get("k")![0].weight, 999);
  });

  it("misses on an unknown key", () => {
    assert.equal(new IntelCache().get("nope"), null);
  });
});

describe("withCache", () => {
  it("runs fn once then serves from cache", async () => {
    const c = new IntelCache();
    let calls = 0;
    const fn = async (): Promise<Signal[]> => {
      calls++;
      return [signalFrom("infra.no_tls", "structural", 0.6)];
    };
    const first = await withCache(c, "k", fn);
    const second = await withCache(c, "k", fn);
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(calls, 1);
  });
});

describe("RDAP — parseRdapRegistration", () => {
  it("reads the registration event date", () => {
    const d = parseRdapRegistration({ events: [{ eventAction: "registration", eventDate: "2020-01-01T00:00:00Z" }] });
    assert.equal(d?.getUTCFullYear(), 2020);
  });
  it("returns null when there is no registration event", () => {
    assert.equal(parseRdapRegistration({ events: [{ eventAction: "last changed", eventDate: "2024-01-01" }] }), null);
    assert.equal(parseRdapRegistration({}), null);
  });
});

describe("RDAP — ageToSignals (single most-specific bucket)", () => {
  const now = Date.now();
  const at = (days: number): Date => new Date(now - days * DAY);
  it("buckets young domains", () => {
    assert.deepEqual(ids(ageToSignals(at(3), now)), ["domain.age_lt_7d"]);
    assert.deepEqual(ids(ageToSignals(at(20), now)), ["domain.age_lt_30d"]);
    assert.deepEqual(ids(ageToSignals(at(60), now)), ["domain.age_lt_90d"]);
    assert.deepEqual(ids(ageToSignals(at(200), now)), ["domain.age_lt_1y"]);
  });
  it("buckets established domains as trust signals", () => {
    assert.deepEqual(ids(ageToSignals(at(3 * 365), now)), ["domain.age_gt_2y"]);
    assert.deepEqual(ids(ageToSignals(at(6 * 365), now)), ["domain.age_gt_5y"]);
  });
  it("emits nothing for the 1–2 year range", () => {
    assert.deepEqual(ageToSignals(at(500), now), []);
  });
});

describe("TLS — certCheckToSignals", () => {
  it("emits nothing for an authorized cert", () => {
    assert.deepEqual(certCheckToSignals({ authorized: true, error: "" }), []);
  });
  it("flags self-signed", () => {
    assert.deepEqual(ids(certCheckToSignals({ authorized: false, error: "DEPTH_ZERO_SELF_SIGNED_CERT self signed" })), [
      "infra.tls_self_signed",
    ]);
  });
  it("flags hostname mismatch", () => {
    assert.deepEqual(
      ids(certCheckToSignals({ authorized: false, error: "ERR_TLS_CERT_ALTNAME_INVALID Hostname does not match" })),
      ["infra.tls_cn_mismatch"],
    );
  });
  it("ignores other errors (e.g. expired) — no matrix signal", () => {
    assert.deepEqual(certCheckToSignals({ authorized: false, error: "CERT_HAS_EXPIRED" }), []);
  });
});

describe("runCollectors — parallel, fail-open, coverage states", () => {
  const mock = (id: Collector["id"], opts: { applies?: boolean; configured?: boolean; throws?: boolean }): Collector => ({
    id,
    appliesTo: () => opts.applies ?? true,
    isConfigured: () => opts.configured ?? true,
    collect: async () => {
      if (opts.throws) throw new Error("boom");
      return [signalFrom("infra.suspicious_tld", id, 0.7)];
    },
  });

  it("classifies ok / failed / skipped and never throws", async () => {
    const out = await runCollectors(normalizeUrl("http://example.com"), {
      cache: new IntelCache(),
      collectors: [
        mock("gsb", {}), // ok
        mock("virustotal", { throws: true }), // failed
        mock("spamhaus", { configured: false }), // skipped (applies but unconfigured)
        mock("abuseipdb", { applies: false }), // excluded (not applicable)
      ],
    });
    assert.deepEqual(out.queried.sort(), ["gsb", "virustotal"]);
    assert.deepEqual(out.failed, ["virustotal"]);
    assert.deepEqual(out.skipped, ["spamhaus"]);
    assert.equal(out.signals.length, 1); // only gsb produced a signal
  });
});
