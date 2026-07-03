import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { entityFromScan, normalizeUpi } from "../src/threat-engine/normalize";
import { runRules, runUpiRules } from "../src/threat-engine/rules";

const ids = (text: string): string[] => runRules(entityFromScan("message", text), text).map((s) => s.id);

describe("runRules — content signals", () => {
  it("fires credential + kyc + urgency on the SBI KYC sample", () => {
    const got = ids(
      "Dear customer, your SBI account will be BLOCKED today. Complete KYC immediately or share your OTP.",
    );
    assert.ok(got.includes("content.credential_request"));
    assert.ok(got.includes("content.kyc_request"));
    assert.ok(got.includes("content.urgency_threat"));
    assert.ok(got.includes("identity.brand_impersonation"));
  });

  it("fires lottery on the KBC sample", () => {
    assert.ok(ids("Congratulations! You WON 25,00,000 in the KBC Lucky Draw.").includes("content.lottery_prize"));
  });

  it("fires job-fee on the work-from-home sample", () => {
    assert.ok(
      ids("Part-time work from home job, earn daily income. Pay a small joining fee to register.").includes(
        "content.job_upfront_fee",
      ),
    );
  });

  it("does NOT fire on a benign message", () => {
    assert.equal(ids("Hey, are we still on for the 7pm movie on Saturday?").length, 0);
  });
});

describe("runUpiRules", () => {
  it("flags an unknown PSP", () => {
    const got = runUpiRules(normalizeUpi("someone@randompsp")).map((s) => s.id);
    assert.ok(got.includes("pay.upi_unknown_psp"));
  });

  it("flags brand impersonation in the handle", () => {
    const got = runUpiRules(normalizeUpi("sbi.refund@oksbi")).map((s) => s.id);
    assert.ok(got.includes("pay.upi_brand_impersonation"));
  });

  it("does not flag a clean VPA on a known PSP", () => {
    const got = runUpiRules(normalizeUpi("rahul@oksbi")).map((s) => s.id);
    assert.equal(got.length, 0);
  });
});
