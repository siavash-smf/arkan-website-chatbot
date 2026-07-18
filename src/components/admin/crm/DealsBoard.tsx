"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDeal,
  deleteDeal,
  moveDealStage,
  nextBestActionAI,
} from "@/app/admin/crm-actions";
import { formatToman, toFa } from "@/lib/utils";
import type { Contact, DealWithContact, PipelineStage } from "@/lib/crm/types";
import {
  EmptyBox,
  ErrorBox,
  Field,
  Spinner,
  inputClass,
  outlineBtnClass,
  primaryBtnClass,
} from "./ui";

/**
 * برد کانبان پایپ‌لاین معاملات.
 * درگ‌انددراپ بومی HTML5 + fallback با select برای موبایل/لمسی.
 * ستون‌های بسته‌شده (موفق/ناموفق) به‌صورت خلاصه‌ی فشرده در انتها.
 */

function daysIn(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export default function DealsBoard({
  stages,
  deals,
  contacts,
  error,
  canEdit,
}: {
  stages: PipelineStage[];
  deals: DealWithContact[];
  contacts: Pick<Contact, "id" | "full_name">[];
  error: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);
  // انتقال optimistic: تا رفرش سرور، معامله در ستون مقصد نمایش داده می‌شود
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const openStages = stages.filter((s) => !s.is_won && !s.is_lost);
  const closedStages = stages.filter((s) => s.is_won || s.is_lost);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealWithContact[]>();
    for (const s of stages) map.set(s.key, []);
    for (const d of deals) {
      const stage = optimisticMoves[d.id] ?? d.stage_key;
      (map.get(stage) ?? map.get(d.stage_key))?.push(d);
    }
    return map;
  }, [deals, stages, optimisticMoves]);

  function move(dealId: string, stageKey: string, currentStage: string) {
    if (stageKey === currentStage) return;
    const target = stages.find((s) => s.key === stageKey);
    let lostReason: string | undefined;
    if (target?.is_lost) {
      lostReason = prompt("دلیل شکست معامله (اختیاری):") ?? undefined;
    }
    setOptimisticMoves((m) => ({ ...m, [dealId]: stageKey }));
    setPendingDealId(dealId);
    startTransition(async () => {
      const res = await moveDealStage(dealId, stageKey, lostReason);
      setPendingDealId(null);
      if (res.ok) router.refresh();
      else alert(res.error ?? "جابه‌جایی ناموفق بود.");
      // در هر دو حالت override محلی پاک می‌شود: بعد از موفقیت، داده‌ی سرور
      // (router.refresh) مرجع است؛ اگر بماند تغییرات بعدی سرور را می‌پوشاند.
      setOptimisticMoves((m) => {
        const { [dealId]: _dropped, ...rest } = m;
        return rest;
      });
    });
  }

  function submitNew(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const res = await createDeal({
        title: String(formData.get("title") ?? ""),
        contact_id: String(formData.get("contact_id") ?? ""),
        amount_toman: Number(formData.get("amount_toman") ?? 0) || 0,
        expected_close: String(formData.get("expected_close") ?? ""),
      });
      if (res.ok) {
        setShowForm(false);
        router.refresh();
      } else {
        setFormError(res.error ?? "ثبت معامله ناموفق بود.");
      }
    });
  }

  const openTotal = openStages
    .flatMap((s) => dealsByStage.get(s.key) ?? [])
    .reduce((sum, d) => sum + d.amount_toman, 0);

  // پراپ‌های مشترک پذیرش drop برای ستون‌های باز و کارت‌های بسته‌شده
  function dropProps(stageKey: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragOverStage(stageKey);
      },
      onDragLeave: () => setDragOverStage(null),
      onDrop: (e: React.DragEvent) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragOverStage(null);
        const dealId = e.dataTransfer.getData("text/deal-id");
        const from = e.dataTransfer.getData("text/stage-key");
        if (dealId) move(dealId, stageKey, from);
      },
    };
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">پایپ‌لاین معاملات</h1>
          <p className="mt-1 text-caption text-slate">
            {toFa(deals.filter((d) => d.status === "open").length)} معامله‌ی باز به ارزش{" "}
            {formatToman(openTotal)}
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setShowForm((v) => !v)} className={outlineBtnClass}>
            {showForm ? "بستن فرم" : "+ معامله جدید"}
          </button>
        )}
      </div>

      {error ? (
        <ErrorBox message={error} />
      ) : (
        <>
          {showForm && (
            <form
              action={submitNew}
              className="mb-6 rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6"
            >
              <h2 className="mb-4 font-heading text-body font-semibold text-pine">معامله جدید</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="عنوان *">
                  <input name="title" required className={inputClass} />
                </Field>
                <Field label="مخاطب *">
                  <select name="contact_id" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      — انتخاب مخاطب —
                    </option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="مبلغ تخمینی (تومان)">
                  <input name="amount_toman" type="number" min={0} dir="ltr" className={inputClass} />
                </Field>
                <Field label="تاریخ بستن موردانتظار">
                  <input name="expected_close" type="date" dir="ltr" className={inputClass} />
                </Field>
              </div>
              {formError && (
                <p role="alert" className="mt-3 text-caption text-red-600">
                  {formError}
                </p>
              )}
              <div className="mt-4">
                <button type="submit" disabled={pending} className={primaryBtnClass}>
                  {pending && <Spinner light />}
                  ثبت معامله
                </button>
              </div>
            </form>
          )}

          {contacts.length === 0 && deals.length === 0 ? (
            <EmptyBox message="برای ساخت معامله ابتدا یک لید را تبدیل کنید یا مخاطب بسازید." />
          ) : (
            <>
              {/* ستون‌های باز — اسکرول افقی در نمایشگر کوچک */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {openStages.map((stage) => {
                  const stageDeals = dealsByStage.get(stage.key) ?? [];
                  const stageTotal = stageDeals.reduce((s, d) => s + d.amount_toman, 0);
                  return (
                    <div
                      key={stage.key}
                      {...dropProps(stage.key)}
                      className={`flex w-64 shrink-0 flex-col rounded-card border bg-bone/60 transition-shadow ${
                        dragOverStage === stage.key
                          ? "border-brass ring-2 ring-brass/40"
                          : "border-sand"
                      }`}
                    >
                      <div className="border-b border-sand px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[0.95rem] font-medium text-pine">
                            {stage.label_fa}
                          </span>
                          <span className="rounded-full bg-sand px-2 py-0.5 text-[0.75rem] text-ink">
                            {toFa(stageDeals.length)}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-3 p-3">
                        {stageDeals.map((deal) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            stages={stages}
                            currentStage={stage.key}
                            pending={pendingDealId === deal.id}
                            canEdit={canEdit}
                            onMove={move}
                          />
                        ))}
                        {stageDeals.length === 0 && (
                          <p className="px-1 py-6 text-center text-[0.8rem] text-slate/70">
                            {canEdit ? "معامله را اینجا رها کنید" : "خالی"}
                          </p>
                        )}
                      </div>

                      <div className="border-t border-sand px-4 py-2.5 text-caption text-slate">
                        جمع: <span className="text-ink">{formatToman(stageTotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* خلاصه‌ی بسته‌شده‌ها */}
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                {closedStages.map((stage) => {
                  const stageDeals = dealsByStage.get(stage.key) ?? [];
                  const total = stageDeals.reduce((s, d) => s + d.amount_toman, 0);
                  return (
                    <div
                      key={stage.key}
                      {...dropProps(stage.key)}
                      className={`rounded-card border p-5 transition-shadow ${
                        dragOverStage === stage.key
                          ? "border-brass ring-2 ring-brass/40"
                          : stage.is_won
                            ? "border-green-200 bg-green-50"
                            : "border-sand bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-medium ${stage.is_won ? "text-green-700" : "text-slate"}`}
                        >
                          {stage.is_won ? "🏆 " : ""}
                          {stage.label_fa}
                        </span>
                        <span className="text-caption text-slate">
                          {toFa(stageDeals.length)} معامله · {formatToman(total)}
                        </span>
                      </div>
                      {stageDeals.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {stageDeals.slice(0, 5).map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-2 text-caption">
                              <span className="truncate text-ink">{d.title}</span>
                              <span className="shrink-0 text-slate">
                                {formatToman(d.amount_toman)}
                              </span>
                            </li>
                          ))}
                          {stageDeals.length > 5 && (
                            <li className="text-[0.75rem] text-slate">
                              و {toFa(stageDeals.length - 5)} مورد دیگر…
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function DealCard({
  deal,
  stages,
  currentStage,
  pending,
  canEdit,
  onMove,
}: {
  deal: DealWithContact;
  stages: PipelineStage[];
  currentStage: string;
  pending: boolean;
  canEdit: boolean;
  onMove: (dealId: string, stageKey: string, currentStage: string) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [aiPending, startAiTransition] = useTransition();
  const [, startTransition] = useTransition();

  function runNextAction() {
    startAiTransition(async () => {
      const res = await nextBestActionAI(deal.id);
      if (res.ok) router.refresh();
      else alert(res.error ?? "تولید پیشنهاد ناموفق بود.");
    });
  }

  function remove() {
    if (!confirm(`معامله‌ی «${deal.title}» حذف شود؟`)) return;
    startTransition(async () => {
      const res = await deleteDeal(deal.id);
      if (res.ok) router.refresh();
      else alert(res.error ?? "حذف ناموفق بود.");
    });
  }

  const days = daysIn(deal.stage_entered_at);

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/deal-id", deal.id);
        e.dataTransfer.setData("text/stage-key", currentStage);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`rounded-card border border-sand bg-white p-3.5 shadow-soft transition-opacity ${
        canEdit ? "cursor-grab active:cursor-grabbing" : ""
      } ${pending ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.9rem] font-medium leading-6 text-ink">{deal.title}</p>
        {pending && <Spinner />}
      </div>
      {deal.contact && (
        <a
          href={`/admin/crm/contacts/${deal.contact.id}`}
          className="mt-1 block truncate text-caption text-pine underline-offset-2 hover:underline"
        >
          {deal.contact.full_name}
        </a>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-[0.8rem]">
        <span className="font-medium text-brass-dark">
          {deal.amount_toman > 0 ? formatToman(deal.amount_toman) : "بدون مبلغ"}
        </span>
        <span className="text-slate" title="روز در این مرحله">
          {toFa(days)} روز
        </span>
      </div>

      {deal.ai_next_action && (
        <p className="mt-2 whitespace-pre-wrap rounded-card bg-pine/5 px-2.5 py-2 text-[0.78rem] leading-5 text-ink">
          ✨ {deal.ai_next_action}
        </p>
      )}

      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-[0.75rem] text-slate transition-colors hover:text-pine"
          >
            {expanded ? "بستن ▴" : "گزینه‌ها ▾"}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 border-t border-sand pt-2">
              {/* fallback جابه‌جایی بدون درگ (موبایل/دسترس‌پذیری) */}
              <select
                value={currentStage}
                disabled={pending}
                onChange={(e) => onMove(deal.id, e.target.value, currentStage)}
                className="w-full rounded-btn border border-slate/30 bg-white px-2.5 py-1.5 text-[0.8rem] text-ink focus:border-brass focus:outline-none"
                aria-label="انتقال به مرحله"
              >
                {stages.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label_fa}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={runNextAction}
                  disabled={aiPending}
                  className="inline-flex items-center gap-1.5 text-[0.78rem] text-pine underline-offset-2 hover:underline disabled:opacity-60"
                >
                  {aiPending && <Spinner />}
                  ✨ اقدام بعدی؟
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="text-[0.78rem] text-slate transition-colors hover:text-red-600"
                >
                  حذف
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
