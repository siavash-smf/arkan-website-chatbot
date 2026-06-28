"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/ui/Logo";
import { useArkanChat, type ChatMsg, type Source } from "@/lib/useArkanChat";
import { renderBold } from "./format";

const STARTERS = [
  "آرکان دقیقاً چه کمکی به کسب‌وکار من می‌کند؟",
  "متدولوژی «چهار رکن» چیست؟",
  "هزینه و مدت بسته‌های مشاوره چقدر است؟",
  "برای شروع همکاری باید چه کار کنم؟",
];

export default function ChatPanel() {
  const { messages, loading, send } = useArkanChat({ channel: "web", storageKey: "arkan_conv" });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function submit() {
    if (!input.trim() || loading) return;
    send(input);
    setInput("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-bone">
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-6">
          {empty ? (
            <WelcomeScreen onPick={(q) => send(q)} />
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
              onClick={submit}
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
      <h1 className="mt-5 font-heading text-h3 font-bold text-pine">دستیار هوشمند آرکان</h1>
      <p className="mt-2 max-w-md text-body text-slate">
        درباره‌ی خدمات، متدولوژی چهار رکن و مسیر همکاری بپرسید. هر وقت آماده بودید، درخواست مشاوره‌ی رایگان ثبت کنید.
      </p>
      <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2">
        {STARTERS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-card border border-sand bg-white px-4 py-3 text-right text-[0.95rem] text-ink shadow-soft transition-colors hover:border-pine/30"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
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
          <p className="whitespace-pre-wrap">{msg.content ? renderBold(msg.content) : "…"}</p>
        </div>
        {!isUser && msg.sources && msg.sources.length > 0 && <SourcePills sources={msg.sources} />}
      </div>
    </div>
  );
}

export function SourcePills({ sources }: { sources: Source[] }) {
  const seen = new Set<string>();
  const unique = sources.filter((s) => (seen.has(s.title) ? false : seen.add(s.title))).slice(0, 4);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
      <span className="text-[0.75rem] text-slate">منابع:</span>
      {unique.map((s, i) => (
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
  );
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

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
