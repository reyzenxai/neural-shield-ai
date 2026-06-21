import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Server-side guard for the authenticated area. The middleware already redirects
 * unauthenticated users; this is defense-in-depth so protected pages never render
 * for a signed-out user.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (!user) redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
