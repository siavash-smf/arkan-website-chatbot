"use client";

import { useState, useTransition } from "react";
import type { ModelConfig, EmbeddingConfig } from "@/lib/rag/config";
import { saveModelConfigAction, saveEmbeddingConfigAction } from "@/app/admin/chatbot-actions";

const MODEL_GROUPS: { provider: string; models: { slug: string; label: string }[] }[] = [
  { provider: "Anthropic (Claude)", models: [{ slug: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" }] },
  {
    provider: "Google (Gemini)",
    models: [
      { slug: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { slug: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
      { slug: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
  {
    provider: "OpenAI",
    models: [
      { slug: "openai/gpt-5-mini", label: "GPT-5 Mini" },
      { slug: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano" },
      { slug: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    ],
  },
  { provider: "Qwen", models: [{ slug: "qwen/qwen3-30b-a3b-instruct-2507", label: "Qwen3 30B" }] },
];

const labelCls = "mb-1.5 block text-caption font-medium text-ink";
const inputCls =
  "w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink focus:border-brass focus:outline-none";
const saveCls =
  "inline-flex min-h-[44px] items-center justify-center rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60";

export default function ModelSettings({ model, embedding }: { model: ModelConfig; embedding: EmbeddingConfig }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">مدل‌ها و بازیابی</h1>
        <p className="mt-1 text-caption text-slate">همه‌ی مدل‌های تولید پاسخ از طریق OpenRouter فراخوانی می‌شوند؛ تعویض مدل فقط تغییر یک گزینه است.</p>
      </div>
      <ModelForm model={model} />
      <EmbeddingForm embedding={embedding} />
    </div>
  );
}

function ModelForm({ model }: { model: ModelConfig }) {
  const [activeModel, setActiveModel] = useState(model.active_model);
  const [fallback, setFallback] = useState(model.fallback_model ?? "");
  const [temperature, setTemperature] = useState(model.temperature);
  const [maxTokens, setMaxTokens] = useState(model.max_tokens);
  const [topP, setTopP] = useState(model.top_p);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // اگر مدل فعلی در فهرست نبود، آن را اضافه کن
  const known = MODEL_GROUPS.flatMap((g) => g.models.map((m) => m.slug));
  const extra = known.includes(activeModel) ? [] : [activeModel];

  function save() {
    start(async () => {
      const res = await saveModelConfigAction({
        active_model: activeModel,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        fallback_model: fallback || null,
      });
      setMsg({ ok: res.ok, text: res.message ?? "" });
    });
  }

  return (
    <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
      <h2 className="mb-4 font-heading text-body font-semibold text-pine">مدل تولید پاسخ</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>مدل فعال</label>
          <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)} className={`${inputCls} cursor-pointer`}>
            {extra.map((s) => (
              <option key={s} value={s}>{s} (فعلی)</option>
            ))}
            {MODEL_GROUPS.map((g) => (
              <optgroup key={g.provider} label={g.provider}>
                {g.models.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.label} — {m.slug}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>مدل جایگزین (fallback)</label>
          <select value={fallback} onChange={(e) => setFallback(e.target.value)} className={`${inputCls} cursor-pointer`}>
            <option value="">بدون</option>
            {MODEL_GROUPS.map((g) => (
              <optgroup key={g.provider} label={g.provider}>
                {g.models.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Temperature ({temperature})</label>
          <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-pine" />
        </div>
        <div>
          <label className={labelCls}>حداکثر توکن پاسخ</label>
          <input type="number" min={100} max={4000} step={50} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>top_p ({topP})</label>
          <input type="range" min={0.1} max={1} step={0.05} value={topP} onChange={(e) => setTopP(Number(e.target.value))} className="w-full accent-pine" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className={saveCls}>
          {pending ? "در حال ذخیره…" : "ذخیره‌ی تنظیمات مدل"}
        </button>
        {msg && <span className={`text-caption ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}

function EmbeddingForm({ embedding }: { embedding: EmbeddingConfig }) {
  const [chunkSize, setChunkSize] = useState(embedding.chunk_size);
  const [overlap, setOverlap] = useState(embedding.chunk_overlap);
  const [topK, setTopK] = useState(embedding.top_k);
  const [threshold, setThreshold] = useState(embedding.similarity_threshold);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    start(async () => {
      const res = await saveEmbeddingConfigAction({
        chunk_size: chunkSize,
        chunk_overlap: overlap,
        top_k: topK,
        similarity_threshold: threshold,
      });
      setMsg({ ok: res.ok, text: res.message ?? "" });
    });
  }

  return (
    <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
      <h2 className="mb-2 font-heading text-body font-semibold text-pine">Embedding و بازیابی</h2>
      <div className="mb-4 rounded-btn bg-sand/60 px-4 py-3 text-[0.85rem] leading-7 text-slate">
        مدل embedding فعلی: <b className="text-pine">{embedding.provider} / {embedding.model}</b> ({embedding.dimensions} بُعد).
        تغییر مدل embedding یا ابعاد، نیاز به <b>بازسازی کامل ایندکس</b> دارد و در نسخه‌ی بعدی پنل فعال می‌شود.
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>اندازه‌ی قطعه (توکن)</label>
          <input type="number" min={100} max={1500} step={50} value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>همپوشانی (توکن)</label>
          <input type="number" min={0} max={300} step={10} value={overlap} onChange={(e) => setOverlap(Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>top_k (تعداد منبع بازیابی)</label>
          <input type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>آستانه‌ی شباهت ({threshold})</label>
          <input type="range" min={0} max={0.9} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-pine" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className={saveCls}>
          {pending ? "در حال ذخیره…" : "ذخیره‌ی تنظیمات بازیابی"}
        </button>
        {msg && <span className={`text-caption ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
