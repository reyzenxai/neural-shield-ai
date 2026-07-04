import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PlanId } from "@neural-shield/config";

export interface PaymentRequest {
  id: string;
  plan: string;
  amount_inr: number;
  reference_note: string;
  upi_reference: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  review_note: string | null;
}

async function currentUserId(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

/** A short unique note the user adds to their UPI payment so it can be matched. */
export function makeReference(): string {
  return "NS" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Upload the screenshot and create a pending payment request. */
export async function submitPaymentRequest(input: {
  plan: PlanId;
  amountInr: number;
  referenceNote: string;
  upiReference: string;
  file: File;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const uid = await currentUserId();

  const ext = (input.file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${uid}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("payment-proofs")
    .upload(path, input.file, { upsert: false, contentType: input.file.type || "image/jpeg" });
  if (upErr) throw upErr;

  const { error } = await supabase.from("payment_requests").insert({
    user_id: uid,
    plan: input.plan,
    amount_inr: input.amountInr,
    reference_note: input.referenceNote,
    upi_reference: input.upiReference,
    screenshot_path: path,
    status: "pending",
  });
  if (error) throw error;
}

/** The user's most recent payment request, used to show a pending/approved state. */
export async function getMyLatestPayment(): Promise<PaymentRequest | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("payment_requests")
    .select("id, plan, amount_inr, reference_note, upi_reference, status, created_at, review_note")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentRequest) ?? null;
}
