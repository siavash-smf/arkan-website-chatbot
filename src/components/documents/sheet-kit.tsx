"use client";

/**
 * ابزار مشترک صفحه‌ی A4 برای اسنادی که برای کلاینت می‌فرستیم (پروپوزال و قرارداد):
 * کادر صفحه، بلوک‌های پایه، و صفحه‌بند «اول اندازه بگیر، بعد بچین».
 *
 * هر سند فهرست بلوک‌های خودش را می‌سازد و رندرکننده‌ی خودش را دارد؛
 * فقط کاغذ و جوهر اینجا مشترک است.
 */

import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ARKAN, DOC_THEME as T } from "@/lib/documents/company";
import { toFa } from "@/lib/documents/format";

export { T };

/** A4 در ۹۶dpi — همان کادری که jsPDF تصویر هر صفحه را در آن می‌گذارد. */
export const PAGE_W = 794;
export const PAGE_H = 1123;
export const PAD_X = 56;
export const PAD_TOP = 48;
export const PAD_BOTTOM = 64;
export const CONTENT_W = PAGE_W - PAD_X * 2;
export const CONTENT_H = PAGE_H - PAD_TOP - PAD_BOTTOM;
export const BLOCK_GAP = 13;

export const BODY_FONT = "var(--font-vazirmatn), Vazirmatn, Tahoma, sans-serif";
export const HEAD_FONT = "var(--font-estedad), Estedad, var(--font-vazirmatn), Tahoma, sans-serif";

// ───────────────────────────────────────────────────────────────
// صفحه‌بندی: هر بلوک یک بار اندازه‌گیری می‌شود، بعد در صفحه‌ها چیده می‌شود.
// زنجیره‌ی keepWithNext (تیتر + اولین پاراگرافش) با هم جابه‌جا می‌شوند
// تا تیتری تنها ته صفحه نماند.
// ───────────────────────────────────────────────────────────────
export type Paginatable = { id: string; keepWithNext?: boolean };

/** برای بلوک‌های چندردیفی (فهرست، جدول) جای هر ردیف را هم نگه می‌داریم
 *  تا بشود بلوک را بین دو صفحه شکست. */
export type RowMetric = { top: number; h: number };
export type BlockMetric = { h: number; rows?: RowMetric[] };

type RowsShape = { items?: unknown[]; rows?: unknown[] };

/** تعداد ردیف‌هایی که بلوک را می‌شود بینشان شکست. رندرکننده باید هر ردیف را با
 *  `data-doc-row` علامت بزند؛ تا تعداد اندازه‌گیری‌شده با این عدد یکی نباشد،
 *  بلوک شکسته نمی‌شود. */
export function rowsOf(block: unknown): number {
  const b = block as RowsShape;
  if (Array.isArray(b?.items)) return b.items.length;
  if (Array.isArray(b?.rows)) return b.rows.length;
  return 0;
}

/** برش [from, to) از یک بلوک چندردیفی. فهرست شماره‌دار از همان عدد ادامه می‌دهد. */
export function sliceRows<B extends Paginatable>(block: B, from: number, to: number): B {
  const b = block as B & RowsShape;
  const id = from === 0 ? block.id : `${block.id}#${from}`;
  if (Array.isArray(b.items)) {
    return { ...b, id, items: b.items.slice(from, to), start: from } as unknown as B;
  }
  if (Array.isArray(b.rows)) {
    return { ...b, id, rows: b.rows.slice(from, to) } as unknown as B;
  }
  return block;
}

