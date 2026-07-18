import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { PipelineStage } from "@/lib/crm/types";

/**
 * گزارش‌های CRM — حجم داده کم است؛ ردیف‌های خام سمت سرور خوانده
 * و در TS تجمیع می‌شوند (همان الگوی analytics چت‌بات).
 */

export type CrmReport = {
  totals: {
    pipelineValue: number;      // ارزش معاملات باز
    monthRevenue: number;       // درآمد بردهای ماه جاری میلادی نیست — ۳۰ روز اخیر
    winRate: number;            // درصد برد از معاملات بسته‌شده
    avgDealSize: number;        // میانگین مبلغ بردها
    openDeals: number;
    wonDeals: number;
  };
  funnel: Array<{ label: string; count: number; pct: number }>;
  pipelineByStage: Array<{ label: string; count: number; value: number }>;
  leadSources: Array<{ label: string; total: number; converted: number }>;
  monthlyRevenue: Array<{ label: string; value: number }>;
};

type DealRow = {
  stage_key: string;
  status: string;
  amount_toman: number;
  created_at: string;
  won_at: string | null;
};

type LeadRow = {
  source: string | null;
  created_at: string;
  converted_at: string | null;
};

export async function getCrmReport(): Promise<{ data: CrmReport | null; error: string | null }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: null, error: "اتصال Supabase تنظیم نشده است." };

  const [stagesRes, dealsRes, leadsRes] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("position"),
    supabase.from("deals").select("stage_key, status, amount_toman, created_at, won_at"),
    supabase.from("leads").select("source, created_at, converted_at"),
  ]);
  const error =
    stagesRes.error?.message ?? dealsRes.error?.message ?? leadsRes.error?.message ?? null;
  if (error) return { data: null, error };

  const stages = (stagesRes.data as PipelineStage[]) ?? [];
  const deals = (dealsRes.data as DealRow[]) ?? [];
  const leads = (leadsRes.data as LeadRow[]) ?? [];

  const openDeals = deals.filter((d) => d.status === "open");
  const wonDeals = deals.filter((d) => d.status === "won");
  const lostDeals = deals.filter((d) => d.status === "lost");

  const pipelineValue = openDeals.reduce((s, d) => s + d.amount_toman, 0);
  const wonValue = wonDeals.reduce((s, d) => s + d.amount_toman, 0);

  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const monthRevenue = wonDeals
    .filter((d) => d.won_at && +new Date(d.won_at) >= thirtyDaysAgo)
    .reduce((s, d) => s + d.amount_toman, 0);

  const closedCount = wonDeals.length + lostDeals.length;
  const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;
  const avgDealSize = wonDeals.length > 0 ? Math.round(wonValue / wonDeals.length) : 0;

  // ── قیف تبدیل: لید ← تبدیل‌شده ← معامله ← جلسه به بعد ← برد ──
  const stagePosition = new Map(stages.map((s) => [s.key, s.position]));
  const meetingPos = stagePosition.get("meeting") ?? 3;
  const reachedMeeting = deals.filter(
    (d) => d.status === "won" || (stagePosition.get(d.stage_key) ?? 0) >= meetingPos
  ).length;
  const convertedLeads = leads.filter((l) => l.converted_at).length;

  const funnelRaw = [
    { label: "لید", count: leads.length },
    { label: "تبدیل به مخاطب", count: convertedLeads },
    { label: "معامله", count: deals.length },
    { label: "جلسه‌ی مشاوره به بعد", count: reachedMeeting },
    { label: "برد", count: wonDeals.length },
  ];
  const funnelBase = funnelRaw[0].count || 1;
  const funnel = funnelRaw.map((f) => ({
    ...f,
    pct: Math.round((f.count / funnelBase) * 100),
  }));

  // ── ارزش پایپ‌لاین به تفکیک مرحله (فقط باز) ──
  const pipelineByStage = stages
    .filter((s) => !s.is_won && !s.is_lost)
    .map((s) => {
      const stageDeals = openDeals.filter((d) => d.stage_key === s.key);
      return {
        label: s.label_fa,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + d.amount_toman, 0),
      };
    });

  // ── منابع لید ──
  const sourceLabels: Record<string, string> = {
    website: "وب‌سایت",
    chatbot: "چت‌بات",
  };
  const bySource = new Map<string, { total: number; converted: number }>();
  for (const l of leads) {
    const key = l.source ?? "website";
    const entry = bySource.get(key) ?? { total: 0, converted: 0 };
    entry.total += 1;
    if (l.converted_at) entry.converted += 1;
    bySource.set(key, entry);
  }
  const leadSources = Array.from(bySource.entries()).map(([key, v]) => ({
    label: sourceLabels[key] ?? key,
    ...v,
  }));

  // ── درآمد ماهانه‌ی ۱۲ ماه اخیر (تقویم فارسی) ──
  // باکت‌ها مستقیماً بر اساس ماه‌های تقویم فارسی ساخته می‌شوند (گام ~۳ روزه به عقب
  // و حذف تکراری‌ها) تا هیچ won_at داخل بازه، بیرون باکت‌ها نیفتد.
  const monthFormatter = new Intl.DateTimeFormat("fa-IR", { month: "long", year: "2-digit" });
  const monthKeyFormatter = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
    month: "2-digit",
    year: "numeric",
  });
  const months: Array<{ key: string; label: string; value: number }> = [];
  const seenKeys = new Set<string>();
  for (let d = new Date(); months.length < 12; d = new Date(+d - 3 * 86400000)) {
    const key = monthKeyFormatter.format(d);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    months.unshift({ key, label: monthFormatter.format(d), value: 0 });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const d of wonDeals) {
    if (!d.won_at) continue;
    const key = monthKeyFormatter.format(new Date(d.won_at));
    const idx = monthIndex.get(key);
    if (idx !== undefined) months[idx].value += d.amount_toman;
  }

  return {
    data: {
      totals: {
        pipelineValue,
        monthRevenue,
        winRate,
        avgDealSize,
        openDeals: openDeals.length,
        wonDeals: wonDeals.length,
      },
      funnel,
      pipelineByStage,
      leadSources,
      monthlyRevenue: months.map(({ label, value }) => ({ label, value })),
    },
    error: null,
  };
}
