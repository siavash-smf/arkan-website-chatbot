import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getContract } from "@/lib/crm/queries";
import AdminShell from "@/components/admin/AdminShell";
import ContractEditor from "@/components/admin/crm/ContractEditor";

export const metadata: Metadata = { title: "ویرایش قرارداد", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// اکشن «بازنویسی با AI» از همین صفحه صدا زده می‌شود؛ reasoning مدل زمان می‌برد.
export const maxDuration = 60;

export default async function ContractEditPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const { data: contract, error } = await getContract(params.id);
  if (error) {
    return (
      <AdminShell active="contracts" role={session.role}>
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
          {error}
        </div>
      </AdminShell>
    );
  }
  if (!contract) notFound();

  // ساخت لینک عمومی از هاست جاری (روی هر دامنه‌ای — preview یا production — درست است)
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/contract/${contract.share_token}`;

  return (
    <AdminShell active="contracts" role={session.role}>
      <ContractEditor contract={contract} shareUrl={shareUrl} canEdit={canWrite(session)} />
    </AdminShell>
  );
}