export function packIntoPages<B extends Paginatable>(blocks: B[], metrics: BlockMetric[]): B[][] {
  const height = (i: number) => metrics[i]?.h || 0;

  // «اتم» = یک زنجیره‌ی keepWithNext که با هم جابه‌جا می‌شود
  type Atom = { idx: number[]; height: number };
  const atoms: Atom[] = [];
  let current: Atom | null = null;
  blocks.forEach((block, i) => {
    if (current) {
      current.idx.push(i);
      current.height += BLOCK_GAP + height(i);
    } else {
      current = { idx: [i], height: height(i) };
    }
    if (!block.keepWithNext) {
      atoms.push(current);
      current = null;
    }
  });
  if (current) atoms.push(current);

  // اتمی که حتی در یک صفحه‌ی کامل جا نمی‌شود، دوباره به اجزایش شکسته می‌شود
  const fitted: Atom[] = [];
  for (const atom of atoms) {
    if (atom.height > CONTENT_H && atom.idx.length > 1) {
      atom.idx.forEach((i) => fitted.push({ idx: [i], height: height(i) }));
    } else {
      fitted.push(atom);
    }
  }

  const pages: B[][] = [];
  let page: B[] = [];
  let used = 0;
  const flush = () => {
    if (page.length) {
      pages.push(page);
      page = [];
      used = 0;
    }
  };
  // فاصله فقط بین دو بلوک خرج می‌شود، نه بالای اولین بلوک صفحه
  const gap = () => (page.length ? BLOCK_GAP : 0);

  for (const atom of fitted) {
    if (used + gap() + atom.height <= CONTENT_H) {
      used += gap() + atom.height;
      atom.idx.forEach((i) => page.push(blocks[i]));
      continue;
    }

    const only = atom.idx.length === 1 ? atom.idx[0] : -1;
    const rows = only >= 0 ? metrics[only]?.rows : undefined;
    if (!rows || rows.length < 2 || rows.length !== rowsOf(blocks[only])) {
      // شکستنی نیست: از صفحه‌ی تازه شروع می‌شود
      flush();
      used = atom.height;
      atom.idx.forEach((i) => page.push(blocks[i]));
      continue;
    }

    // فهرست یا جدولی که در باقی صفحه جا نمی‌شود: ردیف‌ها را تا جایی که جا دارد
    // در همین صفحه می‌ریزیم و بقیه را به صفحه‌ی بعد می‌بریم.
    const block = blocks[only];
    const last = rows[rows.length - 1];
    const chrome = rows[0].top + (metrics[only].h - (last.top + last.h));
    const runHeight = (from: number, to: number) =>
      rows[to - 1].top + rows[to - 1].h - rows[from].top + chrome;

    let from = 0;
    while (from < rows.length) {
      let to = from;
      while (to < rows.length && used + gap() + runHeight(from, to + 1) <= CONTENT_H) to += 1;
      if (to === from) {
        if (page.length) {
          flush();
          continue;
        }
        to = from + 1; // ردیفی بلندتر از یک صفحه — بریده می‌شود
      }
      used += gap() + runHeight(from, to);
      page.push(sliceRows(block, from, to));
      from = to;
      if (from < rows.length) flush();
    }
  }
  flush();
  return pages.length ? pages : [[]];
}

// ───────────────────────────────────────────────────────────────
// بلوک‌های پایه
// ───────────────────────────────────────────────────────────────

/** متن لاتین داخل بلوک راست‌به‌چپ جای خودش را می‌خواهد (ایمیل، شماره‌ی سند). */
export function Ltr({ children }: { children: ReactNode }) {
  return (
    <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>
      {children}
    </span>
  );
}

/** تنها قالب‌بندی درون‌خطی که پشتیبانی می‌کنیم: **پررنگ** (از متن Markdown قرارداد). */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} style={{ fontWeight: 700, color: T.ink }}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

export const paraStyle: CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: 2.05,
  color: T.body,
  textAlign: "justify",
};

/** نشانه‌ی «چهار رکن» — همان SVG کامپوننت Logo سایت. */
export function ArkanMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <g strokeLinecap="round">
        <line x1="9" y1="29" x2="9" y2="17" stroke={T.pine} strokeWidth="2.6" />
        <line x1="16" y1="29" x2="16" y2="11" stroke={T.pine} strokeWidth="2.6" />
        <line x1="23" y1="29" x2="23" y2="13" stroke={T.brass} strokeWidth="2.6" />
        <line x1="30" y1="29" x2="30" y2="19" stroke={T.pine} strokeWidth="2.6" />
      </g>
    </svg>
  );
}

export function Letterhead() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ArkanMark />
          <div>
            <div style={{ fontFamily: HEAD_FONT, fontSize: 22, fontWeight: 700, color: T.pine, lineHeight: 1.2 }}>
              {ARKAN.brand}
            </div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{ARKAN.tagline}</div>
          </div>
        </div>
        <div style={{ textAlign: "left", fontSize: 9.5, lineHeight: 1.9, color: T.muted }}>
          <div>
            {ARKAN.city} · <Ltr>{ARKAN.phone}</Ltr>
          </div>
          <div>
            <Ltr>{ARKAN.email}</Ltr>
          </div>
          <div style={{ color: T.pine, fontWeight: 700 }}>
            <Ltr>{ARKAN.website}</Ltr>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 16, height: 2 }}>
        <div style={{ flex: 1, background: T.pine }} />
        <div style={{ width: 64, background: T.brass }} />
      </div>
    </div>
  );
}

export function Chip({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        background: T.bone,
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        padding: "6px 12px",
        fontSize: 11,
      }}
    >
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: 700, ...(ltr ? { direction: "ltr" as const, letterSpacing: 0.5 } : {}) }}>
        {value}
      </span>
    </div>
  );
}

/** تیتر شماره‌دار بخش. `label` پیش از عدد می‌آید (مثلاً «ماده»). */
export function SectionHeading({ no, text, label }: { no: number; text: string; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 6 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: T.pine,
          color: T.bone,
          fontSize: 11.5,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {toFa(no)}
      </div>
      <div style={{ fontFamily: HEAD_FONT, fontSize: 15, fontWeight: 700, color: T.pine, whiteSpace: "nowrap" }}>
        {label ? `${label} ${toFa(no)} — ` : ""}
        {text}
      </div>
      <div style={{ flex: 1, height: 1, background: T.line }} />
    </div>
  );
}

