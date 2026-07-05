import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface Member {
  slot: number;
  member_email: string;
  member_id: string | null;
  email_locked_until: string | null;
}

/** The owner's linked members (readable via RLS on plan_memberships). */
export async function listMembers(): Promise<Member[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("plan_memberships")
    .select("slot, member_email, member_id, email_locked_until")
    .order("slot");
  if (error) throw error;
  return (data as Member[]) ?? [];
}

export async function linkMember(slot: number, email: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("app_link_member", { p_slot: slot, p_email: email });
  if (error) throw new Error(friendlyMemberError(error.message));
}

export async function unlinkMember(slot: number): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("app_unlink_member", { p_slot: slot });
  if (error) throw new Error(friendlyMemberError(error.message));
}

/** The caller's effective plan (own, or inherited from a shared plan). */
export async function getEffectivePlan(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("app_effective_plan");
  if (error) throw error;
  return (data as string) ?? "free";
}

/**
 * True if the current user is a LINKED MEMBER of someone else's shared plan
 * (Two-person / Family). Such users inherit the owner's plan and cannot upgrade on
 * their own — the owner must unlink them first. Readable via the member RLS policy.
 */
export async function getIsLinkedMember(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("plan_memberships")
    .select("slot")
    .eq("member_id", user.id)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

function friendlyMemberError(msg: string): string {
  if (msg.includes("email_change_locked"))
    return "You can change this member only once a month. It is locked until next month.";
  if (msg.includes("already_linked")) return "That email is already linked to another slot.";
  if (msg.includes("cannot_link_self")) return "You cannot link your own account.";
  if (msg.includes("empty_email")) return "Enter an email address.";
  return msg;
}
