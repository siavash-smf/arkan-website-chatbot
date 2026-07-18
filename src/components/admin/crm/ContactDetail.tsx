"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContact, summarizeContactAI } from "@/app/admin/crm-actions";
import { formatToman, toFa } from "@/lib/utils";
import {
  CONTACT_SOURCE_LABELS,
  DEAL_STATUS_META,
  type PipelineStage,
} from "@/lib/crm/types";
import type { Contact360 } from "@/lib/crm/queries";
import { ActivityForm, ActivityItem } from "./ActivityBits";
import { EmptyBox, InfoRow, Spinner, formatDate, outlineBtnClass } from "./ui";

type TimelineEntry = {
  key: string;
  at: string;
  node: React.ReactNode;
};

export default function ContactDetail({
  data,
  stages,
  canEdit,
}: {
  data: Contact360;
  stages: PipelineStage[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { contact, company, deals, activities, lead, conversation } = data;
  const [aiError, setAiError] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [aiPending, startAiTransition] = useTransition();
  const [, startTransition] = useTransition();

  const stageLabel = useMemo(
    () => new Map(stages.map((s) => [s.key, s.label_fa])),
    [stages]
  );

  function runSummarize() {
    setAiError(null);
    startAiTransition(async () => {
      const res = await summarizeContactAI(contact.id);
      if (res.ok) router.refresh();
      else setAiError(res.error ?? "خلاصه‌سازی ناموفق بود.");
    });
  }

  function removeContact() {
    if (!confirm("مخاطب و همه‌ی معاملات/فعالیت‌های متصل حذف شوند؟")) return;
    startTransition(async () => {
      const res = await deleteContact(contact.id);
      if (res.ok) {
        router.push("/admin/crm/contacts");
        router.refresh();
      } else {
        alert(res.error ?? "حذف ناموفق بود.");
      }
    });
  }

  // تایم‌لاین یکپارچه: ثبت لید + گفتگوی چت‌بات + فعالیت‌ها
  const timeline: TimelineEntry[] = useMemo(() => {
    const entries: TimelineEntry[] = activities.map((a) => ({
      key: `activity-${a.id}`,
      at: a.created_at,
      node: <ActivityItem activity={a} canEdit={canEdit} />,
    }));

    if (lead) {
      entries.push({
        key: "lead",
        at: lead.created_at,
        node: (
          <div className="rounded-card border border-brass/30 bg-brass/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden="true">🎯</span>
              <span className="text-[0.95rem] font-medium text-ink">ثبت به‌عنوان لید</span>
              {typeof lead.ai_score === "number" && (
                <span className="rounded-full bg-pine/10 px-2.5 py-0.5 text-[0.8rem] font-medium text-pine">
                  امتیاز AI: {toFa(lead.ai_score)}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-caption leading-6 text-slate">
              مرحله‌ی کسب‌وکار: {lead.stage}
              {lead.preferred_time && ` · زمان تماس: ${lead.preferred_time}`}
            </p>
            <p className="mt-1 text-caption leading-6 text-ink">{lead.challenge}</p>
            <p className="mt-1.5 text-[0.75rem] text-slate">{formatDate(lead.created_at)}</p>
          </div>
        ),
      });
    }

    if (conversation) {
      entries.push({
        key: "conversation",
        at: conversation.started_at,
        node: (
          <div className="rounded-card border border-sand bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">💬</span>
                <span className="text-[0.95rem] font-medium text-ink">گفتگو با چت‌بات</span>
                <span className="rounded-full bg-sand px-2 py-0.5 text-[0.75rem] text-ink">
                  {toFa(conversation.messages.length)} پیام
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowConversation((v) => !v)}
                className="text-caption text-pine underline-offset-4 hover:underline"
              >
                {showConversation ? "بستن گفتگو" : "نمایش گفتگو"}
              </button>
            </div>
            {showConversation && (
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto border-t border-sand pt-3">
                {conversation.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-card px-3.5 py-2.5 text-caption leading-6 ${
                      m.role === "user"
                        ? "bg-bone text-ink"
                        : "bg-pine/5 text-ink"
                    }`}
                  >
                    <span className="font-medium text-pine">
                      {m.role === "user" ? "کاربر" : "دستیار"}:
                    </span>{" "}
                    {m.content}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[0.75rem] text-slate">
              {formatDate(conversation.started_at)}
            </p>
          </div>
        ),
      });
    }

    return entries.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [activities, lead, conversation, showConversation, canEdit]);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <a
            href="/admin/crm/contacts"
            className="text-caption text-slate underline-offset-4 hover:text-pine hover:underline"
          >
            → همه‌ی مخاطبان
          </a>
          <h1 className="mt-1 font-heading text-h3 font-bold text-pine">
            {contact.full_name}
          </h1>
          <p className="mt-1 text-caption text-slate">
            منبع: {CONTACT_SOURCE_LABELS[contact.source] ?? contact.source} · ثبت در{" "}
            {formatDate(contact.created_at, false)}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={removeContact}
            className="shrink-0 rounded-btn border border-red-200 px-4 py-2 text-caption text-red-600 transition-colors hover:bg-red-50"
          >
            حذف مخاطب
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ستون اطلاعات */}
        <div className="space-y-6">
          <section className="rounded-card border border-sand bg-white p-5 shadow-soft">
            <h2 className="mb-3 font-heading text-body font-semibold text-pine">اطلاعات تماس</h2>
            <div className="space-y-2 text-[0.95rem]">
              <InfoRow
                label="تلفن"
                value={
                  contact.phone ? (
                    <a href={`tel:${contact.phone}`} dir="ltr" className="text-pine">
                      {contact.phone}
                    </a>
                  ) : null
                }
              />
              <InfoRow
                label="ایمیل"
                value={
                  contact.email ? (
                    <a href={`mailto:${contact.email}`} dir="ltr" className="text-pine">
                      {contact.email}
                    </a>
                  ) : null
                }
              />
              <InfoRow label="سمت" value={contact.position} />
              <InfoRow label="شرکت" value={company?.name} />
              {company?.industry && <InfoRow label="حوزه" value={company.industry} />}
              {contact.notes && <InfoRow label="یادداشت" value={contact.notes} />}
            </div>
          </section>

          {/* خلاصه‌ی AI */}
          <section className="rounded-card border border-sand bg-white p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-body font-semibold text-pine">
                ✨ شناخت مشتری (AI)
              </h2>
              {canEdit && contact.conversation_id && (
                <button
                  type="button"
                  onClick={runSummarize}
                  disabled={aiPending}
                  className="text-caption text-pine underline-offset-4 hover:underline disabled:opacity-60"
                >
                  {aiPending ? <Spinner /> : contact.ai_summary ? "به‌روزرسانی" : "تولید خلاصه"}
                </button>
              )}
            </div>
            {contact.ai_summary ? (
              <>
                <p className="whitespace-pre-wrap text-caption leading-7 text-ink">
                  {contact.ai_summary}
                </p>
                {contact.ai_summary_at && (
                  <p className="mt-2 text-[0.75rem] text-slate">
                    تولید در {formatDate(contact.ai_summary_at)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-caption text-slate">
                {contact.conversation_id
                  ? "هنوز خلاصه‌ای تولید نشده است. با دکمه‌ی «تولید خلاصه»، AI گفتگوی چت‌بات را تحلیل می‌کند."
                  : "گفتگویی از چت‌بات به این مخاطب متصل نیست."}
              </p>
            )}
            {aiError && (
              <p role="alert" className="mt-2 text-caption text-red-600">
                {aiError}
              </p>
            )}
          </section>

          {/* معاملات مخاطب */}
          <section className="rounded-card border border-sand bg-white p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-body font-semibold text-pine">معاملات</h2>
              <a
                href="/admin/crm/deals"
                className="text-caption text-pine underline-offset-4 hover:underline"
              >
                پایپ‌لاین ←
              </a>
            </div>
            {deals.length === 0 ? (
              <p className="text-caption text-slate">معامله‌ای ثبت نشده است.</p>
            ) : (
              <div className="space-y-3">
                {deals.map((d) => (
                  <div key={d.id} className="rounded-card border border-sand p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.95rem] font-medium text-ink">{d.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.75rem] font-medium ${DEAL_STATUS_META[d.status].className}`}
                      >
                        {stageLabel.get(d.stage_key) ?? d.stage_key}
                      </span>
                    </div>
                    <p className="mt-1 text-caption text-slate">
                      {d.amount_toman > 0 ? formatToman(d.amount_toman) : "بدون مبلغ"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* تایم‌لاین ۳۶۰ درجه */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-heading text-body font-semibold text-pine">
              تایم‌لاین ۳۶۰ درجه
            </h2>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowActivityForm((v) => !v)}
                className={outlineBtnClass}
              >
                {showActivityForm ? "بستن فرم" : "+ فعالیت جدید"}
              </button>
            )}
          </div>

          {showActivityForm && (
            <div className="mb-4 rounded-card border border-sand bg-white p-5 shadow-soft">
              <ActivityForm
                contactId={contact.id}
                onDone={() => setShowActivityForm(false)}
              />
            </div>
          )}

          {timeline.length === 0 ? (
            <EmptyBox message="رویدادی در تایم‌لاین نیست." />
          ) : (
            <div className="space-y-3">
              {timeline.map((entry) => (
                <div key={entry.key}>{entry.node}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
