import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SEGMENTS } from "@/lib/crm/segments";
import AdminShell from "@/components/admin/AdminShell";
import CampaignsManager, { type CampaignRow } from "@/components/admin/crm/CampaignsManager";

export const metadata: Metadata = { title: "کمپین‌ها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  let campaigns: CampaignRow[] = [];
  let error: string | null = null;

  if (!supabase) {
    error = "اتصال Supabase تنظیم نشده است.";
  } else {
    const { data, error: dbError } = await supabase
      .from("campaigns")
      .select("*, campaign_emails(status)")
      .order("created_at", { ascending: false });
    error = dbError?.message ?? null;
    campaigns = ((data as never[]) ?? []).map((c: never) => {
      const row = c as { campaign_emails?: Array<{ status: string }> } & Omit<
        CampaignRow,
        "email_count" | "ready_count" | "sent_count"
      >;
      const emails = row.campaign_emails ?? [];
      return {
        ...row,
        email_count: emails.length,
        ready_count: emails.filter((e) => e.status === "ready").length,
        sent_count: emails.filter((e) => e.status === "sent").length,
      };
    });
  }

  const segments = Object.entries(SEGMENTS).map(([key, s]) => ({ key, ...s }));

  return (
    <AdminShell active="campaigns" role={session.role}>
      <CampaignsManager
        campaigns={campaigns}
        segments={segments}
        error={error}
        canEdit={canWrite(session)}
      />
    </AdminShell>
  );
}
