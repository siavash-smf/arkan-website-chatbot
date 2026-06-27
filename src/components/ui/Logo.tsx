import { cn } from "@/lib/utils";

type LogoProps = {
  /** رنگ متن و خطوط روشن — برای پس‌زمینه‌ی تیره از bone استفاده کنید */
  variant?: "dark" | "light";
  className?: string;
};

/**
 * لوگوی آرکان: نشانه‌ی «چهار رکن» (چهار خط عمودی هم‌آهنگ) + واژه‌نشان فارسی.
 * نشانه با SVG ساخته شده تا در هر اندازه تیز بماند.
 */
export default function Logo({ variant = "dark", className }: LogoProps) {
  const mainColor = variant === "light" ? "#F7F3EC" : "#143A32";

  return (
    <span
      className={cn("inline-flex items-center gap-2.5 select-none", className)}
      aria-label="آرکان"
    >
      {/* نشانه: چهار رکن */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <g strokeLinecap="round">
          <line x1="9" y1="29" x2="9" y2="17" stroke={mainColor} strokeWidth="2.6" />
          <line x1="16" y1="29" x2="16" y2="11" stroke={mainColor} strokeWidth="2.6" />
          <line x1="23" y1="29" x2="23" y2="13" stroke="#B5853A" strokeWidth="2.6" />
          <line x1="30" y1="29" x2="30" y2="19" stroke={mainColor} strokeWidth="2.6" />
        </g>
      </svg>
      {/* واژه‌نشان */}
      <span
        className="font-heading text-2xl font-bold leading-none tracking-tight"
        style={{ color: mainColor }}
      >
        آرکان
      </span>
    </span>
  );
}
