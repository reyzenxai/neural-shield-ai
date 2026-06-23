import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  detectType,
  entityFromScan,
  extractEntities,
  normalizePhone,
  normalizeUpi,
  normalizeUrl,
  registrableDomain,
} from "../src/engine/normalize";

describe("registrableDomain (eTLD+1)", () => {
  it("handles plain two-label domains", () => {
    assert.equal(registrableDomain("example.com"), "example.com");
    assert.equal(registrableDomain("www.example.com"), "example.com");
  });
  it("handles multi-label public suffixes", () => {
    assert.equal(registrableDomain("a.b.example.co.in"), "example.co.in");
    assert.equal(registrableDomain("login.sbi.co.in"), "sbi.co.in");
  });
  it("returns IPs as-is", () => {
    assert.equal(registrableDomain("192.168.0.1"), "192.168.0.1");
  });
});

describe("normalizeUrl", () => {
  it("lowercases the host and strips tracking params + fragment", () => {
    const e = normalizeUrl("HTTP://Example.com/path?utm_source=x&id=1#frag");
    assert.equal(e.value, "http://example.com/path?id=1");
    assert.equal(e.parts.host, "example.com");
    assert.equal(e.parts.domain, "example.com");
    assert.equal(e.parts.scheme, "http");
  });
  it("parses a bare host by assuming http://", () => {
    const e = normalizeUrl("bit.ly/abc");
    assert.equal(e.parts.host, "bit.ly");
    assert.equal(e.parts.domain, "bit.ly");
  });
});

describe("normalizePhone (India-first E.164)", () => {
  it("prefixes +91 for a bare 10-digit mobile", () => {
    assert.equal(normalizePhone("98765 43210").value, "+919876543210");
  });
  it("keeps an explicit +91 and strips separators", () => {
    assert.equal(normalizePhone("+91 98765-43210").value, "+919876543210");
  });
  it("drops a leading 0 on an 11-digit number", () => {
    assert.equal(normalizePhone("09876543210").value, "+919876543210");
  });
});

describe("normalizeUpi", () => {
  it("lowercases and extracts the PSP suffix", () => {
    const e = normalizeUpi("Name@OKSBI");
    assert.equal(e.value, "name@oksbi");
    assert.equal(e.parts.psp, "oksbi");
  });
});

describe("detectType", () => {
  it("classifies common inputs", () => {
    assert.equal(detectType("https://x.com"), "url");
    assert.equal(detectType("user@gmail.com"), "email");
    assert.equal(detectType("name@oksbi"), "upi");
    assert.equal(detectType("+919876543210"), "phone");
    assert.equal(detectType("9876543210"), "phone");
    assert.equal(detectType("example.com"), "domain");
    assert.equal(detectType("hello there, are we on?"), "text");
  });
});

describe("extractEntities", () => {
  it("pulls URLs, UPI IDs and emails out of text without cross-contamination", () => {
    const r = extractEntities("pay at bit.ly/x to name@oksbi, contact me@gmail.com");
    assert.ok(r.urls.includes("bit.ly/x"));
    assert.ok(r.upis.includes("name@oksbi"));
    assert.ok(r.emails.includes("me@gmail.com"));
    // the email's domain must NOT be picked up as a standalone URL
    assert.ok(!r.urls.includes("gmail.com"));
  });
});

describe("entityFromScan", () => {
  it("treats a composed email blob as text, not a bare address", () => {
    const e = entityFromScan("email", "From: a@b.com\nSubject: hi\n\nbody text");
    assert.equal(e.type, "text");
  });
  it("normalizes a url scan", () => {
    const e = entityFromScan("url", "https://Example.com/");
    assert.equal(e.type, "url");
    assert.equal(e.parts.domain, "example.com");
  });
});
