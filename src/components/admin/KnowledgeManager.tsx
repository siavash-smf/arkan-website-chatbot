"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toFa } from "@/lib/utils";
import {
  ingestTextAction,
  ingestUrlAction,
  ingestFilesAction,
  deleteDocAction,
  reindexDocAction,
  testSearchAction,
} from "@/app/admin/chatbot-actions";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

export type DocRow = {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  status: string;
  chunk_count: number;
  error: string | null;
  tags: string[] | null;
  created_at: string;
};

const FILE_ACCEPT = ".md,.markdown,.txt,.csv,.json,.yaml,.yml,.html,.htm,.pdf";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "در صف", cls: "bg-sand text-slate" },
  processing: { label: "در حال پردازش", cls: "bg-brass/15 text-brass-dark" },
  ready: { label: "آماده", cls: "bg-green-100 text-green-700" },
  error: { label: "خطا", cls: "bg-red-100 text-red-700" },
};

type Tab = "text" | "url" | "file";

export default function KnowledgeManager({ docs, error }: { docs: DocRow[]; error: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("text");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(p: Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const res = await p;
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "انجام شد." : "خطا.") });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">پایگاه دانش</h1>
        <p className="mt-1 text-caption text-slate">
          منابعی که چت‌بات بر پایه‌ی آن‌ها پاسخ می‌دهد. مجموعاً {toFa(docs.length)} سند.
        </p>
      </div>

      {error && (
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
          {error}
        </div>
      )}

      {/* افزودن منبع */}
      <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
        <h2 className="mb-4 font-heading text-body font-semibold text-pine">افزودن منبع جدید</h2>
        <div className="mb-5 flex gap-1 border-b border-sand">
          {([["text", "متن"], ["url", "آدرس وب"], ["file", "فایل"]] as [Tab, string][]).map(
            ([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-4 py-2 text-[0.95rem] transition-colors ${
                  tab === k ? "border-brass font-medium text-pine" : "border-transparent text-slate hover:text-pine"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>

        {msg && (
          <div
            className={`mb-4 rounded-btn px-4 py-2.5 text-caption ${
              msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        {tab === "text" && <TextForm pending={pending} onSubmit={(t, c, tags) => run(ingestTextAction(t, c, tags))} />}
        {tab === "url" && <UrlForm pending={pending} onSubmit={(u, t, tags) => run(ingestUrlAction(u, t, tags))} />}
        {tab === "file" && <FilesForm pending={pending} onSubmit={(fd) => run(ingestFilesAction(fd))} />}
      </section>

      {/* جست‌وجوی آزمایشی */}
      <TestSearch />

      {/* لیست اسناد */}
      <section>
        <h2 className="mb-3 font-heading text-body font-semibold text-pine">اسناد</h2>
        {docs.length === 0 ? (
          <div className="rounded-card border border-dashed border-sand bg-white px-5 py-12 text-center text-slate">
            هنوز سندی اضافه نشده است.
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => {
              const sm = STATUS_META[d.status] ?? STATUS_META.pending;
              return (
                <div
                  key={d.id}
                  className="flex flex-col gap-3 rounded-card border border-sand bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{d.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.75rem] ${sm.cls}`}>{sm.label}</span>
                      <span className="text-[0.75rem] text-slate">
                        {d.source_type} · {toFa(d.chunk_count)} قطعه
                      </span>
                    </div>
                    {d.tags && d.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {d.tags.map((t) => (
                          <span key={t} className="rounded-full bg-sand px-2 py-0.5 text-[0.7rem] text-pine">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {d.error && <p className="mt-1 text-[0.8rem] text-red-600">{d.error}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(reindexDocAction(d.id))}
                      className="rounded-btn border border-pine/25 px-3 py-1.5 text-caption text-pine transition-colors hover:bg-pine/5 disabled:opacity-50"
                    >
                      بازسازی
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`حذف سند «${d.title}»؟`)) run(deleteDocAction(d.id));
                      }}
                      className="rounded-btn border border-red-200 px-3 py-1.5 text-caption text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const inputCls =
  "w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink transition-colors placeholder:text-slate/60 focus:border-brass focus:outline-none";
const labelCls = "mb-1.5 block text-caption font-medium text-ink";
const submitCls =
  "inline-flex min-h-[44px] items-center justify-center rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60";

function TagsInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>برچسب‌ها (اختیاری، با ویرگول جدا کنید)</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder="مثلاً: خدمات، قیمت" />
    </div>
  );
}

function TextForm({ pending, onSubmit }: { pending: boolean; onSubmit: (t: string, c: string, tags?: string) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>عنوان سند</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="مثلاً: خدمات آرکان" />
      </div>
      <div>
        <label className={labelCls}>متن</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className={`${inputCls} resize-y leading-7`} placeholder="متن منبع را اینجا بچسبانید…" />
      </div>
      <TagsInput value={tags} onChange={setTags} />
      <button type="button" disabled={pending || !title.trim() || text.trim().length < 20} onClick={() => onSubmit(title, text, tags || undefined)} className={submitCls}>
        {pending ? "در حال پردازش…" : "افزودن و ایندکس"}
      </button>
    </div>
  );
}

function UrlForm({ pending, onSubmit }: { pending: boolean; onSubmit: (u: string, t?: string, tags?: string) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>آدرس صفحه (URL)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" className={inputCls} placeholder="https://example.com/page" />
      </div>
      <div>
        <label className={labelCls}>عنوان (اختیاری)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="در صورت خالی، از عنوان صفحه استفاده می‌شود" />
      </div>
      <TagsInput value={tags} onChange={setTags} />
      <button type="button" disabled={pending || !url.trim()} onClick={() => onSubmit(url, title || undefined, tags || undefined)} className={submitCls}>
        {pending ? "در حال پردازش…" : "دریافت و ایندکس"}
      </button>
    </div>
  );
}

function FilesForm({ pending, onSubmit }: { pending: boolean; onSubmit: (fd: FormData) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [tags, setTags] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>فایل‌ها (md، txt، csv، json، yaml، html، pdf — حداکثر ۱۰ مگابایت هر فایل)</label>
        <input
          type="file"
          multiple
          accept={FILE_ACCEPT}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-[0.9rem] text-slate file:ml-3 file:rounded-btn file:border-0 file:bg-sand file:px-4 file:py-2 file:text-pine"
        />
        {files.length > 0 && (
          <p className="mt-1.5 text-[0.8rem] text-slate">{toFa(files.length)} فایل انتخاب شد.</p>
        )}
      </div>
      <TagsInput value={tags} onChange={setTags} />
      <button
        type="button"
        disabled={pending || files.length === 0}
        onClick={() => {
          if (files.length === 0) return;
          const fd = new FormData();
          files.forEach((f) => fd.append("files", f));
          if (tags) fd.append("tags", tags);
          onSubmit(fd);
        }}
        className={submitCls}
      >
        {pending ? "در حال پردازش…" : "آپلود و ایندکس"}
      </button>
    </div>
  );
}

function TestSearch() {
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [results, setResults] = useState<RetrievedChunk[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function search() {
    setErr(null);
    start(async () => {
      const res = await testSearchAction(q);
      if (res.ok) setResults(res.chunks ?? []);
      else setErr(res.message ?? "خطا");
    });
  }

  return (
    <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
      <h2 className="mb-4 font-heading text-body font-semibold text-pine">جست‌وجوی آزمایشی</h2>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          className={inputCls}
          placeholder="یک سؤال آزمایشی بنویسید تا chunkهای بازیابی‌شده را ببینید…"
        />
        <button type="button" disabled={pending || !q.trim()} onClick={search} className={submitCls}>
          {pending ? "…" : "جست‌وجو"}
        </button>
      </div>
      {err && <p className="mt-3 text-caption text-red-600">{err}</p>}
      {results && (
        <div className="mt-4 space-y-2">
          {results.length === 0 ? (
            <p className="text-caption text-slate">نتیجه‌ای بالای آستانه‌ی شباهت یافت نشد.</p>
          ) : (
            results.map((c) => (
              <div key={c.id} className="rounded-btn border border-sand bg-bone px-4 py-3">
                <div className="mb-1 flex items-center justify-between text-[0.75rem] text-slate">
                  <span className="font-medium text-pine">{c.title}</span>
                  <span>شباهت: {toFa(Math.round(c.similarity * 100))}٪</span>
                </div>
                <p className="text-[0.85rem] leading-7 text-ink">{c.content.slice(0, 220)}…</p>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
