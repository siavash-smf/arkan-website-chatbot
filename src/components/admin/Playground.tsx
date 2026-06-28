"use client";

import { useState, useTransition } from "react";
import { toFa } from "@/lib/utils";
import { playgroundAction } from "@/app/admin/chatbot-actions";

type Result = {
  answer: string;
  model: string;
  chunks: { title: string; similarity: number; content: string }[];
};

export default function Playground() {
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null);
    start(async () => {
      const res = await playgroundAction(query);
      if (res.ok) setResult({ answer: res.answer!, model: res.model!, chunks: res.chunks ?? [] });
      else {
        setResult(null);
        setErr(res.message ?? "خطا");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">پلی‌گراند</h1>
        <p className="mt-1 text-caption text-slate">
          یک پرسش را تست کنید و هم‌زمان پاسخ مدل و قطعه‌های بازیابی‌شده را ببینید. اینجا چیزی در گفتگوها ذخیره نمی‌شود.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          className="w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-4 py-2.5 text-[0.95rem] text-ink focus:border-brass focus:outline-none"
          placeholder="یک پرسش بنویسید…"
        />
        <button
          type="button"
          disabled={pending || query.trim().length < 2}
          onClick={run}
          className="shrink-0 rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
        >
          {pending ? "…" : "اجرا"}
        </button>
      </div>

      {err && <div className="rounded-btn bg-red-50 px-4 py-3 text-caption text-red-700">{err}</div>}

      {result && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* پاسخ */}
          <section className="rounded-card border border-sand bg-white p-5 shadow-soft">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-heading text-body font-semibold text-pine">پاسخ مدل</h2>
              <span dir="ltr" className="text-[0.75rem] text-slate">{result.model}</span>
            </div>
            <p className="whitespace-pre-wrap text-[0.92rem] leading-8 text-ink">{result.answer}</p>
          </section>

          {/* قطعه‌های بازیابی‌شده */}
          <section className="rounded-card border border-sand bg-white p-5 shadow-soft">
            <h2 className="mb-3 font-heading text-body font-semibold text-pine">
              قطعه‌های بازیابی‌شده ({toFa(result.chunks.length)})
            </h2>
            {result.chunks.length === 0 ? (
              <p className="text-caption text-slate">منبعی بالای آستانه‌ی شباهت یافت نشد.</p>
            ) : (
              <div className="space-y-2">
                {result.chunks.map((c, i) => (
                  <div key={i} className="rounded-btn border border-sand bg-bone px-3.5 py-2.5">
                    <div className="mb-1 flex items-center justify-between text-[0.75rem]">
                      <span className="font-medium text-pine">{c.title}</span>
                      <span className="text-slate">شباهت: {toFa(Math.round(c.similarity * 100))}٪</span>
                    </div>
                    <p className="text-[0.82rem] leading-6 text-slate">{c.content}…</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
