import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * جمع‌آوری آمار داشبورد. برای سادگی و بدون نیاز به migration، تجمیع در JS انجام می‌شود
 * (با سقف منطقی روی تعداد ردیف‌ها). برای مقیاس بزرگ بعداً به توابع SQL تجمیعی منتقل می‌شود.
 */

// قیمت تقریبی هر مدل (دلار به ازای هر ۱ میلیون توکن) — صرفاً برای تخمین هزینه
const PRICES: Record<string, { in: number; out: number }> = {
  "google/gemini-3.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-3.1-flash-lite": { in: 0.1, out: 0.4 },
  "anthropic/claude-haiku-4.5": { in: 1.0, out: 5.0 },
  "openai/gpt-5-mini": { in: 0.25, out: 2.0 },
  "openai/gpt-5.4-nano": { in: 0.1, out: 0.4 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "qwen/qwen3-30b-a3b-instruct-2507": { in: 0.1, out: 0.4 },
};
const DEFAULT_PRICE = { in: 0.5, out: 1.5 };

export type ModelUsage = {
  model: string;
  messages: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

export type Analytics = {
  totals: {
    conversations: number;
    users: number;
    messages: number;
    leads: number;
    chatbotLeads: number;
  };
  byChannel: { channel: string; conversations: number }[];
  feedback: { up: number; down: number };
  gaps: number; // پاسخ‌های دستیار بدون منبع بازیابی‌شده
  conversionRate: number; // درصد گفتگوهایی که به لید چت‌بات رسیدند
  satisfactionRate: number; // درصد 👍 از کل بازخوردها
  models: ModelUsage[];
  totalCostUsd: number;
  totalTokens: number;
};

const CHANNEL_LABELS: Record<string, string> = {
  web: "صفحه‌ی چت",
  widget: "ویجت",
  telegram: "تلگرام",
};

export function channelLabel(ch: string): string {
  return CHANNEL_LABELS[ch] ?? ch;
}

export type ReviewData = {
  downFeedback: { answer: string; when: string }[];
  gapQuestions: { question: string; when: string }[];
};

/** داده‌های بخش «بازخورد و سؤالات بی‌جواب». */
export async function getReviewData(): Promise<ReviewData | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  // بازخوردهای منفی به‌همراه متن پاسخ مربوطه
  const { data: downs } = await supabase
    .from("feedback")
    .select("created_at, messages(content)")
    .eq("rating", "down")
    .order("created_at", { ascending: false })
    .limit(50);
  const downFeedback = (downs ?? []).map((d) => ({
    answer: ((d.messages as { content?: string } | null)?.content ?? "—").slice(0, 300),
    when: d.created_at as string,
  }));

  // سؤالات بی‌جواب: پاسخ‌های دستیار بدون منبع → سؤال کاربر قبل از آن
  const { data: recent } = await supabase
    .from("messages")
    .select("conversation_id, role, content, retrieved_chunk_ids, created_at")
    .order("created_at", { ascending: false })
    .limit(600);
  const asc = (recent ?? []).reverse();
  const lastUser = new Map<string, { content: string; when: string }>();
  const gapQuestions: { question: string; when: string }[] = [];
  for (const m of asc) {
    if (m.role === "user") {
      lastUser.set(m.conversation_id, { content: m.content, when: m.created_at });
    } else if (m.role === "assistant") {
      const rc = m.retrieved_chunk_ids as string[] | null;
      if (!rc || rc.length === 0) {
        const q = lastUser.get(m.conversation_id);
        if (q) gapQuestions.push({ question: q.content.slice(0, 200), when: q.when });
      }
    }
  }
  gapQuestions.reverse(); // جدیدترین‌ها اول
  return { downFeedback, gapQuestions: gapQuestions.slice(0, 50) };
}

export async function getAnalytics(): Promise<Analytics | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const head = { count: "exact" as const, head: true };
  const [convC, userC, msgC, leadC, cbLeadC] = await Promise.all([
    supabase.from("conversations").select("id", head),
    supabase.from("unified_users").select("id", head),
    supabase.from("messages").select("id", head),
    supabase.from("leads").select("id", head),
    supabase.from("leads").select("id", head).eq("source", "chatbot"),
  ]);

  // تفکیک کانال
  const { data: convs } = await supabase.from("conversations").select("channel").limit(10000);
  const channelMap = new Map<string, number>();
  for (const c of convs ?? []) channelMap.set(c.channel, (channelMap.get(c.channel) ?? 0) + 1);
  const byChannel = Array.from(channelMap.entries())
    .map(([channel, conversations]) => ({ channel, conversations }))
    .sort((a, b) => b.conversations - a.conversations);

  // بازخورد
  const { data: fb } = await supabase.from("feedback").select("rating").limit(10000);
  let up = 0,
    down = 0;
  for (const f of fb ?? []) {
    if (f.rating === "up") up++;
    else if (f.rating === "down") down++;
  }

  // پیام‌های دستیار: توکن، مدل، شکاف
  const { data: amsgs } = await supabase
    .from("messages")
    .select("model_used, tokens_in, tokens_out, retrieved_chunk_ids")
    .eq("role", "assistant")
    .limit(10000);

  const modelMap = new Map<string, ModelUsage>();
  let gaps = 0;
  for (const m of amsgs ?? []) {
    const rc = m.retrieved_chunk_ids as string[] | null;
    if (!rc || rc.length === 0) gaps++;
    const model = m.model_used ?? "—";
    const u = modelMap.get(model) ?? { model, messages: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
    u.messages++;
    u.tokensIn += m.tokens_in ?? 0;
    u.tokensOut += m.tokens_out ?? 0;
    modelMap.set(model, u);
  }
  const models = Array.from(modelMap.values()).map((u) => {
    const p = PRICES[u.model] ?? DEFAULT_PRICE;
    u.costUsd = (u.tokensIn / 1e6) * p.in + (u.tokensOut / 1e6) * p.out;
    return u;
  });
  models.sort((a, b) => b.messages - a.messages);

  const totalCostUsd = models.reduce((s, m) => s + m.costUsd, 0);
  const totalTokens = models.reduce((s, m) => s + m.tokensIn + m.tokensOut, 0);

  const conversations = convC.count ?? 0;
  const chatbotLeads = cbLeadC.count ?? 0;
  const conversionRate = conversations > 0 ? Math.round((chatbotLeads / conversations) * 100) : 0;
  const totalFb = up + down;
  const satisfactionRate = totalFb > 0 ? Math.round((up / totalFb) * 100) : 0;

  return {
    totals: {
      conversations,
      users: userC.count ?? 0,
      messages: msgC.count ?? 0,
      leads: leadC.count ?? 0,
      chatbotLeads,
    },
    byChannel,
    feedback: { up, down },
    gaps,
    conversionRate,
    satisfactionRate,
    models,
    totalCostUsd,
    totalTokens,
  };
}
