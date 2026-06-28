"use client";

import { useState, useTransition } from "react";
import type { WidgetConfig } from "@/lib/rag/widget";
import { saveWidgetConfigAction } from "@/app/admin/chatbot-actions";

const labelCls = "mb-1.5 block text-caption font-medium text-ink";
const inputCls =
  "w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink focus:border-brass focus:outline-none";

export default function WidgetSettings({ config, siteUrl }: { config: WidgetConfig; siteUrl: string }) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [color, setColor] = useState(config.primary_color);
  const [position, setPosition] = useState(config.position);
  const [launcher, setLauncher] = useState(config.launcher_text);
  const [welcome, setWelcome] = useState(config.welcome_message);
  const [domains, setDomains] = useState((config.allowed_domains ?? []).join("\n"));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const snippet = `<script src="${siteUrl}/widget.js" async></script>`;

  function save() {
    start(async () => {
      const allowed = domains
        .split(/[\n,،]/)
        .map((d) => d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
        .filter(Boolean)
        // به فرم origin برای frame-ancestors (https://domain)
        .map((d) => (d.startsWith("http") ? d : `https://${d}`));
      const res = await saveWidgetConfigAction({
        enabled,
        primary_color: color,
        position,
        welcome_message: welcome,
        launcher_text: launcher,
        allowed_domains: allowed,
      });
      setMsg({ ok: res.ok, text: res.message ?? "" });
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">ویجت قابل‌جاسازی</h1>
        <p className="mt-1 text-caption text-slate">
          حباب چت آرکان را روی هر سایتی نصب کنید. ظاهر، پیام خوش‌آمد و دامنه‌های مجاز از همین‌جا کنترل می‌شوند.
        </p>
      </div>

      {/* اسنیپت نصب */}
      <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
        <h2 className="mb-3 font-heading text-body font-semibold text-pine">کد نصب</h2>
        <p className="mb-3 text-caption text-slate">این کد را درست قبل از بسته‌شدن تگ <code>&lt;/body&gt;</code> سایت مقصد بگذارید:</p>
        <div className="flex items-center gap-2">
          <code dir="ltr" className="flex-1 overflow-x-auto rounded-btn bg-bone px-4 py-3 text-[0.85rem] text-ink">
            {snippet}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 rounded-btn border border-pine/25 px-4 py-2.5 text-caption text-pine transition-colors hover:bg-pine/5"
          >
            {copied ? "کپی شد ✓" : "کپی"}
          </button>
        </div>
        <p className="mt-3 text-caption text-slate">
          پیش‌نمایش زنده:{" "}
          <a href="/widget" target="_blank" rel="noreferrer" className="text-brass underline-offset-4 hover:underline">
            باز کردن صفحه‌ی ویجت
          </a>
        </p>
      </section>

      {/* تنظیمات */}
      <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
        <h2 className="mb-4 font-heading text-body font-semibold text-pine">ظاهر و رفتار</h2>

        <label className="mb-5 flex items-center gap-3">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-pine" />
          <span className="text-[0.95rem] text-ink">ویجت فعال باشد</span>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>رنگ اصلی</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-14 cursor-pointer rounded-btn border border-slate/30" />
              <input value={color} onChange={(e) => setColor(e.target.value)} dir="ltr" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>موقعیت حباب</label>
            <select value={position} onChange={(e) => setPosition(e.target.value as "left" | "right")} className={`${inputCls} cursor-pointer`}>
              <option value="left">پایین-چپ</option>
              <option value="right">پایین-راست</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>متن دکمه‌ی حباب</label>
            <input value={launcher} onChange={(e) => setLauncher(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>پیام خوش‌آمد</label>
            <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} className={`${inputCls} resize-y leading-7`} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>دامنه‌های مجاز (هر کدام در یک خط — خالی یعنی همه‌ی دامنه‌ها)</label>
            <textarea
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              rows={3}
              dir="ltr"
              className={`${inputCls} resize-y leading-7`}
              placeholder="example.com&#10;www.example.com"
            />
            <p className="mt-1.5 text-caption text-slate">ویجت فقط روی این دامنه‌ها قابل‌نمایش خواهد بود (محدودسازی امنیتی).</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex min-h-[44px] items-center justify-center rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
          >
            {pending ? "در حال ذخیره…" : "ذخیره‌ی تنظیمات ویجت"}
          </button>
          {msg && <span className={`text-caption ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </section>
    </div>
  );
}
