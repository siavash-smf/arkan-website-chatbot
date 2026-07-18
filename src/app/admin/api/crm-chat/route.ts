import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tool } from "ai";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getModelConfig } from "@/lib/rag/config";
import { streamChat, isOpenRouterConfigured, type ChatMessage } from "@/lib/rag/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * «چت با CRM» — دستیار ادمین با tool-calling روی داده‌ی واقعی Supabase.
 * همان الگوی تول capture_lead چت‌بات، این‌بار در جهت عکس: مدل به‌جای نوشتن
 * در CRM، از آن پرس‌وجو می‌کند و پاسخ تحلیلی فارسی می‌دهد.
 * فقط برای مدیر واردشده (کوکی نشست ادمین).
 */

const SYSTEM_PROMPT = `تو دستیار CRM شرکت مشاوره‌ی کسب‌وکار «آرکان» هستی و به مدیر فروش کمک می‌کنی.
- برای پاسخ به هر سؤال درباره‌ی داده‌ها، از ابزارها استفاده کن؛ هرگز عدد یا نام از خودت نساز.
- پاسخ کوتاه، فارسی و کاربردی بده؛ اعداد مهم را پررنگ کن و اگر لیدی/معامله‌ای نیاز به اقدام دارد، صریح بگو.
- مبالغ به تومان هستند. تاریخ‌ها را نسبی هم توضیح بده (مثلاً «۱۲ روز پیش»).
- اگر داده‌ای پیدا نشد، همین را شفاف بگو.`;

