"use server";

import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  ingestDocument,
  deleteDocument,
  reindexDocument,
} from "@/lib/rag/ingest";

function parseTags(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined;
  const tags = raw.split(/[,،]/).map((t) => t.trim()).filter(Boolean);
  return tags.length ? tags : undefined;
}
import { retrieve, buildContext, type RetrievedChunk } from "@/lib/rag/retrieve";
import { getActivePrompt, getModelConfig } from "@/lib/rag/config";
import { streamChat } from "@/lib/rag/generate";

type ActionResult = { ok: boolean; message?: string };

function guard(): boolean {
  return isAuthed();
}

// ── پایگاه دانش ─────────────────────────────────────────────────
export async function ingestTextAction(
  title: string,
  text: string,
  tagsRaw?: string
): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  if (!title.trim() || text.trim().length < 20) {
    return { ok: false, message: "عنوان و متن (حداقل ۲۰ نویسه) لازم است." };
  }
  const res = await ingestDocument({
    type: "text",
    title: title.trim(),
    text,
    tags: parseTags(tagsRaw),
  });
  revalidatePath("/admin/knowledge");
  return res.ok
    ? { ok: true, message: `سند با ${res.chunkCount} قطعه ثبت شد.` }
    : { ok: false, message: res.error };
}

export async function ingestUrlAction(
  url: string,
  title?: string,
  tagsRaw?: string
): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  if (!/^https?:\/\//i.test(url.trim())) {
    return { ok: false, message: "آدرس URL معتبر نیست." };
  }
  const res = await ingestDocument({
    type: "url",
    url: url.trim(),
    title: title?.trim(),
    tags: parseTags(tagsRaw),
  });
  revalidatePath("/admin/knowledge");
  return res.ok
    ? { ok: true, message: `سند با ${res.chunkCount} قطعه ثبت شد.` }
    : { ok: false, message: res.error };
}

/** آپلود چند فایل با فرمت‌های گوناگون (md/txt/csv/json/yaml/html/pdf) + تگ مشترک. */
export async function ingestFilesAction(formData: FormData): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const tags = parseTags(formData.get("tags") as string | null);
  if (files.length === 0) return { ok: false, message: "فایلی انتخاب نشده." };

  let okCount = 0;
  const failed: string[] = [];
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      failed.push(`${file.name} (حجم زیاد)`);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const title = file.name.replace(/\.[^.]+$/, "");
    const res = await ingestDocument({ type: "file", title, filename: file.name, buffer, tags });
    if (res.ok) okCount++;
    else failed.push(`${file.name}`);
  }
  revalidatePath("/admin/knowledge");
  if (failed.length === 0) return { ok: true, message: `${okCount} فایل با موفقیت ایندکس شد.` };
  return {
    ok: okCount > 0,
    message: `${okCount} فایل ایندکس شد؛ ${failed.length} ناموفق: ${failed.join("، ").slice(0, 200)}`,
  };
}

export async function deleteDocAction(id: string): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const res = await deleteDocument(id);
  revalidatePath("/admin/knowledge");
  return res;
}

export async function reindexDocAction(id: string): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const res = await reindexDocument(id);
  revalidatePath("/admin/knowledge");
  return res.ok
    ? { ok: true, message: `بازسازی شد (${res.chunkCount} قطعه).` }
    : { ok: false, message: res.error };
}

export async function testSearchAction(
  query: string
): Promise<{ ok: boolean; chunks?: RetrievedChunk[]; message?: string }> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  if (!query.trim()) return { ok: false, message: "پرسش خالی است." };
  try {
    const chunks = await retrieve(query.trim());
    return { ok: true, chunks };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ── پیکربندی مدل و embedding ────────────────────────────────────
export async function saveModelConfigAction(values: {
  active_model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  fallback_model: string | null;
}): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, message: "اتصال Supabase برقرار نیست." };

  const { data: existing } = await supabase
    .from("model_config")
    .select("id")
    .eq("channel", "web")
    .maybeSingle();

  const payload = { ...values, channel: "web", updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from("model_config").update(payload).eq("id", existing.id)
    : await supabase.from("model_config").insert(payload);

  revalidatePath("/admin/models");
  return error ? { ok: false, message: error.message } : { ok: true, message: "تنظیمات مدل ذخیره شد." };
}

