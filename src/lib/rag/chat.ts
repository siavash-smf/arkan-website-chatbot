import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { leadSchema } from "@/lib/validation";
import { retrieve, buildContext } from "./retrieve";
import { getModelConfig, getActivePrompt } from "./config";
import { streamChat, isOpenRouterConfigured, type ChatMessage } from "./generate";

/**
 * مغز مرکزی چت‌بات — مستقل از کانال.
 * همه‌ی کانال‌ها (صفحه‌ی چت، ویجت، تلگرام) این تابع را صدا می‌زنند.
 * خروجی یک Response استریمی متنی است؛ متادیتا (conversationId + منابع) در هدر x-arkan-meta (base64).
 */

const HISTORY_LIMIT = 12;

export type ChatTurnInput = {
  conversationId?: string | null;
  channel?: string;
  userMessage: string;
};

export async function handleChatTurn(input: ChatTurnInput): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const channel = input.channel ?? "web";

  if (!isOpenRouterConfigured()) {
    return fallbackResponse(
      "سرویس گفتگو هنوز پیکربندی نشده است. لطفاً کمی بعد دوباره امتحان کنید یا فرم درخواست مشاوره را پر کنید."
    );
  }

  // ۱) conversation
  let conversationId = input.conversationId ?? null;
  if (supabase) {
    if (!conversationId) {
      const { data } = await supabase
        .from("conversations")
        .insert({ channel, status: "open" })
        .select("id")
        .single();
      conversationId = data?.id ?? null;
    } else {
      await supabase
        .from("conversations")
        .update({ last_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: input.userMessage,
      });
    }
  }

  // ۲) تاریخچه (جدیدترین‌ها)
  let history: ChatMessage[] = [];
  if (supabase && conversationId) {
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT * 2);
    history = (data ?? [])
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }
  if (history.length === 0 || history[history.length - 1].content !== input.userMessage) {
    history.push({ role: "user", content: input.userMessage });
  }

  // ۳) بازیابی (RAG)
  const chunks = await retrieve(input.userMessage);
  const context = buildContext(chunks);
  const retrievedChunkIds = chunks.map((c) => c.id);

  // ۴) system prompt + context
  const basePrompt = await getActivePrompt();
  const system = context
    ? `${basePrompt}\n\n# منابع بازیابی‌شده\nبرای پاسخ فقط از منابع زیر استفاده کن. اگر پاسخ در این منابع نبود، صادقانه بگو و کاربر را به ثبت درخواست مشاوره دعوت کن.\n\n${context}`
    : `${basePrompt}\n\n(در پایگاه دانش منبع مرتبطی یافت نشد. اگر مطمئن نیستی، صادقانه بگو و کاربر را به «ثبت درخواست مشاوره» دعوت کن.)`;

  // ۵) پیکربندی مدل
  const modelCfg = await getModelConfig(channel);

  // ۶) ابزارها
  const tools = buildTools(supabase, conversationId);

  // ۷) تولید استریمی
  const result = streamChat({
    model: modelCfg.active_model,
    system,
    messages: history,
    temperature: modelCfg.temperature,
    topP: modelCfg.top_p,
    maxOutputTokens: modelCfg.max_tokens,
    tools,
    onFinish: async ({ text, usage, model }) => {
      if (supabase && conversationId && text) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: text,
          model_used: model,
          tokens_in: usage?.inputTokens ?? null,
          tokens_out: usage?.outputTokens ?? null,
          retrieved_chunk_ids: retrievedChunkIds.length ? retrievedChunkIds : null,
        });
      }
    },
  });

  // ۸) متادیتا در هدر (base64 برای پشتیبانی از فارسی)
  const meta = {
    conversationId,
    sources: chunks.map((c) => ({
      title: c.title,
      similarity: Math.round(c.similarity * 100) / 100,
      chunk_index: c.chunk_index,
    })),
  };

  return result.toTextStreamResponse({
    headers: { "x-arkan-meta": toBase64(meta) },
  });
}

// ── ابزار ثبت لید (یکپارچه با جدول leads سایت) ──────────────────
function buildTools(supabase: SupabaseClient | null, conversationId: string | null): ToolSet {
  return {
    capture_lead: tool({
      description:
        "ثبت «درخواست مشاوره» وقتی کاربر اطلاعات لازم را داده و آماده‌ی مشاوره است. فقط وقتی صدا بزن که حداقل نام، شماره تماس، نام کسب‌وکار، مرحله و چالش مشخص باشد.",
      inputSchema: z.object({
        full_name: z.string().describe("نام و نام خانوادگی کاربر"),
        phone: z.string().describe("شماره تماس کاربر"),
        business_name: z.string().describe("نام کسب‌وکار"),
        stage: z
          .enum(["ایده", "نوپا", "در حال رشد", "تثبیت‌شده"])
          .describe("مرحله‌ی کسب‌وکار"),
        challenge: z.string().describe("بزرگ‌ترین چالش فعلی کاربر"),
        email: z.string().optional().describe("ایمیل (اختیاری)"),
        industry: z.string().optional().describe("حوزه‌ی فعالیت (اختیاری)"),
        preferred_time: z
          .enum(["صبح", "بعدازظهر", "عصر"])
          .optional()
          .describe("زمان مناسب تماس (اختیاری)"),
      }),
      execute: async (args) => {
        if (!supabase) return { ok: false, message: "ثبت موقتاً ممکن نیست." };
        const parsed = leadSchema.safeParse(args);
        if (!parsed.success) {
          return { ok: false, message: "اطلاعات کامل یا معتبر نیست؛ از کاربر تکمیلش را بخواه." };
        }
        const d = parsed.data;
        const { error } = await supabase.from("leads").insert({
          full_name: d.full_name,
          phone: d.phone,
          email: d.email || null,
          business_name: d.business_name,
          industry: d.industry || null,
          stage: d.stage,
          challenge: d.challenge,
          preferred_time: d.preferred_time || null,
          status: "new",
          source: "chatbot",
          conversation_id: conversationId,
        });
        if (error) {
          console.error("[capture_lead] خطا:", error.message);
          return { ok: false, message: "در ثبت خطایی رخ داد." };
        }
        return {
          ok: true,
          message: "درخواست مشاوره با موفقیت ثبت شد. تیم آرکان ظرف ۲۴ ساعت کاری تماس می‌گیرد.",
        };
      },
    }),
  };
}

function fallbackResponse(message: string): Response {
  return new Response(message, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-arkan-meta": toBase64({ conversationId: null, sources: [] }),
    },
  });
}

function toBase64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf-8").toString("base64");
}
