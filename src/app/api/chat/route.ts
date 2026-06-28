import { handleChatTurn } from "@/lib/rag/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── rate-limit ساده‌ی درون‌حافظه‌ای (پایه برای M1) ──
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";

  if (rateLimited(ip)) {
    return new Response("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.", {
      status: 429,
    });
  }

  let body: { message?: string; conversationId?: string | null; channel?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("بدنه‌ی نامعتبر.", { status: 400 });
  }

  const message = (body.message ?? "").toString().trim();
  if (!message) {
    return new Response("پیام خالی است.", { status: 400 });
  }
  if (message.length > 2000) {
    return new Response("پیام بیش از حد طولانی است.", { status: 400 });
  }

  try {
    return await handleChatTurn({
      conversationId: body.conversationId ?? null,
      channel: body.channel ?? "web",
      userMessage: message,
    });
  } catch (e) {
    console.error("[/api/chat] خطا:", (e as Error).message);
    return new Response(
      "در پاسخ‌گویی خطایی رخ داد. لطفاً دوباره تلاش کنید یا فرم درخواست مشاوره را پر کنید.",
      { status: 500 }
    );
  }
}
