import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { embed } from "./embeddings";
import { splitText, cleanText } from "./chunking";
import { getEmbeddingConfig } from "./config";

/**
 * پایپ‌لاین Ingestion: استخراج متن از منبع → پاک‌سازی → chunk → embed → ذخیره در pgvector.
 */

export type IngestSource =
  | { type: "text"; title: string; text: string; tags?: string[] }
  | { type: "url"; title?: string; url: string; tags?: string[] }
  | { type: "pdf"; title: string; buffer: Buffer; tags?: string[] };

export type IngestResult = {
  ok: boolean;
  documentId?: string;
  chunkCount?: number;
  error?: string;
};

export async function ingestDocument(source: IngestSource): Promise<IngestResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال Supabase برقرار نیست." };

  // ۱) استخراج متن
  let title: string;
  let text: string;
  let sourceUrl: string | null = null;
  try {
    if (source.type === "text") {
      title = source.title;
      text = source.text;
    } else if (source.type === "url") {
      sourceUrl = source.url;
      const extracted = await extractFromUrl(source.url);
      title = source.title || extracted.title || source.url;
      text = extracted.text;
    } else {
      title = source.title;
      text = await extractFromPdf(source.buffer);
    }
  } catch (e) {
    return { ok: false, error: `استخراج متن ناموفق بود: ${(e as Error).message}` };
  }

  text = cleanText(text);
  if (!text || text.length < 20) {
    return { ok: false, error: "متن قابل‌استخراج از این منبع خیلی کوتاه یا خالی بود." };
  }

  // ۲) ساخت ردیف سند (status=processing)
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      title,
      source_type: source.type,
      source_url: sourceUrl,
      status: "processing",
      tags: source.tags ?? null,
    })
    .select("id")
    .single();
  if (docErr || !doc) {
    return { ok: false, error: docErr?.message ?? "ساخت سند ناموفق بود." };
  }
  const documentId = doc.id as string;

  try {
    // ۳) chunk
    const cfg = await getEmbeddingConfig();
    const chunks = splitText(text, cfg.chunk_size, cfg.chunk_overlap);
    if (chunks.length === 0) throw new Error("هیچ قطعه‌ای تولید نشد.");

    // ۴) embed (دسته‌ای تا ۹۶ تایی برای رعایت محدودیت Cohere)
    const allVectors: number[][] = [];
    const BATCH = 90;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH).map((c) => c.content);
      const vectors = await embed(batch, "document", cfg);
      allVectors.push(...vectors);
    }

    // ۵) ذخیره‌ی chunkها
    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      content: c.content,
      embedding: allVectors[i],
      token_count: c.tokenCount,
      chunk_index: c.index,
    }));
    const { error: chunkErr } = await supabase.from("chunks").insert(rows);
    if (chunkErr) throw new Error(chunkErr.message);

    // ۶) به‌روزرسانی وضعیت سند
    await supabase
      .from("documents")
      .update({ status: "ready", chunk_count: chunks.length, error: null })
      .eq("id", documentId);

    return { ok: true, documentId, chunkCount: chunks.length };
  } catch (e) {
    const msg = (e as Error).message;
    await supabase
      .from("documents")
      .update({ status: "error", error: msg })
      .eq("id", documentId);
    return { ok: false, documentId, error: msg };
  }
}

/** حذف یک سند و chunkهایش (cascade در DB). */
export async function deleteDocument(documentId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال Supabase برقرار نیست." };
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** بازسازی ایندکس یک سند: chunkهای قبلی حذف و دوباره embed می‌شوند (با متن ذخیره‌شده). */
export async function reindexDocument(documentId: string): Promise<IngestResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال Supabase برقرار نیست." };

  // متن را از chunkهای موجود بازسازی می‌کنیم (به‌ترتیب)
  const { data: existing } = await supabase
    .from("chunks")
    .select("content, chunk_index")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });
  if (!existing || existing.length === 0) {
    return { ok: false, error: "محتوایی برای بازسازی یافت نشد." };
  }
  const text = existing.map((c) => c.content).join("\n\n");

  await supabase.from("chunks").delete().eq("document_id", documentId);
  await supabase.from("documents").update({ status: "processing" }).eq("id", documentId);

  try {
    const cfg = await getEmbeddingConfig();
    const chunks = splitText(text, cfg.chunk_size, cfg.chunk_overlap);
    const allVectors: number[][] = [];
    const BATCH = 90;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH).map((c) => c.content);
      allVectors.push(...(await embed(batch, "document", cfg)));
    }
    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      content: c.content,
      embedding: allVectors[i],
      token_count: c.tokenCount,
      chunk_index: c.index,
    }));
    await supabase.from("chunks").insert(rows);
    await supabase
      .from("documents")
      .update({ status: "ready", chunk_count: chunks.length, error: null })
      .eq("id", documentId);
    return { ok: true, documentId, chunkCount: chunks.length };
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("documents").update({ status: "error", error: msg }).eq("id", documentId);
    return { ok: false, documentId, error: msg };
  }
}

// ── استخراج متن از منابع ─────────────────────────────────────────

async function extractFromUrl(url: string): Promise<{ title: string; text: string }> {
  const res = await fetch(url, { headers: { "User-Agent": "ArkanBot/1.0" } });
  if (!res.ok) throw new Error(`دریافت URL ناموفق بود (${res.status}).`);
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : url;
  const text = stripHtml(html);
  return { title, text };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2: کلاس PDFParse
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text ?? "";
}
