import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Plan } from "@/types";

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadRazorpay(): Promise<boolean> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export type PaidPlan = Extract<Plan, "individual" | "two_person" | "family" | "pro">;

/** Pull the real message out of a supabase-js FunctionsHttpError when possible. */
async function edgeErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (ctx?.json) {
    try {
      const body = (await ctx.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* not JSON */
    }
  }
  return error instanceof Error ? error.message || fallback : fallback;
}

/**
 * Start the Razorpay checkout for a paid plan: create an order via the edge
 * function, open Razorpay, then verify the payment server-side and upgrade.
 */
export async function startCheckout(
  plan: PaidPlan,
  opts: {
    name?: string;
    email?: string;
    onSuccess: () => void;
    onError: (message: string) => void;
    onDismiss?: () => void;
  },
): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { data: order, error } = await supabase.functions.invoke("razorpay-checkout", {
    body: { action: "create_order", plan },
  });
  if (error || !order?.orderId) {
    const msg = error
      ? await edgeErrorMessage(error, "Could not start checkout.")
      : order?.error || "Could not start checkout. Is billing configured?";
    opts.onError(msg);
    return;
  }

  const loaded = await loadRazorpay();
  if (!loaded || !window.Razorpay) {
    opts.onError("Could not load the payment window. Check your connection and try again.");
    return;
  }

  const rzp = new window.Razorpay({
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amount,
    currency: order.currency,
    name: "Neural Shield AI",
    description: "Neural Shield plan upgrade",
    prefill: { name: opts.name, email: opts.email },
    theme: { color: "#00F5D4" },
    modal: { ondismiss: () => opts.onDismiss?.() },
    handler: async (response) => {
      const { data: result, error: vErr } = await supabase.functions.invoke("razorpay-checkout", {
        body: {
          action: "verify",
          plan,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        },
      });
      if (vErr || !result?.success) {
        const msg = vErr
          ? await edgeErrorMessage(vErr, "Payment verification failed.")
          : result?.error || "Payment verification failed. If you were charged, contact support.";
        opts.onError(msg);
        return;
      }
      opts.onSuccess();
    },
  });
  rzp.open();
}
