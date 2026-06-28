import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getReplyText } from "@/lib/rag/chat";
import { sendMessage, sendChatAction, answerCallbackQuery, type InlineButton } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

const SITE_URL = "https://arkan-website-chatbot.vercel.app";

// ── rate-limit ساده per chat ──
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const hits = new Map<number, number[]>();
function rateLimited(chatId: number): boolean {
  const now = Date.now();
  const arr = (hits.get(chatId) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(chatId, arr);
  return arr.length > MAX_PER_WINDOW;
}

// دکمه‌های پاسخ سریع (callback) + لینک سایت
const QUICK_QUESTIONS: Record<string, string> = {
  q_services: "خدمات آرکان شامل چه مواردی است؟",
  q_pillars: "متدولوژی «چهار رکن» آرکان چیست؟",
  q_pricing: "هزینه و مدت بسته‌های مشاوره چقدر است؟",
  q_process: "فرایند همکاری با آرکان چطور پیش می‌رود؟",
};
function startKeyboard(): InlineButton[][] {
  return [
    [{ text: "خدمات آرکان", callback_data: "q_services" }, { text: "چهار رکن", callback_data: "q_pillars" }],
    [{ text: "قیمت‌ها", callback_data: "q_pricing" }, { text: "فرایند همکاری", callback_data: "q_process" }],
    [{ text: "📝 ثبت درخواست مشاوره", url: `${SITE_URL}/#consultation` }],
  ];
}

const WELCOME =
  "سلام! 👋 من دستیار هوشمند آرکان هستم؛ مشاور استراتژی و رشد کسب‌وکار.\n\nسؤال‌تان را درباره‌ی خدمات، متدولوژی چهار رکن، قیمت‌ها یا فرایند همکاری بنویسید — یا یکی از گزینه‌های زیر را انتخاب کنید.";
const HELP =
  "من می‌توانم درباره‌ی آرکان به شما کمک کنم:\n\n• سؤال‌تان را مستقیم بنویسید.\n• /start — شروع دوباره و منوی گزینه‌ها\n• /reset — پاک‌کردن حافظه‌ی گفتگو و شروع تازه\n\nهر وقت آماده بودید، درخواست مشاوره‌ی رایگان ثبت کنید: " +
  `${SITE_URL}/#consultation`;

export async function POST(req: Request) {
  // امنیت: تأیید secret تلگرام
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("ok"); // به‌روزرسانی نامعتبر را بی‌صدا رد کن
  }

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (e) {
    console.error("[telegram] خطا:", (e as Error).message);
  }
  // همیشه سریع 200 بده تا تلگرام دوباره نفرستد
  return new Response("ok");
}

async function handleMessage(msg: TelegramMessage) {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  const supabase = getSupabaseAdmin();

  if (!text) {
    await sendMessage(chatId, "فعلاً فقط پیام متنی را پشتیبانی می‌کنم. سؤال‌تان را بنویسید 🙂");
    return;
  }

  // دستورها
  if (text.startsWith("/start")) {
    if (supabase) {
      await upsertUser(supabase, chatId, msg.from);
      await resetConversation(supabase, chatId);
    }
    await sendMessage(chatId, WELCOME, startKeyboard());
    return;
  }
  if (text.startsWith("/help")) {
    await sendMessage(chatId, HELP);
    return;
  }
  if (text.startsWith("/reset")) {
    if (supabase) await resetConversation(supabase, chatId);
    await sendMessage(chatId, "حافظه‌ی گفتگو پاک شد. می‌توانید از نو شروع کنید 🙂", startKeyboard());
    return;
  }

  if (rateLimited(chatId)) {
    await sendMessage(chatId, "کمی آرام‌تر 🙏 لطفاً چند لحظه صبر کنید و دوباره بپرسید.");
    return;
  }

  await answerQuestion(chatId, text, msg.from);
}

async function handleCallback(cb: TelegramCallback) {
  await answerCallbackQuery(cb.id).catch(() => {});
  const chatId = cb.message?.chat.id;
  if (!chatId) return;
  const question = QUICK_QUESTIONS[cb.data ?? ""];
  if (!question) return;
  if (rateLimited(chatId)) {
    await sendMessage(chatId, "کمی آرام‌تر 🙏 لطفاً چند لحظه صبر کنید.");
    return;
  }
  await answerQuestion(chatId, question, cb.from);
}

async function answerQuestion(chatId: number, question: string, from?: TelegramUser) {
  const supabase = getSupabaseAdmin();
  await sendChatAction(chatId, "typing").catch(() => {});

  let conversationId: string | null = null;
  if (supabase) {
    await upsertUser(supabase, chatId, from);
    conversationId = await getOrCreateConversation(supabase, chatId);
  }

  const { text } = await getReplyText({
    channel: "telegram",
    conversationId,
    externalUserId: String(chatId),
    userMessage: question,
  });

  await sendMessage(chatId, text, [[{ text: "📝 ثبت درخواست مشاوره", url: `${SITE_URL}/#consultation` }]]);
}

// ── نگاشت کاربر و گفتگو ──────────────────────────────────────────
async function upsertUser(supabase: SupabaseClient, chatId: number, from?: TelegramUser) {
  const { data } = await supabase
    .from("unified_users")
    .select("id")
    .eq("channel", "telegram")
    .eq("external_id", String(chatId))
    .maybeSingle();
  if (!data) {
    const name = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || from?.username || null;
    await supabase.from("unified_users").insert({ channel: "telegram", external_id: String(chatId), name });
  }
}

async function getOrCreateConversation(supabase: SupabaseClient, chatId: number): Promise<string | null> {
  const { data: open } = await supabase
    .from("conversations")
    .select("id")
    .eq("channel", "telegram")
    .eq("external_user_id", String(chatId))
    .eq("status", "open")
    .order("last_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open?.id) return open.id;
  const { data: created } = await supabase
    .from("conversations")
    .insert({ channel: "telegram", external_user_id: String(chatId), status: "open" })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function resetConversation(supabase: SupabaseClient, chatId: number) {
  await supabase
    .from("conversations")
    .update({ status: "closed" })
    .eq("channel", "telegram")
    .eq("external_user_id", String(chatId))
    .eq("status", "open");
}

// ── انواع تلگرام ──
type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string };
type TelegramMessage = { chat: { id: number }; text?: string; from?: TelegramUser };
type TelegramCallback = { id: string; data?: string; message?: { chat: { id: number } }; from?: TelegramUser };
type TelegramUpdate = { message?: TelegramMessage; callback_query?: TelegramCallback };
