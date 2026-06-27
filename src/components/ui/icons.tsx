import type { SVGProps } from "react";

/**
 * مجموعه‌ی آیکون‌های خطی دست‌ساز.
 * stroke یکدست ۱.۵px، گوشه‌های گرد، بدون پُرکردن — هماهنگ با سبک برند.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={24}
      height={24}
      {...props}
    >
      {children}
    </svg>
  );
}

/* ── آیکون‌های خدمات ── */

// مشاوره‌ی استراتژی رشد — قطب‌نما / جهت
export function IconStrategy(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </Base>
  );
}

// بازطراحی مدل کسب‌وکار — بلوک‌های ساختاری
export function IconModel(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 17.5h7M17.5 14v7" />
    </Base>
  );
}

// استراتژی برند و بازاریابی — درخشش / ستاره
export function IconBrand(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.2" />
    </Base>
  );
}

// طراحی ساختار و فرایندهای سازمانی — نمودار سازمانی
export function IconStructure(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <rect x="3" y="16" width="6" height="4" rx="1" />
      <rect x="15" y="16" width="6" height="4" rx="1" />
      <path d="M12 7v4M6 16v-2.5h12V16" />
    </Base>
  );
}

// مشاوره‌ی فروش و توسعه‌ی بازار — روند صعودی
export function IconSales(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 20h18" />
      <path d="M5 16l4-4 3 3 5-6" />
      <path d="M17 9h3v3" />
    </Base>
  );
}

/* ── آیکون‌های فرایند ── */

// ثبت درخواست — فرم
export function IconForm(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </Base>
  );
}

// گفت‌وگوی اولیه — تماس
export function IconCall(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z" />
    </Base>
  );
}

// جلسه‌ی مشاوره — گفت‌وگو
export function IconMeeting(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5h11a2 2 0 012 2v5a2 2 0 01-2 2H9l-4 3v-3a2 2 0 01-1-2V7a2 2 0 011-2z" />
      <path d="M8 8.5h5M8 11h3" />
    </Base>
  );
}

// نقشه‌ی راه — مسیر
export function IconRoadmap(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 19c0-3 3-3 3-6s-3-3-3-6" />
      <circle cx="5" cy="5" r="1.6" />
      <circle cx="8" cy="13" r="1.6" />
      <path d="M12 18h7M15 6h4" />
      <path d="M17 4l2 2-2 2" />
    </Base>
  );
}

/* ── آیکون‌های عمومی ── */

export function IconArrowLeft(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Base>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 6L9 17l-5-5" />
    </Base>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </Base>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z" />
    </Base>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s-6-5.3-6-10a6 6 0 1112 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </Base>
  );
}

export function IconQuote(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width={24} height={24} {...props}>
      <path d="M9.5 6C6.5 6 4 8.6 4 12v6h6v-6H7c0-1.9 1.1-3 2.5-3V6zm10 0c-3 0-5.5 2.6-5.5 6v6h6v-6h-3c0-1.9 1.1-3 2.5-3V6z" />
    </svg>
  );
}
