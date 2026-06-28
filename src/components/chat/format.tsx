import type { ReactNode } from "react";

/** رندر سبکِ **پررنگ** بدون کتابخانه‌ی markdown؛ خطوط با whitespace-pre-wrap حفظ می‌شوند. */
export function renderBold(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