export function ListBlock({
  items,
  ordered,
  check,
  start = 0,
}: {
  items: string[];
  ordered?: boolean;
  /** تیک به‌جای گلوله — در پروپوزال یعنی «این را تحویل می‌گیرید» */
  check?: boolean;
  /** شماره‌ی اولین آیتم در کل فهرست، تا فهرستِ ادامه‌دار در صفحه‌ی بعد از ۱ شروع نشود */
  start?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} data-doc-row style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          {ordered ? (
            <span style={{ color: T.pine, fontSize: 11.5, fontWeight: 700, minWidth: 20, flexShrink: 0, lineHeight: 2.05 }}>
              {toFa(start + i + 1)}.
            </span>
          ) : check ? (
            <span style={{ color: T.pine, fontSize: 12, fontWeight: 700, flexShrink: 0, lineHeight: 2.05 }}>✓</span>
          ) : (
            <span
              style={{ width: 6, height: 6, borderRadius: 2, background: T.brass, flexShrink: 0, marginTop: 11 }}
            />
          )}
          <span style={{ ...paraStyle, flex: 1 }}>
            <Rich text={item} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** جدول دوستونه‌ی «عنوان: مقدار» — برای خلاصه‌ی قرارداد. */
export function FactsTable({ rows }: { rows: { k: string; v: ReactNode }[] }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            borderTop: i ? `1px solid ${T.lineSoft}` : undefined,
            background: i % 2 ? T.paper : T.bone,
          }}
        >
          <div style={{ width: 150, padding: "8px 12px", fontSize: 11, color: T.muted, flexShrink: 0 }}>{row.k}</div>
          <div style={{ flex: 1, padding: "8px 12px", fontSize: 12, color: T.ink, fontWeight: 700, lineHeight: 1.8 }}>
            {row.v}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Callout({ title, text }: { title?: string; text: string }) {
  return (
    <div
      style={{
        background: T.brassSoft,
        borderRight: `3px solid ${T.brass}`,
        borderRadius: "10px 4px 4px 10px",
        padding: "12px 15px",
      }}
    >
      {title ? <div style={{ fontSize: 11.5, fontWeight: 700, color: T.pine, marginBottom: 4 }}>{title}</div> : null}
      <div style={{ ...paraStyle, fontSize: 12 }}>
        <Rich text={text} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// صفحه
// ───────────────────────────────────────────────────────────────
export function Sheet({
  children,
  pageIndex,
  pageCount,
  docNo,
}: {
  children: ReactNode;
  pageIndex: number;
  pageCount: number;
  docNo: string;
}) {
  return (
    <div
      data-doc-page={pageIndex}
      style={{
        width: PAGE_W,
        height: PAGE_H,
        background: T.paper,
        color: T.ink,
        fontFamily: BODY_FONT,
        direction: "rtl",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 1px 2px rgba(20, 58, 50, 0.06), 0 8px 24px rgba(20, 58, 50, 0.08)",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: T.pine }} />
      <div
        style={{
          position: "absolute",
          top: PAD_TOP,
          right: PAD_X,
          width: CONTENT_W,
          display: "flex",
          flexDirection: "column",
          gap: BLOCK_GAP,
        }}
      >
        {children}
      </div>
      <div style={{ position: "absolute", bottom: 24, right: PAD_X, width: CONTENT_W }}>
        <div style={{ height: 1, background: T.line, marginBottom: 8 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: T.faint }}>
          <span>
            صفحه‌ی {toFa(pageIndex + 1)} از {toFa(pageCount)}
          </span>
          <span style={{ direction: "ltr", letterSpacing: 0.5 }}>{docNo}</span>
          <span>
            {ARKAN.brand} — {ARKAN.tagline}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * اندازه‌گیری فقط وقتی درست است که فونت واقعی بارگذاری شده باشد؛ وگرنه بلوک‌ها
 * کوتاه‌تر اندازه‌گیری می‌شوند و یک بلوک اضافه در صفحه جا می‌گیرد.
 * نام واقعی فونت را next/font می‌سازد (مثل `__vazirmatn_…`)، پس آن را از
 * استایل محاسبه‌شده‌ی خود المان می‌خوانیم.
 */
async function waitForFonts(layer: HTMLElement | null) {
  try {
    if (!document.fonts || !layer) return;
    const probe = document.createElement("span");
    probe.style.fontFamily = HEAD_FONT;
    layer.appendChild(probe);
    const families = [getComputedStyle(layer).fontFamily, getComputedStyle(probe).fontFamily]
      .map((f) => f.split(",")[0].trim())
      .filter(Boolean);
    probe.remove();
    await Promise.all(
      families.flatMap((family) =>
        ["400 12.5px", "700 14px"].map((spec) => document.fonts.load(`${spec} ${family}`).catch(() => undefined))
      )
    );
    await document.fonts.ready;
  } catch {
    /* API فونت در دسترس نیست — با اندازه‌های فعلی ادامه می‌دهیم */
  }
}

const samePagination = <B extends Paginatable>(a: B[][], b: B[][]) =>
  a.length === b.length && a.every((page, i) => page.length === b[i].length && page.every((x, j) => x.id === b[i][j].id));

/** سقف دفعاتی که چیدمان خودش را اصلاح می‌کند؛ فقط ترمز اضطراری است. */
const MAX_REPACKS = 6;

/**
 * همه‌ی بلوک‌ها را یک بار در لایه‌ای بیرون از دید رندر می‌کند و ارتفاع را از همان
 * لایه می‌خواند؛ پس اندازه‌ی یک بلوک به صفحه‌ای که در آن افتاده بستگی ندارد.
 * هر تغییر ارتفاع بعدی (مثلاً رسیدن فونت) با ResizeObserver دیده و دوباره چیده می‌شود.
 *
 * `onReady` وقتی صدا زده می‌شود که صفحه‌بندی آرام گرفته؛ یعنی لحظه‌ی امن ساخت PDF.
 */
export function PaginatedSheets<B extends Paginatable>({
  blocks,
  docNo,
  render,
  onReady,
}: {
  blocks: B[];
  docNo: string;
  render: (block: B) => ReactNode;
  onReady?: (pageCount: number) => void;
}) {
  const [pages, setPages] = useState<B[][] | null>(null);
  const pagesRef = useRef<B[][] | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    let queued = 0;
    let repacks = 0;
    // صفحه‌های قبلی تا اندازه‌گیری تازه روی صفحه می‌مانند تا پیش‌نمایش با هر تایپ چشمک نزند
    pagesRef.current = null;

    // offsetHeight به‌جای getBoundingClientRect: پیش‌نمایش داخل transform: scale است
    const measure = (): BlockMetric[] => {
      const layer = measureRef.current;
      return blocks.map((b) => {
        const el = layer?.querySelector<HTMLElement>(`[data-measure-id="${CSS.escape(b.id)}"]`);
        if (!el) return { h: 0 };
        const rowEls = Array.from(el.querySelectorAll<HTMLElement>("[data-doc-row]"));
        return {
          h: el.offsetHeight,
          rows: rowEls.length > 1 ? rowEls.map((r) => ({ top: r.offsetTop, h: r.offsetHeight })) : undefined,
        };
      });
    };

    const apply = () => {
      if (cancelled) return;
      const next = packIntoPages(blocks, measure());
      const prev = pagesRef.current;
      if (prev && (samePagination(prev, next) || repacks >= MAX_REPACKS)) {
        onReadyRef.current?.(prev.length);
        return;
      }
      if (prev) repacks += 1;
      pagesRef.current = next;
      setPages(next);
      schedule(); // بار دوم اندازه بگیر تا مطمئن شویم چیدمان تازه پایدار است
    };

    const schedule = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => requestAnimationFrame(apply));
    };

    void waitForFonts(measureRef.current).then(schedule);

    const observer = new ResizeObserver(schedule);
    if (measureRef.current) observer.observe(measureRef.current);

    return () => {
      cancelled = true;
      cancelAnimationFrame(queued);
      observer.disconnect();
    };
  }, [blocks]);

  return (
    <>
      {/* لایه‌ی اندازه‌گیری: هر بلوک با عرض واقعی، بیرون از دید.
          position: fixed آن را از جریان صفحه بیرون نگه می‌دارد، پس به PDF نمی‌رسد. */}
      <div
        aria-hidden
        ref={measureRef}
        style={{
          position: "fixed",
          top: 0,
          left: -20000,
          width: CONTENT_W,
          fontFamily: BODY_FONT,
          direction: "rtl",
          color: T.ink,
          display: "flex",
          flexDirection: "column",
          gap: BLOCK_GAP,
          pointerEvents: "none",
        }}
      >
        {blocks.map((b) => (
          // relative تا offsetTop هر ردیف نسبت به بلوک خودش اندازه‌گیری شود
          <div key={b.id} data-measure-id={b.id} style={{ position: "relative" }}>
            {render(b)}
          </div>
        ))}
      </div>

      {pages?.map((pageBlocks, i) => (
        <Sheet key={i} pageIndex={i} pageCount={pages.length} docNo={docNo}>
          {pageBlocks.map((b) => (
            <div key={b.id}>{render(b)}</div>
          ))}
        </Sheet>
      ))}
    </>
  );
}