export async function saveEmbeddingConfigAction(values: {
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
}): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, message: "اتصال Supabase برقرار نیست." };

  const { data: existing } = await supabase
    .from("embedding_config")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = { ...values, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from("embedding_config").update(payload).eq("id", existing.id)
    : await supabase.from("embedding_config").insert(payload);

  revalidatePath("/admin/models");
  return error ? { ok: false, message: error.message } : { ok: true, message: "تنظیمات بازیابی ذخیره شد." };
}

// ── پرسونا / System Prompt (نسخه‌بندی) ──────────────────────────
export async function savePromptAction(
  content: string,
  persona: string
): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  if (content.trim().length < 20) return { ok: false, message: "متن پرامپت خیلی کوتاه است." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, message: "اتصال Supabase برقرار نیست." };

  // نسخه‌ی جدید را فعال و بقیه را غیرفعال کن
  await supabase.from("prompt_versions").update({ is_active: false }).eq("is_active", true);
  const { error } = await supabase.from("prompt_versions").insert({
    content: content.trim(),
    persona: persona.trim() || null,
    is_active: true,
    created_by: "admin",
  });
  revalidatePath("/admin/persona");
  return error ? { ok: false, message: error.message } : { ok: true, message: "نسخه‌ی جدید پرسونا فعال شد." };
}

export async function activatePromptAction(id: string): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, message: "اتصال Supabase برقرار نیست." };
  await supabase.from("prompt_versions").update({ is_active: false }).eq("is_active", true);
  const { error } = await supabase.from("prompt_versions").update({ is_active: true }).eq("id", id);
  revalidatePath("/admin/persona");
  return error ? { ok: false, message: error.message } : { ok: true, message: "این نسخه فعال شد." };
}

