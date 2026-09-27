/**
 * طرف همیشگی اسناد: خود آرکان (از بریف کلاینت).
 * سربرگ PDF، امضای ایمیل‌ها و متن قرارداد همه از همین‌جا می‌خوانند تا
 * تغییر یک مشخصه (مثلاً تلفن) فقط در یک جا لازم باشد.
 */
export const ARKAN = {
  brand: "آرکان",
  legalName: "شرکت مشاوره‌ی مدیریت آرکان",
  tagline: "مشاور استراتژی و رشد کسب‌وکار",
  nameEn: "Arkan — Business Strategy & Growth Advisory",
  repName: "بابک آریان‌فر",
  repTitle: "بنیان‌گذار و مدیرعامل",
  city: "تهران",
  phone: "۰۲۱-۸۸۰۰۰۰۰۰",
  email: "info@arkan.co",
  website: "arkan.co",
} as const;

/** پالت سند (از برند گاید): کاغذ سفید، متن مرکبی، سرتیترها سبز کاج، خطوط تأکید برنجی.
 *  برنجی هرگز برای متن ریز روی سفید استفاده نمی‌شود (کنتراست ناکافی). */
export const DOC_THEME = {
  paper: "#FFFFFF",
  ink: "#15201C",
  body: "#2B3430",
  muted: "#5A5F5B",
  faint: "#8B908C",
  pine: "#143A32",
  pineSoft: "rgba(20, 58, 50, 0.06)",
  brass: "#B5853A",
  brassSoft: "rgba(181, 133, 58, 0.12)",
  bone: "#F7F3EC",
  sand: "#E7DECF",
  line: "#E7DECF",
  lineSoft: "#F1ECE3",
  ok: "#2E7D4F",
  okSoft: "rgba(46, 125, 79, 0.08)",
} as const;
