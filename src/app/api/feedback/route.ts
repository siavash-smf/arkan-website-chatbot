import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * ثبت بازخورد 👍/👎 برای آخرین پاسخ یک گفتگو.
 * بدنه: { conversationId: string, rating: "up" | "down", comment?: string }
 */
export async function POST(req: Request) {
  let body: { conversationId?: string; rating?: string; comment?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("بدنه‌ی نامعتبر.", { status: 400 });
  }

  const { conversationId, rating, comment } = body;
  if (!conversationId || (rating !== "up" && rating !== "down")) {
    return new Response("ورودی نامعتبر.", { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("سرویس در دسترس نیست.", { status: 503 });

  // آخرین پیام دستیار در این گفتگو
  const { data: lastMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("feedback").insert({
    message_id: lastMsg?.id ?? null,
    rating,
    comment: comment?.slice(0, 500) ?? null,
  });

  if (error) {
    console.error("[/api/feedback] خطا:", error.message);
    return new Response("ثبت بازخورد ناموفق بود.", { status: 500 });
  }
  return Response.json({ ok: true });
}
