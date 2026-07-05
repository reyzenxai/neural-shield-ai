import { redirect } from "next/navigation";

/**
 * Admin entry point. Everything is reachable from here via the AdminShell nav, so
 * only `/admin` needs to be linked externally — it lands on the dashboard.
 */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
