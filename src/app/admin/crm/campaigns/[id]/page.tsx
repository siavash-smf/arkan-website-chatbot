import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import CampaignDetail, { type CampaignEmailRow } from "@/components/admin/crm/CampaignDetail";

export const metadata: Metadata = { title: "جزئیات کمپین", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// تولید ایمیل با AI و ارسال Resend از همین صفحه انجام می‌شود
export const maxDuration = 60;

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return (
      <AdminShell active="campaigns" role={session.role}>
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
          اتصال Supabase تنظیم نشده است.
        </div>
      </AdminShell>
    );
  }

  const [{ data: campaign }, { data: emails, error }] = await Promise.all([
    supabase.from("campaigns").select("id, name, status, goal").eq("id", params.id).maybeSingle(),
    supabase
      .from("campaign_emails")
      .select("id, to_name, to_email, context, subject, body_text, status, error")
      .eq("campaign_id", params.id)
      .order("created_at"),
  ]);
  if (!campaign) notFound();

  return (
    <AdminShell active="campaigns" role={session.role}>
      <CampaignDetail
        campaign={campaign}
        emails={(emails as CampaignEmailRow[]) ?? []}
        error={error?.message ?? null}
        canEdit={canWrite(session)}
        resendConfigured={Boolean(process.env.RESEND_API_KEY)}
      />
    </AdminShell>
  );
}
