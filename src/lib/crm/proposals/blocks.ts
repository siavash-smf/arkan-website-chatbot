import { faDate } from "@/lib/documents/format";
import type { ProposalData, ProposalOption, ProposalPhase } from "./types";

/**
 * بلوک‌های سند پروپوزال. هر بلوک یک تکه‌ی اتمی و قابل‌اندازه‌گیری است که
 * صفحه‌بند در صفحه‌های A4 می‌چیند. `keepWithNext` تیتر را به بلوک بعدی می‌چسباند.
 * این فایل خالص است (بدون React) تا ترتیب بخش‌های سند در یک نگاه خوانده شود.
 */
export type PBlock =
  | { id: string; kind: "letterhead"; keepWithNext?: boolean }
  | { id: string; kind: "cover"; keepWithNext?: boolean }
  | { id: string; kind: "heading"; no: number; text: string; keepWithNext?: boolean }
  | { id: string; kind: "para"; text: string; keepWithNext?: boolean }
  | {
      id: string;
      kind: "list";
      items: string[];
      ordered?: boolean;
      check?: boolean;
      /** صفحه‌بند روی ادامه‌ی فهرستِ شکسته‌شده می‌گذارد */
      start?: number;
      keepWithNext?: boolean;
    }
  | { id: string; kind: "phases"; items: ProposalPhase[]; start?: number; keepWithNext?: boolean }
  | { id: string; kind: "options"; items: ProposalOption[]; keepWithNext?: boolean }
  | { id: string; kind: "callout"; title?: string; text: string; keepWithNext?: boolean }
  | { id: string; kind: "closing"; keepWithNext?: boolean };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type PBlockDraft = DistributiveOmit<PBlock, "id">;

const lines = (text: string | null | undefined) =>
  (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function buildProposalBlocks(data: ProposalData): PBlock[] {
  const blocks: PBlock[] = [];
  let seq = 0;
  const push = (b: PBlockDraft) => blocks.push({ ...b, id: `${b.kind}-${seq++}` } as PBlock);

  let sectionNo = 0;
  const section = (text: string) => {
    sectionNo += 1;
    push({ kind: "heading", no: sectionNo, text, keepWithNext: true });
  };

  // ── جلد ──────────────────────────────────────────────────────
  push({ kind: "letterhead", keepWithNext: true });
  push({ kind: "cover" });

  // ── ۱. خلاصه ────────────────────────────────────────────────
  if (lines(data.intro).length) {
    section("خلاصه‌ی پیشنهاد");
    for (const line of lines(data.intro)) push({ kind: "para", text: line });
  }

  // ── ۲. درک ما از وضعیت شما ──────────────────────────────────
  if (data.understanding.length) {
    section("درک ما از وضعیت شما");
    push({
      kind: "para",
      text: "بر پایه‌ی گفت‌وگویی که با هم داشتیم، وضعیت فعلی کسب‌وکار شما را این‌گونه فهمیده‌ایم. اگر جایی از این برداشت دقیق نیست، پیش از هر چیز همان را اصلاح کنیم:",
      keepWithNext: true,
    });
    push({ kind: "list", items: data.understanding });
  }

  // ── ۳. اهداف ────────────────────────────────────────────────
  if (data.goals.length) {
    section("اهداف این همکاری");
    push({ kind: "para", text: "در پایان این همکاری، انتظار داریم به این نتایج رسیده باشیم:", keepWithNext: true });
    push({ kind: "list", items: data.goals, ordered: true });
  }

  // ── ۴. مراحل اجرا ──────────────────────────────────────────
  if (data.phases.length) {
    section("راهکار پیشنهادی و مراحل اجرا");
    push({ kind: "phases", items: data.phases });
  }

  // ── ۵. خروجی‌ها ─────────────────────────────────────────────
  if (data.deliverables.length) {
    section("خروجی‌هایی که تحویل می‌گیرید");
    push({ kind: "list", items: data.deliverables, check: true });
  }

  // ── ۶. روش کار ─────────────────────────────────────────────
  if (lines(data.methodology).length) {
    section("روش کار و همراهی آرکان");
    for (const line of lines(data.methodology)) push({ kind: "para", text: line });
  }

  // ── ۷. زمان‌بندی ────────────────────────────────────────────
  if (lines(data.timelineNote).length) {
    section("زمان‌بندی");
    for (const line of lines(data.timelineNote)) push({ kind: "para", text: line });
  }

  // ── ۸. سرمایه‌گذاری ─────────────────────────────────────────
  if (data.options.length) {
    const many = data.options.length > 1;
    section(many ? "بسته‌های همکاری و سرمایه‌گذاری" : "سرمایه‌گذاری");
    if (many) {
      push({
        kind: "para",
        text: "چند سطح همکاری پیشنهاد شده است تا متناسب با اولویت و بودجه‌ی خود انتخاب کنید. در نسخه‌ی آنلاین این پیشنهاد، بسته‌ی موردنظرتان را علامت بزنید:",
        keepWithNext: true,
      });
    }
    push({ kind: "options", items: data.options });
  }

  // ── ۹. خارج از دامنه ────────────────────────────────────────
  if (data.exclusions.length) {
    section("آنچه در این پیشنهاد نیست");
    push({
      kind: "para",
      text: "برای اینکه انتظار دو طرف از ابتدا روشن باشد، موارد زیر خارج از دامنه‌ی این پیشنهاد است و در صورت نیاز جداگانه برآورد می‌شود:",
      keepWithNext: true,
    });
    push({ kind: "list", items: data.exclusions });
  }

  // ── ۱۰. پیش‌فرض‌ها ──────────────────────────────────────────
  if (data.assumptions.length) {
    section("پیش‌فرض‌ها");
    push({ kind: "list", items: data.assumptions });
  }

  // ── ۱۱. چرا آرکان ──────────────────────────────────────────
  if (data.whyUs.length) {
    section("چرا آرکان");
    push({ kind: "list", items: data.whyUs, check: true });
  }

  // ── ۱۲. گام‌های بعدی ───────────────────────────────────────
  section("گام‌های بعدی");
  push({
    kind: "list",
    ordered: true,
    items: data.nextSteps.length
      ? data.nextSteps
      : [
          "این پیشنهاد را مطالعه کنید و اگر پرسشی دارید، از نسخه‌ی آنلاین برای ما بنویسید.",
          "پس از تأیید شما، قرارداد رسمی برای تأیید آنلاین ارسال می‌شود.",
          "با دریافت پیش‌پرداخت، کار از تاریخ توافق‌شده آغاز می‌شود.",
        ],
  });

  // ── ۱۳. شرایط و اعتبار ─────────────────────────────────────
  const terms = lines(data.termsNote);
  section("شرایط و اعتبار این پیشنهاد");
  push({ kind: "list", items: terms.length ? terms : [] });
  push({
    kind: "para",
    text: "این سند پیشنهاد همکاری است و به‌تنهایی تعهد حقوقی ایجاد نمی‌کند. تعهدات نهایی طرفین در قرارداد رسمی می‌آید که پس از تأیید شما ارسال می‌شود.",
  });
  if (data.validUntil) {
    push({
      kind: "callout",
      title: "اعتبار پیشنهاد",
      text: `این پیشنهاد تا ${faDate(data.validUntil)} معتبر است. پس از این تاریخ، مبالغ و زمان‌بندی نیاز به بازنگری دارد.`,
    });
  }

  push({ kind: "closing" });

  // فهرست خالی (مثلاً شرایطِ پاک‌شده) بلوک بی‌محتوا نسازد
  return blocks.filter((b) => b.kind !== "list" || b.items.length > 0);
}
