"use server";

import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  ingestDocument,
  deleteDocument,
  reindexDocument,
} from "@/lib/rag/ingest";
import { retrieve, type RetrievedChunk } from "@/lib/rag/retrieve";

type ActionResult = { ok: boolean; message?: string };

function guard(): boolean {
  return isAuthed();
}

// ── پایگاه دانش ─────────────────────────────────────────────────
export async function ingestTextAction(
  title: string,
  text: string
): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  if (!title.trim() || text.trim().length < 20) {
    return { ok: false, message: "عنوان و متن (حداقل ۲۰ نویسه) لازم است." };
  }
  const res = await ingestDocument({ type: "text", title: title.trim(), text });
  revalidatePath("/admin/knowledge");
  return res.ok
    ? { ok: true, message: `سند با ${res.chunkCount} قطعه ثبت شد.` }
    : { ok: false, message: res.error };
}

export async function ingestUrlAction(url: string, title?: string): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  if (!/^https?:\/\//i.test(url.trim())) {
    return { ok: false, message: "آدرس URL معتبر نیست." };
  }
  const res = await ingestDocument({ type: "url", url: url.trim(), title: title?.trim() });
  revalidatePath("/admin/knowledge");
  return res.ok
    ? { ok: true, message: `سند با ${res.chunkCount} قطعه ثبت شد.` }
    : { ok: false, message: res.error };
}

export async function ingestPdfAction(formData: FormData): Promise<ActionResult> {
  if (!guard()) return { ok: false, message: "دسترسی غیرمجاز." };
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  if (!file || file.size === 0) return { ok: false, message: "فایلی انتخاب نشده." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: "حجم فایل بیش از ۱۰ مگابایت است." };
  const buffer = Buffer.from(await file.arrayBuffer());
  const res = await ingestDocument({
    type: "pdf",
    title: title || file.name.replace(/\.pdf$/i, ""),
    buffer,
  });
  revalidatePath("/admin/knowledge");
  return res.ok
    ? { ok: true, message: `سند با ${res.chunkCount} قطعه ثبت شد.` }
    : { ok: false, message: res.error };
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
