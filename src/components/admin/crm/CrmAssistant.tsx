"use client";

import { useRef, useState } from "react";

/**
 * چت با CRM — رابط ساده‌ی استریمی روی /api/crm-chat.
 * مدل با tool-calling از دیتابیس پرس‌وجو می‌کند و پاسخ تحلیلی می‌دهد.
 */

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "کدام لیدها از چت‌بات آمده‌اند و هنوز تبدیل نشده‌اند؟",
  "وضعیت کلی پایپ‌لاین را خلاصه کن.",
  "کدام معاملات بیش از ۱۰ روز در یک مرحله مانده‌اند؟",
  "چه وظایفی معوق شده؟ اولویت امروز من چیست؟",
  "وضعیت قراردادها چطور است؟",
];

export default function CrmAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function scrollDown() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    scrollDown();

    try {
      // زیر /admin است چون کوکی نشست ادمین با path=/admin ست می‌شود
      const res = await fetch("/admin/api/crm-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `خطای سرور (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
        scrollDown();
      }
      if (!acc.trim()) {
        setMessages([
          ...history,
          { role: "assistant", content: "پاسخی تولید نشد؛ لطفاً دوباره تلاش کنید." },
        ]);
      }
    } catch (e) {
      setError((e as Error).message);
      setMessages(history);
    } finally {
      setBusy(false);
      scrollDown();
    }
  }

  return (
    <div className="flex h-[calc(100dvh-220px)] min-h-[420px] flex-col">
      <div className="mb-4">
        <h1 className="font-heading text-h3 font-bold text-pine">دستیار CRM</h1>
        <p className="mt-1 text-caption text-slate">
          به زبان طبیعی از داده‌های CRM بپرس — مدل با ابزار (tool-calling) از دیتابیس پرس‌وجو می‌کند.
        </p>
      </div>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-card border border-sand bg-white p-4 shadow-soft"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-10">
            <p className="text-caption text-slate">چند نمونه برای شروع:</p>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-sand bg-bone/60 px-3.5 py-1.5 text-caption text-ink transition-colors hover:border-brass hover:text-pine"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-card px-4 py-3 text-[0.95rem] leading-7 ${
                m.role === "user"
                  ? "mr-auto bg-pine text-bone"
                  : "ml-auto border border-sand bg-bone/60 text-ink"
              }`}
            >
              {m.content ||
                (busy && i === messages.length - 1 ? (
                  <span className="inline-flex items-center gap-2 text-slate">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate/30 border-t-pine" />
                    در حال جستجو در CRM…
                  </span>
                ) : (
                  ""
                ))}
            </div>
          ))
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-caption text-red-600">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="مثلاً: بزرگ‌ترین معامله‌های باز کدام‌اند؟"
          disabled={busy}
          className="w-full min-h-[48px] flex-1 rounded-btn border border-slate/30 bg-white px-4 py-2.5 text-[0.95rem] text-ink transition-colors placeholder:text-slate/60 focus:border-brass focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex min-h-[48px] items-center justify-center rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
        >
          بپرس
        </button>
      </form>
    </div>
  );
}