// ── پلی‌گراند (تست بدون ذخیره) ──────────────────────────────────
export async function playgroundAction(
  query: string
): Promise<{
  ok: boolean;
  answer?: string;
  chunks?: { title: string; similarity: number; content: string }[];
  model?: string;
  message?: string;
}> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  if (query.trim().length < 2) return { ok: false, message: "پرسش خالی است." };
  try {
    const chunks = await retrieve(query.trim());
    const context = buildContext(chunks);
    const basePrompt = await getActivePrompt();
    const modelCfg = await getModelConfig("web");
    const system = context
      ? `${basePrompt}\n\n# منابع بازیابی‌شده\nفقط از منابع زیر استفاده کن:\n\n${context}`
      : `${basePrompt}\n\n(منبعی یافت نشد.)`;
    // بدون onFinish و بدون ابزار ⇒ چیزی در دیتابیس ذخیره نمی‌شود
    const result = streamChat({
      model: modelCfg.active_model,
      system,
      messages: [{ role: "user", content: query.trim() }],
      temperature: modelCfg.temperature,
      topP: modelCfg.top_p,
      maxOutputTokens: modelCfg.max_tokens,
    });
    const answer = await result.text;
    return {
      ok: true,
      answer: answer?.trim() || "مدل پاسخ متنی تولید نکرد (احتمالاً سقف توکن صرف استدلال شد). دوباره یا با سؤال دیگری امتحان کنید.",
      model: modelCfg.active_model,
      chunks: chunks.map((c) => ({
        title: c.title,
        similarity: Math.round(c.similarity * 100) / 100,
        content: c.content.slice(0, 320),
      })),
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ── تلگرام ───────────────────────────────────────────────────────
const SITE_URL = "https://arkan-website-chatbot.vercel.app";

export async function getTelegramStatusAction(): Promise<{
  ok: boolean;
  configured: boolean;
  username?: string;
  webhookUrl?: string;
  pending?: number;
  message?: string;
}> {
  if (!guard()) return { ok: false, configured: false, message: "دسترسی غیرمجاز." };
  const { isTelegramConfigured, getMe, getWebhookInfo } = await import("@/lib/telegram");
  if (!isTelegramConfigured()) return { ok: true, configured: false };
  try {
    const me = await getMe();
    const info = await getWebhookInfo();
    return {
      ok: true,
      configured: true,
      username: me?.result?.username,
      webhookUrl: info?.result?.url || "",
      pending: info?.result?.pending_update_count ?? 0,
    };
  } catch (e) {
    return { ok: false, configured: true, message: (e as Error).message };
  }
}

export async function setTelegramWebhookAction(): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return { ok: false, message: "TELEGRAM_WEBHOOK_SECRET تنظیم نشده است." };
  const { setWebhook } = await import("@/lib/telegram");
  try {
    const res = (await setWebhook(`${SITE_URL}/api/telegram/webhook`, secret)) as { ok: boolean; description?: string };
    return res.ok
      ? { ok: true, message: "Webhook با موفقیت تنظیم شد." }
      : { ok: false, message: res.description ?? "تنظیم webhook ناموفق بود." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteTelegramWebhookAction(): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const { deleteWebhook } = await import("@/lib/telegram");
  try {
    await deleteWebhook();
    return { ok: true, message: "Webhook حذف شد." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function broadcastTelegramAction(text: string): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  if (text.trim().length < 2) return { ok: false, message: "متن پیام خالی است." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, message: "اتصال Supabase برقرار نیست." };

  const { data: users } = await supabase
    .from("unified_users")
    .select("external_id")
    .eq("channel", "telegram");
  if (!users || users.length === 0) return { ok: false, message: "هنوز کاربر تلگرامی ثبت نشده است." };

  const { sendMessage } = await import("@/lib/telegram");
  let sent = 0;
  for (const u of users) {
    try {
      const r = (await sendMessage(u.external_id, text.trim())) as { ok: boolean };
      if (r.ok) sent++;
    } catch {
      /* رد کن */
    }
  }
  return { ok: true, message: `پیام به ${sent} از ${users.length} کاربر ارسال شد.` };
}

// ── پیکربندی ویجت ───────────────────────────────────────────────
export async function saveWidgetConfigAction(values: {
  enabled: boolean;
  primary_color: string;
  position: string;
  welcome_message: string;
  launcher_text: string;
  allowed_domains: string[];
}): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, message: "اتصال Supabase برقرار نیست." };

  const { data: existing } = await supabase
    .from("widget_config")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = { ...values, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from("widget_config").update(payload).eq("id", existing.id)
    : await supabase.from("widget_config").insert(payload);

  revalidatePath("/admin/widget");
  return error ? { ok: false, message: error.message } : { ok: true, message: "تنظیمات ویجت ذخیره شد." };
}

// ── جزئیات یک گفتگو (پیام‌ها + منابع RAG هر پاسخ) ───────────────
export type ConvMessage = {
  id: string;
  role: string;
  content: string;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
  retrieved: { title: string; content: string }[];
};

export async function getConversationDetailAction(
  conversationId: string
): Promise<{ ok: boolean; messages?: ConvMessage[]; message?: string }> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, message: "اتصال Supabase برقرار نیست." };

  const { data: msgs, error } = await supabase
    .from("messages")
    .select("id, role, content, model_used, tokens_in, tokens_out, retrieved_chunk_ids, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message };

  // جمع‌آوری chunkهای بازیابی‌شده
  const allChunkIds = Array.from(
    new Set((msgs ?? []).flatMap((m) => (m.retrieved_chunk_ids as string[] | null) ?? []))
  );
  const chunkMap = new Map<string, { title: string; content: string }>();
  if (allChunkIds.length > 0) {
    const { data: chunks } = await supabase
      .from("chunks")
      .select("id, content, document_id")
      .in("id", allChunkIds);
    const docIds = Array.from(new Set((chunks ?? []).map((c) => c.document_id)));
    const { data: docs } = await supabase.from("documents").select("id, title").in("id", docIds);
    const titleMap = new Map((docs ?? []).map((d) => [d.id, d.title as string]));
    for (const c of chunks ?? []) {
      chunkMap.set(c.id, {
        title: titleMap.get(c.document_id) ?? "سند",
        content: (c.content as string).slice(0, 240),
      });
    }
  }

  const messages: ConvMessage[] = (msgs ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    model_used: m.model_used,
    tokens_in: m.tokens_in,
    tokens_out: m.tokens_out,
    created_at: m.created_at,
    retrieved: ((m.retrieved_chunk_ids as string[] | null) ?? [])
      .map((id) => chunkMap.get(id))
      .filter(Boolean) as { title: string; content: string }[],
  }));

  return { ok: true, messages };
}
