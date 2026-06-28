"use client";

import { useEffect, useState, useTransition } from "react";
import { toFa } from "@/lib/utils";
import {
  getTelegramStatusAction,
  setTelegramWebhookAction,
  deleteTelegramWebhookAction,
  broadcastTelegramAction,
} from "@/app/admin/chatbot-actions";

type Status = {
  configured: boolean;
  username?: string;
  webhookUrl?: string;
  pending?: number;
};

export default function TelegramSettings({ userCount }: { userCount: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [broadcast, setBroadcast] = useState("");

  async function refresh() {
    setLoading(true);
    const res = await getTelegramStatusAction();
    setStatus({
      configured: res.configured,
      username: res.username,
      webhookUrl: res.webhookUrl,
      pending: res.pending,
    });
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, []);

  function run(p: Promise<{ ok: boolean; message?: string }>) {
    start(async () => {
      const res = await p;
      setMsg({ ok: res.ok, text: res.message ?? "" });
      await refresh();
    });
  }

  const webhookActive = Boolean(status?.webhookUrl);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">کانال تلگرام</h1>
        <p className="mt-1 text-caption text-slate">
          چت‌بات آرکان روی تلگرام، با همان مغز RAG و پایگاه دانش مشترک.
        </p>
      </div>

      {msg && (
        <div className={`rounded-btn px-4 py-2.5 text-caption ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {/* وضعیت */}
      <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
        <h2 className="mb-4 font-heading text-body font-semibold text-pine">وضعیت بات</h2>
        {loading ? (
          <p className="text-caption text-slate">در حال بررسی…</p>
        ) : !status?.configured ? (
          <p className="rounded-btn bg-red-50 px-4 py-3 text-caption text-red-700">
            توکن تلگرام (TELEGRAM_BOT_TOKEN) تنظیم نشده است.
          </p>
        ) : (
          <div className="space-y-2 text-[0.95rem]">
            <Row label="نام کاربری بات" value={status.username ? `@${status.username}` : "—"} />
            <Row
              label="وضعیت Webhook"
              value={webhookActive ? "فعال ✅" : "غیرفعال"}
              valueClass={webhookActive ? "text-green-700" : "text-slate"}
            />
            {webhookActive && <Row label="آدرس Webhook" value={status.webhookUrl!} ltr />}
            <Row label="پیام‌های در صف" value={toFa(status.pending ?? 0)} />
            <Row label="کاربران تلگرام" value={toFa(userCount)} />
          </div>
        )}

        {status?.configured && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(setTelegramWebhookAction())}
              className="rounded-btn bg-pine px-5 py-2.5 text-caption font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
            >
              {webhookActive ? "تنظیم دوباره‌ی Webhook" : "فعال‌سازی Webhook"}
            </button>
            {webhookActive && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(deleteTelegramWebhookAction())}
                className="rounded-btn border border-red-200 px-5 py-2.5 text-caption text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                حذف Webhook
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              className="rounded-btn border border-pine/25 px-5 py-2.5 text-caption text-pine transition-colors hover:bg-pine/5"
            >
              تازه‌سازی
            </button>
          </div>
        )}
        <p className="mt-3 text-caption text-slate">
          برای تست، بات{" "}
          {status?.username ? (
            <a href={`https://t.me/${status.username}`} target="_blank" rel="noreferrer" className="text-brass underline-offset-4 hover:underline">
              @{status.username}
            </a>
          ) : (
            "خود"
          )}{" "}
          را در تلگرام باز کنید و /start بزنید.
        </p>
      </section>

      {/* پیام انبوه */}
      <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
        <h2 className="mb-4 font-heading text-body font-semibold text-pine">پیام انبوه (Broadcast)</h2>
        <textarea
          value={broadcast}
          onChange={(e) => setBroadcast(e.target.value)}
          rows={4}
          className="w-full rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] leading-7 text-ink focus:border-brass focus:outline-none"
          placeholder="پیامی که می‌خواهید برای همه‌ی کاربران تلگرام ارسال شود…"
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={pending || broadcast.trim().length < 2}
            onClick={() => {
              if (confirm(`ارسال این پیام به ${toFa(userCount)} کاربر تلگرام؟`)) run(broadcastTelegramAction(broadcast));
            }}
            className="rounded-btn bg-pine px-5 py-2.5 text-caption font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
          >
            {pending ? "در حال ارسال…" : "ارسال به همه"}
          </button>
          <span className="text-caption text-slate">{toFa(userCount)} گیرنده</span>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, valueClass, ltr }: { label: string; value: string; valueClass?: string; ltr?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-slate">{label}:</span>
      <span className={`min-w-0 break-all ${ltr ? "text-left" : ""} ${valueClass ?? "text-ink"}`} dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}
