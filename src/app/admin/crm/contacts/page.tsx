import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getContacts } from "@/lib/crm/queries";
import AdminShell from "@/components/admin/AdminShell";
import ContactsManager from "@/components/admin/crm/ContactsManager";

export const metadata: Metadata = { title: "مخاطبان", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  const [{ data: contacts, error }, { data: companies }] = await Promise.all([
    getContacts(),
    supabase
      ? supabase.from("companies").select("id, name").order("name")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <AdminShell active="contacts" role={session.role}>
      <ContactsManager contacts={contacts} companies={companies ?? []} error={error} />
    </AdminShell>
  );
}
