"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/ui/Logo";

type Source = { title: string; similarity: number; chunk_index: number };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  error?: boolean;
};

const STARTERS = [
  "آرکان دقیقاً چه کمکی به کسب‌وکار من می‌کند؟",
  "متدولوژی «چهار رکن» چیست؟",
  "فرایند همکاری چطور پیش می‌رود؟",
  "برای شروع باید چه کار کنم؟",
];

function decodeMeta(b64: string): { conversationId: string | null; sources: Source[] } {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { conversationId: null, sources: [] };
  }
}

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export default function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // بازیابی conversationId از localStorage
  useEffect(() => {
    const saved = localStorage.getItem("arkan_conv");
    if (saved) setConversationId(saved);
  }, []);

  // اسکرول به پایین با هر تغییر
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { id: nextId(), role: "user", content: trimmed };
    const assistantId = nextId();
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
      });

      // متادیتا (conversationId + منابع) از هدر
      const metaB64 = res.headers.get("x-arkan-meta");
      const meta = metaB64 ? decodeMeta(metaB64) : { conversationId: null, sources: [] };
      if (meta.conversationId) {
        setConversationId(meta.conversationId);
        localStorage.setItem("arkan_conv", meta.conversationId);
      }

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: errText || "خطایی رخ داد. دوباره تلاش کنید.", error: true }
              : msg
          )
        );
        return;
      }

      // استریم متن
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg))
        );
      }

      // ضمیمه‌کردن منابع به پاسخ
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: acc || "—", sources: meta.sources }
            : msg
        )
      );
    } catch {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "ارتباط برقرار نشد. اتصال خود را بررسی کنید.", error: true }
            : msg
        )
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-bone">
      {/* هدر */}
      <header className="sticky top-0 z-10 border-b border-sand bg-bone/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3.5">
          <a href="/" className="rounded-btn" aria-label="آرکان — خانه">
            <Logo />
          </a>
          <a
            href="/#consultation"
            className="inline-flex items-center gap-1.5 rounded-btn bg-pine px-4 py-2 text-caption font-medium text-bone transition-colors hover:bg-pine-dark"
          >
            درخواست مشاوره
          </a>
        </div>
      </header>

      {/* ناحیه‌ی پیام‌ها */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-6">
          {empty ? (
            <WelcomeScreen onPick={send} />
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {loading && <TypingIndicator />}
            </div>
          )}
        </div>
      </div>

      {/* ورودی */}
      <div className="border-t border-sand bg-bone">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <div className="flex items-end gap-2 rounded-card border border-slate/30 bg-white p-2 shadow-soft focus-within:border-brass">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="سؤال‌تان را درباره‌ی آرکان بنویسید…"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] leading-7 text-ink placeholder:text-slate/60 focus:outline-none"
              aria-label="پیام شما"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-pine text-bone transition-colors hover:bg-pine-dark disabled:opacity-50"
              aria-label="ارسال"
            >
              <SendIcon />
            </button>
          </div>
          <p className="mt-2 text-center text-[0.75rem] text-slate/80">
            پاسخ‌ها توسط هوش مصنوعی تولید می‌شوند و ممکن است کامل نباشند. برای مشاوره‌ی دقیق، درخواست خود را ثبت کنید.
          </p>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-pine text-bone">
        <SparkIcon />
      </span>
      <h1 className="mt-5 font-heading text-h3 font-bold text-pine">
        دستیار هوشمند آرکان
      </h1>
      <p className="mt-2 max-w-md text-body text-slate">
        درباره‌ی خدمات، متدولوژی چهار رکن و مسیر همکاری بپرسید. هر وقت آماده بودید،
        درخواست مشاوره‌ی رایگان ثبت کنید.
      </p>
      <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2">
        {STARTERS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-card border border-sand bg-white px-4 py-3 text-right text-[0.95rem] text-ink shadow-soft transition-colors hover:border-pine/30 hover:bg-white"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={isUser ? "flex justify-start" : "flex justify-end"}>
      <div className={isUser ? "max-w-[85%]" : "w-full max-w-[92%]"}>
        <div
          className={
            isUser
              ? "rounded-card rounded-tr-sm bg-pine px-4 py-3 text-[0.95rem] leading-7 text-bone"
              : msg.error
                ? "rounded-card border border-red-200 bg-red-50 px-4 py-3 text-[0.95rem] leading-7 text-red-700"
                : "rounded-card rounded-tl-sm border border-sand bg-white px-4 py-3 text-[0.95rem] leading-8 text-ink shadow-soft"
          }
        >
          <p className="whitespace-pre-wrap">{msg.content || "…"}</p>
        </div>

        {/* منابع */}
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
            <span className="text-[0.75rem] text-slate">منابع:</span>
            {dedupeSources(msg.sources).map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 text-[0.75rem] text-pine"
                title={`شباهت: ${Math.round(s.similarity * 100)}٪`}
              >
                <DocIcon />
                {s.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of sources) {
    if (seen.has(s.title)) continue;
    seen.add(s.title);
    out.push(s);
  }
  return out.slice(0, 4);
}

function TypingIndicator() {
  return (
    <div className="flex justify-end">
      <div className="rounded-card rounded-tl-sm border border-sand bg-white px-4 py-3.5 shadow-soft">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-slate/50"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* آیکون‌های محلی */
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* فلش به سمت راست (RTL: ارسال) */}
      <path d="M20 12H4M10 6l-6 6 6 6" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 4.9L18.7 9l-4.9 1.1L12 15l-1.8-4.9L5.3 9l4.9-1.1z" />
      <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7z" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </svg>
  );
}
