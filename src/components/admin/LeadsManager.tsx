"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { updateLeadStatus, logout, type LeadStatus } from "@/app/admin/actions";
import { toFa } from "@/lib/utils";

export type Lead = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  business_name: string;
  industry: string | null;
  stage: string;
  challenge: string;
  preferred_time: string | null;
  status: LeadStatus;
};

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "جدید", className: "bg-brass/15 text-brass-dark" },
  contacted: { label: "تماس گرفته شد", className: "bg-pine/10 text-pine" },
  scheduled: { label: "جلسه تنظیم شد", className: "bg-blue-100 text-blue-700" },
  won: { label: "موفق", className: "bg-green-100 text-green-700" },
  lost: { label: "منصرف", className: "bg-slate/15 text-slate" },
};

const STATUS_ORDER: LeadStatus[] = ["new", "contacted", "scheduled", "won", "lost"];

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function LeadsManager({
  leads,
  error,
}: {
  leads: Lead[];
  error: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return [l.full_name, l.phone, l.business_name, l.industry, l.challenge]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, query, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  function changeStatus(id: string, status: LeadStatus) {
    setPendingId(id);
    startTransition(async () => {
      const res = await updateLeadStatus(id, status);
      setPendingId(null);
      if (res.ok) router.refresh();
      else alert(res.error ?? "تغییر وضعیت ناموفق بود.");
    });
  }

  return (
    <div className="min-h-dvh bg-bone">
      {/* هدر پنل */}
      <header className="sticky top-0 z-10 border-b border-sand bg-bone/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden text-caption text-slate sm:inline">
              پنل مدیریت درخواست‌ها
            </span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-btn border border-pine/25 px-4 py-2 text-caption text-pine transition-colors hover:bg-pine/5"
            >
              خروج
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6">
          <h1 className="font-heading text-h3 font-bold text-pine">
            درخواست‌های مشاوره
          </h1>
          <p className="mt-1 text-caption text-slate">
            مجموعاً {toFa(leads.length)} درخواست ثبت شده است.
          </p>
        </div>

        {error ? (
          <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
            {error}
          </div>
        ) : (
          <>
            {/* فیلترها */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو در نام، تلفن، کسب‌وکار یا چالش…"
                className="w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-4 py-2.5 text-[0.95rem] text-ink transition-colors placeholder:text-slate/60 focus:border-brass focus:outline-none sm:max-w-sm"
              />
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                  label={`همه (${toFa(counts.all)})`}
                />
                {STATUS_ORDER.map((s) => (
                  <FilterChip
                    key={s}
                    active={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                    label={`${STATUS_META[s].label} (${toFa(counts[s] ?? 0)})`}
                  />
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-card border border-dashed border-sand bg-white px-5 py-16 text-center text-slate">
                {leads.length === 0
                  ? "هنوز درخواستی ثبت نشده است."
                  : "نتیجه‌ای برای این جستجو/فیلتر یافت نشد."}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    pending={pendingId === lead.id}
                    onStatusChange={changeStatus}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FilterChip({
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

function LeadCard({
  lead,
  pending,
  onStatusChange,
}: {
  lead: Lead;
  pending: boolean;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) {
  return (
    <article className="rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* اطلاعات اصلی */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-heading text-h3 font-semibold text-pine">
              {lead.full_name}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${STATUS_META[lead.status]?.className ?? ""}`}
            >
              {STATUS_META[lead.status]?.label ?? lead.status}
            </span>
          </div>

          <div className="mt-3 grid gap-x-6 gap-y-2 text-[0.95rem] sm:grid-cols-2">
            <InfoRow label="کسب‌وکار" value={lead.business_name} />
            <InfoRow label="حوزه" value={lead.industry} />
            <InfoRow
              label="تلفن"
              value={
                <a
                  href={`tel:${lead.phone}`}
                  dir="ltr"
                  className="text-pine underline-offset-2 hover:underline"
                >
                  {lead.phone}
                </a>
              }
            />
            <InfoRow
              label="ایمیل"
              value={
                lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    dir="ltr"
                    className="text-pine underline-offset-2 hover:underline"
                  >
                    {lead.email}
                  </a>
                ) : null
              }
            />
            <InfoRow label="مرحله" value={lead.stage} />
            <InfoRow label="زمان تماس" value={lead.preferred_time} />
          </div>

          <div className="mt-3">
            <p className="text-caption text-slate">چالش فعلی:</p>
            <p className="mt-1 text-[0.95rem] leading-7 text-ink">{lead.challenge}</p>
          </div>

          <p className="mt-3 text-caption text-slate">
            ثبت شده در {formatDate(lead.created_at)}
          </p>
        </div>

        {/* تغییر وضعیت */}
        <div className="shrink-0 sm:w-44">
          <label className="mb-1.5 block text-caption font-medium text-ink">
            وضعیت
          </label>
          <div className="relative">
            <select
              value={lead.status}
              disabled={pending}
              onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
              className="w-full min-h-[44px] cursor-pointer appearance-none rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink transition-colors focus:border-brass focus:outline-none disabled:opacity-60"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            {pending && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2">
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate/30 border-t-pine" />
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-slate">{label}:</span>
      <span className="min-w-0 break-words text-ink">{value || "—"}</span>
    </div>
  );
}
