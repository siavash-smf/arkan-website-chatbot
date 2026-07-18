import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getContact360, getStages } from "@/lib/crm/queries";
import AdminShell from "@/components/admin/AdminShell";
import ContactDetail from "@/components/admin/crm/ContactDetail";

export const metadata: Metadata = { title: "پرونده‌ی مخاطب", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// اکشن «تولید خلاصه‌ی AI» از همین صفحه صدا زده می‌شود؛ reasoning مدل زمان می‌برد.
export const maxDuration = 60;

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const [{ data, error }, { data: stages }] = await Promise.all([
    getContact360(params.id),
    getStages(),
  ]);

  if (error) {
    return (
      <AdminShell active="contacts" role={session.role}>
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
          {error}
        </div>
      </AdminShell>
    );
  }
  if (!data) notFound();

  return (
    <AdminShell active="contacts" role={session.role}>
      <ContactDetail data={data} stages={stages} canEdit={canWrite(session)} />
    </AdminShell>
  );
}
