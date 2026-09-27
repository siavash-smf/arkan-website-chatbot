"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { toFa } from "@/lib/documents/format";
import { PAGE_H, PAGE_W } from "./sheet-kit";

const MIN_SCALE = 0.25;
const MAX_SCALE = 1;

export type DocViewerHandle = {
  /** بزرگ‌نمایی را موقتاً ۱:۱ می‌کند، صبر می‌کند تا رسم شود، `fn` را اجرا می‌کند و
   *  بزرگ‌نمایی را برمی‌گرداند. PDF از همین صفحه‌ها گرفته می‌شود، پس نباید از
   *  پشت transform: scale گرفته شود. */
  atFullScale: <R>(fn: () => Promise<R>) => Promise<R>;
};

const paint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * نمایش صفحه‌های A4. صفحه‌ها همیشه در اندازه‌ی واقعی ۷۹۴×۱۱۲۳ چیده می‌شوند
 * (PDF از همان‌ها ساخته می‌شود) و فقط نمایش‌شان کوچک می‌شود.
 *
 * - `panel`: پیش‌نمایش کنار فرم ادمین؛ یک صفحه‌ی کامل جا می‌شود، با زوم و تمام‌صفحه.
 * - `page`: صفحه‌ی کلاینت؛ هم‌عرض صفحه‌ی گوشی یا دسکتاپ، با دکمه‌ی اندازه‌ی واقعی.
 */
export default function DocViewer({
  children,
  innerRef,
  handleRef,
  variant = "panel",
  caption = "پیش‌نمایش زنده — دقیقاً همان چیزی که در PDF می‌آید",
}: {
  children: ReactNode;
  /** المانی که سازنده‌ی PDF صفحه‌های `[data-doc-page]` را از آن برمی‌دارد */
  innerRef: RefObject<HTMLDivElement>;
  handleRef?: RefObject<DocViewerHandle | null>;
  variant?: "panel" | "page";
  caption?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // null = اندازه‌ی خودکار (panel: یک صفحه‌ی کامل، page: هم‌عرض کادر)
  const [zoom, setZoom] = useState<number | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [contentH, setContentH] = useState(PAGE_H);
  // از طریق state، نه دست‌بردن در style: رندر دوباره وسط گرفتن تصویر زوم را برنمی‌گرداند
  const [capturing, setCapturing] = useState(false);
  const [full, setFull] = useState(false);

  const measure = useCallback(() => {
    const box = boxRef.current;
    if (box) {
      const styles = getComputedStyle(box);
      const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const w = box.clientWidth - padX;
      const h = box.clientHeight - padY;
      if (w > 0) {
        const byWidth = w / PAGE_W;
        const fit = variant === "page" || full || h <= 0 ? byWidth : Math.min(byWidth, h / PAGE_H);
        setFitScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit)));
      }
    }
    const inner = innerRef.current;
    if (inner) setContentH(inner.scrollHeight || PAGE_H);
  }, [innerRef, variant, full]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (boxRef.current) observer.observe(boxRef.current);
    if (innerRef.current) observer.observe(innerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, innerRef]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  useEffect(() => {
    if (!handleRef) return;
    (handleRef as { current: DocViewerHandle | null }).current = {
      atFullScale: async (fn) => {
        setCapturing(true);
        try {
          await paint();
          await paint();
          return await fn();
        } finally {
          setCapturing(false);
        }
      },
    };
    return () => {
      (handleRef as { current: DocViewerHandle | null }).current = null;
    };
  }, [handleRef]);

  const scale = capturing ? 1 : (zoom ?? fitScale);
  const step = (delta: number) =>
    setZoom(Math.round(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta)) * 100) / 100);

  const btn =
    "rounded-btn border border-sand bg-white px-2.5 py-1 text-[0.75rem] text-slate transition-colors hover:border-pine/30 hover:text-pine disabled:opacity-40";

  const controls =
    variant === "panel" ? (
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={btn}
          onClick={() => {
            setFull((v) => !v);
            setZoom(null);
          }}
          title={full ? "بازگشت به پنل (Esc)" : "دیدن سند در تمام صفحه"}
        >
          {full ? "بستن تمام‌صفحه" : "تمام‌صفحه"}
        </button>
        <button type="button" className={btn} onClick={() => setZoom(null)}>
          اندازه‌ی خودکار
        </button>
        <button type="button" className={btn} onClick={() => step(-0.1)} disabled={scale <= MIN_SCALE} aria-label="کوچک‌تر">
          −
        </button>
        <span className="w-10 text-center text-[0.75rem] tabular-nums text-slate">{toFa(Math.round(scale * 100))}٪</span>
        <button type="button" className={btn} onClick={() => step(0.1)} disabled={scale >= MAX_SCALE} aria-label="بزرگ‌تر">
          +
        </button>
      </div>
    ) : (
      <button type="button" className={btn} onClick={() => setZoom((z) => (z === null ? 1 : null))}>
        {zoom === null ? "اندازه‌ی واقعی" : "هم‌عرض صفحه"}
      </button>
    );

  return (
    <div
      className={
        full
          ? "fixed inset-0 z-50 flex flex-col gap-2 bg-bone p-4"
          : variant === "panel"
            ? "sticky top-28 space-y-2"
            : "space-y-2"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8rem] text-slate">{caption}</p>
        {controls}
      </div>

      <div
        ref={boxRef}
        className={`overflow-auto rounded-card border border-sand bg-sand/40 p-3 ${
          full ? "min-h-0 flex-1" : variant === "panel" ? "max-h-[calc(100vh-11rem)]" : ""
        }`}
      >
        {/* فاصله‌گذار، ابعاد کوچک‌شده را نگه می‌دارد تا اسکرول درست باشد */}
        <div
          style={{
            position: "relative",
            width: PAGE_W * scale,
            height: contentH * scale,
            marginInline: "auto",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: PAGE_W,
              transform: `scale(${scale})`,
              transformOrigin: "top right",
              transition: "none",
            }}
          >
            <div ref={innerRef} className="flex w-[794px] flex-col gap-3">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
