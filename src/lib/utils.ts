// تبدیل اعداد لاتین به فارسی برای نمایش در متن (طبق برند گاید)
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

// ترکیب کلاس‌ها به‌صورت ساده (بدون وابستگی به کتابخانه)
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// عدد با جداکننده‌ی هزارگان و ارقام فارسی
export function faNum(n: number): string {
  return toFa(n.toLocaleString("en-US"));
}

// نمایش مبلغ به تومان با ارقام فارسی و جداکننده‌ی هزارگان
export function formatToman(amount: number): string {
  return faNum(Math.round(amount)) + " تومان";
}
