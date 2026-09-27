import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getComposerPickers } from "@/lib/crm/proposals/pickers";
import AdminShell from "@/components/admin/AdminShell";
import ProposalComposer from "@/components/admin/crm/ProposalComposer";

export const metadata: Metadata = { title: "پروپوزال جدید", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// ارسال ایمیل با PDF پیوست از همین صفحه انجام می‌شود
export const maxDuration = 60;

export default async function NewProposalPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");
  if (!canWrite(session)) redirect("/admin/crm/proposals");

  const { contacts, deals } = await getComposerPickers();

  return (
    <AdminShell active="proposals" role={session.role}>
      <div className="mb-6">
        <a href="/admin/crm/proposals" className="text-caption text-slate underline-offset-4 hover:text-pine hover:underline">
          → همه‌ی پروپوزال‌ها
        </a>
        <h1 className="mt-1 font-heading text-h3 font-bold text-pine">پروپوزال جدید</h1>
        <p className="mt-1 text-caption text-slate">
          از یکی از قالب‌های خدمات آرکان شروع کنید، متن را برای همین کلاینت شخصی کنید و پیش‌نمایش را کنار فرم ببینید.
        </p>
      </div>
      <ProposalComposer record={null} contacts={contacts} deals={deals} locked={false} />
    </AdminShell>
  );
}
