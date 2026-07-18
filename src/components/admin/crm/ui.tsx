"use client";

/** خرده‌کامپوننت‌های مشترک UI ماژول CRM — هم‌راستا با زبان بصری LeadsManager. */

export function formatDate(iso: string, withTime = true): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" as const } : {}),
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 ${
        light ? "border-bone/40 border-t-bone" : "border-slate/30 border-t-pine"
      }`}
      aria-hidden="true"
    />
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
      {message}
    </div>
  );
}

export function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-dashed border-sand bg-white px-5 py-16 text-center text-slate">
      {message}
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-caption transition-colors ${
        active
          ? "bg-pine text-bone"
          : "border border-sand bg-white text-slate hover:border-pine/30"
      }`}
    >
      {label}
    </button>
  );
}

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-slate">{label}:</span>
      <span className="min-w-0 break-words text-ink">{value || "—"}</span>
    </div>
  );
}

export const inputClass =
  "w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink transition-colors placeholder:text-slate/60 focus:border-brass focus:outline-none";

export const primaryBtnClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-pine px-5 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60";

export const outlineBtnClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn border border-pine/25 px-4 py-2 text-caption text-pine transition-colors hover:bg-pine/5 disabled:opacity-60";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-caption font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}
