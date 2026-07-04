// Neural Shield AI — Razorpay checkout edge function.
//
// Holds the Razorpay secret + the Supabase service role. The Express backend and
// the browser never see the secret. Two actions:
//   create_order — creates a Razorpay order for a paid plan (amounts are fixed
//                  server-side, so a client cannot tamper with the price).
//   verify       — verifies the HMAC payment signature, then upgrades the user's
//                  plan + records the subscription. Plan changes ONLY happen here
//                  (decision D9: the `plan` column is revoked from users).
//
// Activate by setting RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET as edge-function
// secrets. Until then the function returns 503 and the UI shows a clear message.
//
// Deploy: supabase functions deploy razorpay-checkout

import { createClient } from "jsr:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

// Paise. Mirrors the current plan catalog in packages/config (PLANS). The old map
// referenced a removed `business` plan and a stale `pro` price; this keeps the
// dormant gateway from mis-pricing or offering a non-existent plan if reactivated.
// Keep in sync with packages/config PLANS.
const PRICES: Record<string, number> = {
  individual: 14900,
  two_person: 21900,
  family: 29900,
  pro: 49900,
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ error: "Razorpay is not configured on the server." }, 503);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as {
      action?: string;
      plan?: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (body.action === "create_order") {
      const amount = PRICES[body.plan ?? ""];
      if (!amount) return json({ error: "Invalid plan" }, 400);
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency: "INR",
          receipt: `ns_${user.id.slice(0, 8)}_${Date.now()}`,
          notes: { user_id: user.id, plan: body.plan },
        }),
      });
      const order = await res.json();
      if (!res.ok) return json({ error: order?.error?.description ?? "Order creation failed" }, 502);
      return json({ orderId: order.id, amount, currency: "INR", keyId });
    }

    if (body.action === "verify") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !PRICES[plan ?? ""]) {
        return json({ error: "Missing or invalid fields" }, 400);
      }
      const expected = createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      if (expected !== razorpay_signature) return json({ error: "Invalid payment signature" }, 400);

      await admin.from("profiles").update({ plan }).eq("id", user.id);
      await admin.from("subscriptions").upsert(
        {
          user_id: user.id,
          plan,
          status: "active",
          razorpay_subscription_id: razorpay_payment_id,
          expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        },
        { onConflict: "user_id" },
      );
      return json({ success: true, plan });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
