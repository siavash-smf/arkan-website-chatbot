import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDealsBoard } from "@/lib/crm/queries";
import AdminShell from "@/components/admin/AdminShell";
import DealsBoard from "@/components/admin/crm/DealsBoard";

export const metadata: Metadata = { title: "معاملات", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// اکشن «اقدام بعدی؟» (AI) از همین صفحه صدا زده می‌شود؛ reasoning مدل زمان می‌برد.
export const maxDuration = 60;

export default async function DealsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  const [{ data, error }, { data: contacts }] = await Promise.all([
    getDealsBoard(),
    supabase
      ? supabase.from("contacts").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <AdminShell active="deals" role={session.role}>
      <DealsBoard
        stages={data.stages}
        deals={data.deals}
        contacts={contacts ?? []}
        error={error}
        canEdit={canWrite(session)}
      />
    </AdminShell>
  );
}
