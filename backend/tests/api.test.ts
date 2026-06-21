import { strict as assert } from "node:assert";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";

import { createApp } from "../src/app";

let server: Server;
let base: string;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
});

describe("GET /api/health", () => {
  it("returns 200 with the standard success envelope", async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean; data: { status: string } };
    assert.equal(body.success, true);
    assert.equal(body.data.status, "ok");
  });

  it("sets hardened security headers (helmet)", async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    // helmet sets a CSP and frameguard by default.
    assert.ok(res.headers.get("content-security-policy"));
  });
});

describe("unmatched routes", () => {
  it("returns a 404 error envelope", async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { success: boolean };
    assert.equal(body.success, false);
  });
});
