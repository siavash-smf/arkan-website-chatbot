#!/usr/bin/env node
/**
 * بارگذاری انبوه پایگاه دانش آرکان در سیستم RAG (Supabase + pgvector).
 *
 * این اسکریپت بر اساس knowledge-base/manifest.json هر سند را با عنوان فارسی و
 * تگ موضوعی‌اش می‌خواند، متن را بر اساس فرمت استخراج می‌کند، قطعه‌بندی و با Cohere
 * embed می‌کند و در جداول documents/chunks می‌نویسد.
 *
 * اجرا (از ریشه‌ی پروژه):  node scripts/ingest-kb.mjs
 * متغیرها از .env.local خوانده می‌شوند: NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, COHERE_API_KEY, EMBEDDING_MODEL.
 *
 * نکته: نسخه‌های تکراریِ صرفاً فرمتی (docx معادل md، و pdf معادل html بروشور) رد
 * می‌شوند تا قطعه‌های تکراری وارد سیستم نشوند.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KB_DIR = path.join(ROOT, "knowledge-base");

// ── env از .env.local ──
function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  const env = {};
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  return env;
}
const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const COHERE_API_KEY = env.COHERE_API_KEY;
const EMBEDDING_MODEL = env.EMBEDDING_MODEL || "embed-multilingual-v3.0";

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("متغیرهای Supabase در .env.local نیست.");
if (!COHERE_API_KEY) throw new Error("COHERE_API_KEY در .env.local نیست.");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: "arkan" }, // جدول‌های آرکان در اسکیمای arkan هستند، نه public
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── استخراج متن بر اساس فرمت ──
function cleanText(t) {
  return t.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  const s = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function csvToText(csv) {
  const rows = parseCsv(csv);
  if (!rows.length) return "";
  const headers = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every((c) => !c.trim())) continue;
    out.push(headers.map((h, j) => (cells[j] ? `${h.trim()}: ${cells[j].trim()}` : "")).filter(Boolean).join(" — "));
  }
  return out.join("\n");
}
function jsonToText(str) {
  let data;
  try { data = JSON.parse(str); } catch { return str; }
  const out = [];
  const walk = (n) => {
    if (n == null) return;
    if (Array.isArray(n)) n.forEach(walk);
    else if (typeof n === "object") {
      for (const [k, v] of Object.entries(n)) {
        if (v == null) continue;
        if (typeof v === "object") walk(v);
        else out.push(`${k}: ${v}`);
      }
      out.push("");
    } else out.push(String(n));
  };
  walk(data);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function extract(fullPath, format) {
  const buf = fs.readFileSync(fullPath);
  switch (format) {
    case "html": return stripHtml(buf.toString("utf-8"));
    case "csv": return csvToText(buf.toString("utf-8"));
    case "json": return jsonToText(buf.toString("utf-8"));
    default: return buf.toString("utf-8"); // md/txt/yaml
  }
}

// ── قطعه‌بندی (هماهنگ با src/lib/rag/chunking.ts) ──
const CPT = 3.5;
const estTokens = (t) => Math.ceil(t.length / CPT);
function splitText(raw, chunkSizeTokens = 500, overlapTokens = 50) {
  const text = cleanText(raw);
  if (!text) return [];
  const maxChars = Math.max(200, Math.floor(chunkSizeTokens * CPT));
  const overlapChars = Math.max(0, Math.floor(overlapTokens * CPT));
  const units = [];
  for (const para of text.split(/\n{2,}/)) {
    const t = para.trim(); if (!t) continue;
    for (const s of t.split(/(?<=[.!?؟،؛\n])\s+/)) if (s.trim()) units.push(s.trim());
  }
  const chunks = []; let buf = "";
  const flush = () => { const c = buf.trim(); if (c) chunks.push(c); };
  for (const u of units) {
    if (buf.length + u.length + 1 > maxChars && buf.length > 0) {
      flush();
      buf = overlapChars > 0 ? buf.slice(-overlapChars) + " " : "";
    }
    if (u.length > maxChars) {
      if (buf.trim()) flush(); buf = "";
      for (let i = 0; i < u.length; i += maxChars - overlapChars) chunks.push(u.slice(i, i + maxChars).trim());
      continue;
    }
    buf += (buf ? " " : "") + u;
  }
  flush();
  return chunks;
}

// ── embedding با Cohere ──
async function embed(texts) {
  const res = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: { Authorization: `Bearer ${COHERE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, texts, input_type: "search_document", embedding_types: ["float"] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Cohere ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.embeddings.float;
}

// ── اجرا ──
async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(KB_DIR, "manifest.json"), "utf-8"));
  const docs = manifest.documents;
  console.log(`📚 ${docs.length} سند در manifest. شروع بارگذاری…\n`);

  let okCount = 0, skipCount = 0, totalChunks = 0;
  for (const d of docs) {
    // رد کردن تکراری‌های صرفاً فرمتی
    if (d.format === "docx" || d.format === "pdf") {
      console.log(`⏭️  رد شد (تکراری فرمتی): ${d.title} [${d.format}]`);
      skipCount++;
      continue;
    }
    const fullPath = path.join(KB_DIR, d.path);
    if (!fs.existsSync(fullPath)) { console.log(`⚠️  فایل نیست: ${d.path}`); continue; }

    try {
      const text = cleanText(extract(fullPath, d.format));
      if (text.length < 20) { console.log(`⚠️  متن کوتاه: ${d.title}`); continue; }
      const chunks = splitText(text);
      // embed دسته‌ای
      const vectors = [];
      for (let i = 0; i < chunks.length; i += 90) vectors.push(...(await embed(chunks.slice(i, i + 90))));

      const { data: doc, error: de } = await supabase
        .from("documents")
        .insert({ title: d.title, source_type: d.format, status: "processing", tags: d.topic ? [d.topic] : null })
        .select("id").single();
      if (de) throw new Error(de.message);

      const rows = chunks.map((c, i) => ({
        document_id: doc.id, content: c, embedding: vectors[i], token_count: estTokens(c), chunk_index: i,
      }));
      const { error: ce } = await supabase.from("chunks").insert(rows);
      if (ce) throw new Error(ce.message);

      await supabase.from("documents").update({ status: "ready", chunk_count: chunks.length }).eq("id", doc.id);
      console.log(`✅ ${d.title} — ${chunks.length} قطعه [تگ: ${d.topic}]`);
      okCount++; totalChunks += chunks.length;
    } catch (e) {
      console.log(`❌ ${d.title}: ${e.message}`);
    }
  }

  console.log(`\n🎉 پایان: ${okCount} سند، ${totalChunks} قطعه ایندکس شد (${skipCount} تکراری رد شد).`);
}

main().catch((e) => { console.error("خطای کلی:", e); process.exit(1); });