function buildTools(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  return {
    query_leads: tool({
      description:
        "جستجوی لیدها. فیلترها اختیاری: status (new|contacted|scheduled|won|lost)، source (website|chatbot)، converted (تبدیل‌شده یا نه)، min_days_old (حداقل عمر به روز)، search (متن در نام/کسب‌وکار/چالش).",
      inputSchema: z.object({
        status: z.enum(["new", "contacted", "scheduled", "won", "lost"]).optional(),
        source: z.enum(["website", "chatbot"]).optional(),
        converted: z.boolean().optional(),
        min_days_old: z.number().int().min(0).optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async (input) => {
        let q = supabase
          .from("leads")
          .select("full_name, business_name, industry, status, source, ai_score, challenge, created_at, converted_at")
          .order("created_at", { ascending: false })
          .limit(input.limit);
        if (input.status) q = q.eq("status", input.status);
        if (input.source) q = q.eq("source", input.source);
        if (input.converted === true) q = q.not("converted_at", "is", null);
        if (input.converted === false) q = q.is("converted_at", null);
        if (input.min_days_old) {
          q = q.lt("created_at", new Date(Date.now() - input.min_days_old * 86400000).toISOString());
        }
        if (input.search) {
          const s = input.search.replace(/[\\%_]/g, "\\$&");
          q = q.or(`full_name.ilike.%${s}%,business_name.ilike.%${s}%,challenge.ilike.%${s}%`);
        }
        const { data, error } = await q;
        return error ? { error: error.message } : { count: data.length, leads: data };
      },
    }),
    query_deals: tool({
      description:
        "جستجوی معاملات. فیلترها اختیاری: status (open|won|lost)، stage_key (new|qualifying|meeting|proposal|negotiation|won|lost)، min_amount (حداقل مبلغ تومان)، stale_days (حداقل روزِ مانده در مرحله‌ی فعلی).",
      inputSchema: z.object({
        status: z.enum(["open", "won", "lost"]).optional(),
        stage_key: z.string().optional(),
        min_amount: z.number().int().min(0).optional(),
        stale_days: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async (input) => {
        let q = supabase
          .from("deals")
          .select("title, stage_key, status, amount_toman, stage_entered_at, expected_close, lost_reason, ai_next_action, contact:contacts(full_name)")
          .order("amount_toman", { ascending: false })
          .limit(input.limit);
        if (input.status) q = q.eq("status", input.status);
        if (input.stage_key) q = q.eq("stage_key", input.stage_key);
        if (input.min_amount) q = q.gte("amount_toman", input.min_amount);
        if (input.stale_days) {
          q = q.lt("stage_entered_at", new Date(Date.now() - input.stale_days * 86400000).toISOString());
        }
        const { data, error } = await q;
        return error ? { error: error.message } : { count: data.length, deals: data };
      },
    }),
    query_activities: tool({
      description:
        "جستجوی فعالیت‌ها و وظایف. فیلترها: only_overdue (فقط معوق‌ها)، only_open (انجام‌نشده)، type (call|meeting|note|task).",
      inputSchema: z.object({
        only_overdue: z.boolean().optional(),
        only_open: z.boolean().optional(),
        type: z.enum(["call", "meeting", "note", "task"]).optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async (input) => {
        let q = supabase
          .from("activities")
          .select("type, title, due_at, done_at, created_by, contact:contacts(full_name), deal:deals(title)")
          .order("created_at", { ascending: false })
          .limit(input.limit);
        if (input.type) q = q.eq("type", input.type);
        if (input.only_open || input.only_overdue) q = q.is("done_at", null);
        if (input.only_overdue) q = q.lt("due_at", new Date().toISOString());
        const { data, error } = await q;
        return error ? { error: error.message } : { count: data.length, activities: data };
      },
    }),
    crm_stats: tool({
      description:
        "آمار کلی CRM: تعداد لیدها به تفکیک وضعیت/منبع، ارزش پایپ‌لاین باز، تعداد و مبلغ بردها، وظایف معوق، وضعیت قراردادها. برای سؤالات آماری/گزارشی اول این را صدا بزن.",
      inputSchema: z.object({}),
      execute: async () => {
        const [leads, deals, overdue, contracts] = await Promise.all([
          supabase.from("leads").select("status, source, converted_at"),
          supabase.from("deals").select("status, stage_key, amount_toman"),
          supabase
            .from("activities")
            .select("id", { count: "exact", head: true })
            .is("done_at", null)
            .lt("due_at", new Date().toISOString()),
          supabase.from("contracts").select("status"),
        ]);
        const leadRows = leads.data ?? [];
        const dealRows = deals.data ?? [];
        const by = <T,>(rows: T[], key: (r: T) => string) =>
          rows.reduce<Record<string, number>>((acc, r) => {
            acc[key(r)] = (acc[key(r)] ?? 0) + 1;
            return acc;
          }, {});
        return {
          لیدها: {
            کل: leadRows.length,
            به_تفکیک_وضعیت: by(leadRows, (l: { status: string }) => l.status),
            به_تفکیک_منبع: by(leadRows, (l: { source: string | null }) => l.source ?? "website"),
            تبدیل‌شده: leadRows.filter((l: { converted_at: string | null }) => l.converted_at).length,
          },
          معاملات: {
            باز: dealRows.filter((d) => d.status === "open").length,
            ارزش_پایپ‌لاین_باز_تومان: dealRows
              .filter((d) => d.status === "open")
              .reduce((s, d) => s + d.amount_toman, 0),
            برد: dealRows.filter((d) => d.status === "won").length,
            درآمد_بردها_تومان: dealRows
              .filter((d) => d.status === "won")
              .reduce((s, d) => s + d.amount_toman, 0),
            باخت: dealRows.filter((d) => d.status === "lost").length,
            به_تفکیک_مرحله: by(
              dealRows.filter((d) => d.status === "open"),
              (d) => d.stage_key
            ),
          },
          وظایف_معوق: overdue.count ?? 0,
          قراردادها: by(contracts.data ?? [], (c: { status: string }) => c.status),
        };
      },
    }),
  };
}

export async function POST(req: NextRequest) {
  if (!getSession()) {
    return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 401 });
  }
  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ error: "کلید OpenRouter تنظیم نشده است." }, { status: 503 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "اتصال پایگاه داده برقرار نیست." }, { status: 503 });
  }

  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "پیامی ارسال نشده." }, { status: 400 });
  }

  const config = await getModelConfig("web");
  const result = streamChat({
    model: config.active_model,
    system: SYSTEM_PROMPT,
    messages: messages.slice(-12),
    temperature: 0.2,
    topP: 1,
    maxOutputTokens: 2000,
    tools: buildTools(supabase),
  });

  return result.toTextStreamResponse();
}
