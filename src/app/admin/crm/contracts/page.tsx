import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getContracts } from "@/lib/crm/queries";
import AdminShell from "@/components/admin/AdminShell";
import ContractsManager from "@/components/admin/crm/ContractsManager";

export const metadata: Metadata = { title: "قراردادها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  const [{ data: contracts, error }, { data: contacts }, { data: deals }] = await Promise.all([
    getContracts(),
    supabase
      ? supabase.from("contacts").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] }),
    supabase
      ? supabase.from("deals").select("id, title, contact_id, amount_toman").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <AdminShell active="contracts" role={session.role}>
      <ContractsManager
        contracts={contracts}
        contacts={contacts ?? []}
        deals={(deals as never[]) ?? []}
        error={error}
        canEdit={canWrite(session)}
      />
    </AdminShell>
  );
}
