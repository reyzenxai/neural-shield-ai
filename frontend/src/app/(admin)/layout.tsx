import { redirect } from "next/navigation";

import { AdminShell } from "@/components/layout/AdminShell";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

    if (!user) redirect("/login");

    const { data: profile } = await supabase!
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
