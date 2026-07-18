import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getActivities } from "@/lib/crm/queries";
import AdminShell from "@/components/admin/AdminShell";
import ActivitiesManager from "@/components/admin/crm/ActivitiesManager";

export const metadata: Metadata = { title: "فعالیت‌ها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  const [{ data: activities, error }, { data: contacts }] = await Promise.all([
    getActivities(),
    supabase
      ? supabase.from("contacts").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <AdminShell active="activities" role={session.role}>
      <ActivitiesManager
        activities={activities}
        contacts={contacts ?? []}
        error={error}
        canEdit={canWrite(session)}
      />
    </AdminShell>
  );
}
