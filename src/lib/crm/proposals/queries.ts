import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProposalComment, ProposalRecord } from "./types";

/** کوئری‌های خواندنی پروپوزال‌ها — همان الگوی {data, error} در crm/queries.ts */

type Result<T> = { data: T; error: string | null };
const NO_DB = "اتصال پایگاه داده برقرار نیست.";

export async function getProposals(): Promise<Result<ProposalRecord[]>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: [], error: NO_DB };
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return { data: (data as ProposalRecord[]) ?? [], error: error?.message ?? null };
}

export async function getProposalComments(proposalId: string): Promise<ProposalComment[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("proposal_comments")
    .select("id, author, body, revision, created_at")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: true });
  return (data as ProposalComment[]) ?? [];
}

export async function getProposal(
  id: string
): Promise<Result<{ record: ProposalRecord; comments: ProposalComment[] } | null>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: null, error: NO_DB };
  const { data, error } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle();
  if (error || !data) return { data: null, error: error?.message ?? null };
  return { data: { record: data as ProposalRecord, comments: await getProposalComments(id) }, error: null };
}

/**
 * پروپوزال از روی توکن لینک عمومی. پیش‌نویس هرگز به کلاینت نشان داده نمی‌شود.
 * بازکردن لینک خودش سیگنال است: تعداد بازدید ثبت می‌شود و «ارسال‌شده» ← «دیده‌شده».
 */
export async function getProposalByToken(token: string): Promise<ProposalRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("proposals").select("*").eq("view_token", token).maybeSingle<ProposalRecord>();
  if (!data || data.status === "draft") return null;

  const now = new Date().toISOString();
  const patch = {
    view_count: (data.view_count ?? 0) + 1,
    first_viewed_at: data.first_viewed_at ?? now,
    last_viewed_at: now,
    ...(data.status === "sent" ? { status: "viewed" as const } : {}),
  };
  await supabase.from("proposals").update(patch).eq("id", data.id);
  return { ...data, ...patch };
}
