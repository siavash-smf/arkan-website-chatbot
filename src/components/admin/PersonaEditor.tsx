"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePromptAction, activatePromptAction } from "@/app/admin/chatbot-actions";

export type PromptVersion = {
  id: string;
  content: string;
  persona: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function PersonaEditor({
  versions,
  error,
  defaultPrompt,
}: {
  versions: PromptVersion[];
  error: string | null;
  defaultPrompt: string;
}) {
  const router = useRouter();
  const active = versions.find((v) => v.is_active);
  const [content, setContent] = useState(active?.content ?? defaultPrompt);
  const [persona, setPersona] = useState(active?.persona ?? "حکیمِ آرام آرکان");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    start(async () => {
      const res = await savePromptAction(content, persona);
      setMsg({ ok: res.ok, text: res.message ?? "" });
      if (res.ok) router.refresh();
    });
  }

  function activate(id: string) {
    start(async () => {
      const res = await activatePromptAction(id);
      setMsg({ ok: res.ok, text: res.message ?? "" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">پرسونا و System Prompt</h1>
        <p className="mt-1 text-caption text-slate">
          لحن و رفتار چت‌بات از اینجا کنترل می‌شود. هر ذخیره یک «نسخه‌ی جدید» می‌سازد و آن را فعال می‌کند؛ می‌توانید به نسخه‌های قبلی برگردید.
        </p>
      </div>

      {error && <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">{error}</div>}

      <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
        <div className="mb-4">
          <label className="mb-1.5 block text-caption font-medium text-ink">برچسب پرسونا</label>
          <input
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink focus:border-brass focus:outline-none"
            placeholder="مثلاً: حکیمِ آرام آرکان"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-caption font-medium text-ink">متن System Prompt</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            dir="rtl"
            className="w-full rounded-btn border border-slate/30 bg-white px-3.5 py-3 text-[0.9rem] leading-8 text-ink focus:border-brass focus:outline-none"
          />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            disabled={pending || content.trim().length < 20}
            onClick={save}
            className="inline-flex min-h-[44px] items-center justify-center rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
          >
            {pending ? "در حال ذخیره…" : "ذخیره به‌عنوان نسخه‌ی فعال"}
          </button>
          <button
            type="button"
            onClick={() => setContent(defaultPrompt)}
            className="text-caption text-slate underline-offset-4 hover:underline"
          >
            بازگردانی به پیش‌فرض
          </button>
          {msg && <span className={`text-caption ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-body font-semibold text-pine">نسخه‌ها</h2>
        {versions.length === 0 ? (
          <p className="rounded-card border border-dashed border-sand bg-white px-5 py-10 text-center text-slate">
            هنوز نسخه‌ای ذخیره نشده؛ پیش‌فرض داخلی استفاده می‌شود.
          </p>
        ) : (
          <div className="space-y-3">
            {versions.map((v) => (
              <div key={v.id} className="rounded-card border border-sand bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{v.persona || "بدون برچسب"}</span>
                    {v.is_active && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[0.75rem] text-green-700">فعال</span>
                    )}
                    <span className="text-[0.75rem] text-slate">{fmt(v.created_at)}</span>
                  </div>
                  {!v.is_active && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => activate(v.id)}
                      className="rounded-btn border border-pine/25 px-3 py-1.5 text-caption text-pine transition-colors hover:bg-pine/5 disabled:opacity-50"
                    >
                      فعال‌سازی
                    </button>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[0.85rem] leading-6 text-slate">{v.content.slice(0, 200)}…</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
