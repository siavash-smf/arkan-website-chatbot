import { faNum, formatToman, toFa } from "@/lib/utils";

/**
 * قالب‌بندی مخصوص اسناد (پروپوزال و قرارداد): تاریخ شمسی و مبلغ به حروف.
 * همه‌ی تاریخ‌ها به وقت تهران نمایش داده می‌شوند تا روی سرور و مرورگر یکی باشند.
 */

export { faNum, formatToman, toFa };

const TEHRAN = "Asia/Tehran";

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // تاریخ خالی (YYYY-MM-DD) را ظهر UTC در نظر بگیر تا با اختلاف ساعت یک روز جابه‌جا نشود
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «۴ مهر ۱۴۰۵» */
export function faDate(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeZone: TEHRAN }).format(d);
}

/** «۴ مهر ۱۴۰۵، ساعت ۱۴:۳۰» */
export function faDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "—";
  const date = faDate(iso);
  const time = new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TEHRAN,
  }).format(d);
  return `${date}، ساعت ${time}`;
}

/** سال شمسی با ارقام لاتین — برای شماره‌ی اسناد مثل AP-1405-003 */
export function jalaliYear(): string {
  return new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric", timeZone: TEHRAN }).format(
    new Date()
  );
}

// ── عدد به حروف ─────────────────────────────────────────────────
// قراردادهای ایرانی مبلغ را کنار رقم، به حروف هم می‌نویسند.

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", " هزار", " میلیون", " میلیارد", " هزار میلیارد"];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    if (Math.floor(rest / 10)) parts.push(TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(ONES[rest % 10]);
  }
  return parts.join(" و ");
}

export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "صفر";
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  if (groups.length > SCALES.length) return faNum(value);
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) words.push(threeDigits(groups[i]) + SCALES[i]);
  }
  return words.join(" و ");
}

/** «دویست و چهل میلیون تومان» */
export function tomanInWords(amount: number): string {
  return `${numberToWords(amount)} تومان`;
}
