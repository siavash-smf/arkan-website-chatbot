"use client";

import { useCallback, useEffect, useState } from "react";

export type Source = { title: string; similarity: number; chunk_index: number };
export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  error?: boolean;
};

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

/**
 * هوک مشترک گفتگو — منطق استریم/حافظه/منابع را برای همه‌ی کانال‌ها
 * (صفحه‌ی چت و ویجت) یک‌جا نگه می‌دارد.
 */
export function useArkanChat(opts: { channel?: string; storageKey?: string } = {}) {
  const channel = opts.channel ?? "web";
  const storageKey = opts.storageKey ?? "arkan_conv";

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setConversationId(saved);
  }, [storageKey]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const assistantId = nextId();
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "user", content: trimmed },
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, conversationId, channel }),
        });

        const metaB64 = res.headers.get("x-arkan-meta");
        const meta = metaB64 ? decodeMeta(metaB64) : { conversationId: null, sources: [] };
        if (meta.conversationId) {
          setConversationId(meta.conversationId);
          localStorage.setItem(storageKey, meta.conversationId);
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

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)));
        }
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: acc || "—", sources: meta.sources } : msg
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
      }
    },
    [conversationId, loading, channel, storageKey]
  );

  return { messages, loading, conversationId, send };
}
