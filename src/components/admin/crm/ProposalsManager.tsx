"use client";

import { useState } from "react";
import { formatToman, toFa } from "@/lib/utils";
import { PROPOSAL_STATUS_META, pickOption, type ProposalRecord, type ProposalStatus } from "@/lib/crm/proposals/types";
import { EmptyBox, ErrorBox, FilterChip, formatDate, outlineBtnClass } from "./ui";

type Filter = "all" | "attention" | "open" | "closed";

const OPEN: ProposalStatus[] = ["draft", "sent", "viewed"];
const ATTENTION: ProposalStatus[] = ["approved", "changes_requested"];

function priceLabel(p: ProposalRecord): string {
  if (!p.options.length) return "—";
  if (p.selected_option || p.options.length === 1) {
    const o = pickOption(p.options, p.selected_option);
    return o ? formatToman(o.price) : "—";
  }
  const prices = p.options.map((o) => o.price);
  return `${formatToman(Math.min(...prices))} تا ${formatToman(Math.max(...prices))}`;
}

export default function ProposalsManager({
  proposals,
  error,
  canEdit,
}: {
  proposals: ProposalRecord[];
  error: string | null;
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const attention = proposals.filter((p) => ATTENTION.includes(p.status)).length;

  const visible = proposals.filter((p) =>
    filter === "all"
      ? true
      : filter === "attention"
        ? ATTENTION.includes(p.status)
        : filter === "open"
          ? OPEN.includes(p.status)
          : !OPEN.includes(p.status) && !ATTENTION.includes(p.status)
  );

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">پروپوزال‌ها</h1>
          <p className="mt-1 text-caption text-slate">
            پیشنهاد همکاری پیش از قرارداد: ساخت از قالب خدمات آرکان، ارسال PDF با ایمیل، انتخاب بسته و تأیید آنلاین
            کلاینت، و تبدیل به قرارداد.
          </p>
        </div>
        {canEdit && (
          <a href="/admin/crm/proposals/new" className={outlineBtnClass}>
            + پروپوزال جدید
          </a>
        )}
      </div>

      {error ? (
        <ErrorBox message={`${error} — اگر جدول پروپوزال‌ها هنوز ساخته نشده، فایل supabase/proposals-schema.sql را اجرا کنید.`} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`همه (${toFa(proposals.length)})`} />
            <FilterChip
              active={filter === "attention"}
              onClick={() => setFilter("attention")}
              label={`نیازمند اقدام (${toFa(attention)})`}
            />
            <FilterChip active={filter === "open"} onClick={() => setFilter("open")} label="در جریان" />
            <FilterChip active={filter === "closed"} onClick={() => setFilter("closed")} label="بسته‌شده" />
          </div>

          {visible.length === 0 ? (
            <EmptyBox
              message={
                proposals.length === 0
                  ? "هنوز پروپوزالی ساخته نشده است. از دکمه‌ی «+ پروپوزال جدید» شروع کنید."
                  : "در این فیلتر موردی نیست."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-card border border-sand bg-white shadow-soft">
              <table className="w-full text-[0.95rem]">
                <thead>
                  <tr className="border-b border-sand text-right text-caption text-slate">
                    <th className="px-5 py-3 font-medium">شماره</th>
                    <th className="px-5 py-3 font-medium">عنوان</th>
                    <th className="px-5 py-3 font-medium">کلاینت</th>
                    <th className="px-5 py-3 font-medium">مبلغ</th>
                    <th className="px-5 py-3 font-medium">وضعیت</th>
                    <th className="px-5 py-3 font-medium">بازدید</th>
                    <th className="px-5 py-3 font-medium">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const meta = PROPOSAL_STATUS_META[p.status];
                    return (
                      <tr key={p.id} className="border-b border-sand/60 transition-colors last:border-0 hover:bg-bone/60">
                        <td dir="ltr" className="px-5 py-3.5 text-right text-caption text-slate">
                          {p.proposal_no}
                          {p.revision > 1 && <span className="mr-1 text-[0.75rem]">v{p.revision}</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <a href={`/admin/crm/proposals/${p.id}`} className="font-medium text-pine underline-offset-4 hover:underline">
                            {p.title}
                          </a>
                        </td>
                        <td className="px-5 py-3.5 text-ink">
                          {p.client_name}
                          {p.client_company && <span className="mr-1.5 text-caption text-slate">· {p.client_company}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-ink">{priceLabel(p)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${meta.className}`}>{meta.label}</span>
                        </td>
                        <td className="px-5 py-3.5 text-caption text-slate">{p.view_count ? toFa(p.view_count) : "—"}</td>
                        <td className="px-5 py-3.5 text-caption text-slate">{formatDate(p.sent_at ?? p.created_at, false)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
