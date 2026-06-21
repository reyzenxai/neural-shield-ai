import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  EmailScanSchema,
  MessageScanSchema,
  PhoneScanSchema,
  UpiScanSchema,
  UrlScanSchema,
} from "../src/schemas/scan.schemas";

describe("MessageScanSchema", () => {
  it("accepts a valid message and strips HTML tags", () => {
    const out = MessageScanSchema.parse({ text: "  <b>Your KYC will expire today</b>, verify now  " });
    assert.equal(out.text, "Your KYC will expire today, verify now");
  });

  it("rejects too-short input (after trim/strip)", () => {
    assert.throws(() => MessageScanSchema.parse({ text: "hi" }));
  });

  it("rejects missing text", () => {
    assert.throws(() => MessageScanSchema.parse({}));
  });
});

describe("UrlScanSchema", () => {
  it("accepts a valid URL", () => {
    assert.equal(UrlScanSchema.parse({ url: " https://sbi-kyc-verify.example.com " }).url, "https://sbi-kyc-verify.example.com");
  });

  it("rejects a non-URL", () => {
    assert.throws(() => UrlScanSchema.parse({ url: "not a url" }));
  });
});

describe("PhoneScanSchema", () => {
  it("normalizes spaces / dashes / parens and accepts an Indian number", () => {
    assert.equal(PhoneScanSchema.parse({ phone: "+91 98765-43210" }).phone, "+919876543210");
  });

  it("rejects clearly invalid numbers", () => {
    assert.throws(() => PhoneScanSchema.parse({ phone: "abc" }));
  });
});

describe("UpiScanSchema", () => {
  it("lowercases and accepts a valid UPI id", () => {
    assert.equal(UpiScanSchema.parse({ upiId: "Name@OKAXIS" }).upiId, "name@okaxis");
  });

  it("rejects a malformed UPI id", () => {
    assert.throws(() => UpiScanSchema.parse({ upiId: "nope" }));
  });
});

describe("EmailScanSchema", () => {
  it("accepts body with optional subject/sender defaulted", () => {
    const out = EmailScanSchema.parse({ body: "Dear customer, your account is blocked." });
    assert.equal(out.subject, "");
    assert.equal(out.sender, "");
    assert.ok(out.body.length >= 5);
  });

  it("rejects too-short body", () => {
    assert.throws(() => EmailScanSchema.parse({ body: "hi" }));
  });
});
