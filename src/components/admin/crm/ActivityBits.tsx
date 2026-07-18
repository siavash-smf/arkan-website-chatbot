"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeActivity, createActivity, deleteActivity } from "@/app/admin/crm-actions";
import { ACTIVITY_TYPE_META, type Activity, type ActivityType } from "@/lib/crm/types";
import { Field, Spinner, formatDate, inputClass, primaryBtnClass } from "./ui";

/** اجزای مشترک فعالیت — استفاده در صفحه‌ی فعالیت‌ها و نمای ۳۶۰ مخاطب. */

export function activityDueState(a: Pick<Activity, "due_at" | "done_at">): "overdue" | "today" | null {
  if (!a.due_at || a.done_at) return null;
  const due = new Date(a.due_at);
  const now = new Date();
  if (due < now) return "overdue";
  if (due.toDateString() === now.toDateString()) return "today";
  return null;
}

export function DueBadge({ state }: { state: "overdue" | "today" | null }) {
  if (state === "overdue") {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[0.8rem] font-medium text-red-700">
        معوق
      </span>
    );
  }
  if (state === "today") {
    return (
      <span className="rounded-full bg-brass/15 px-2.5 py-0.5 text-[0.8rem] font-medium text-brass-dark">
        امروز
      </span>
    );
  }
  return null;
}

export function ActivityItem({
  activity,
  showRefs,
  canEdit = true,
}: {
  activity: Activity & {
    contact?: { id: string; full_name: string } | null;
    deal?: { id: string; title: string } | null;
  };
  showRefs?: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const meta = ACTIVITY_TYPE_META[activity.type] ?? { label: activity.type, icon: "•" };
  const dueState = activityDueState(activity);
  const completable = activity.type === "task" || activity.type === "meeting";

  function toggleDone(done: boolean) {
    startTransition(async () => {
      const res = await completeActivity(activity.id, done);
      if (res.ok) router.refresh();
      else alert(res.error ?? "خطا در به‌روزرسانی فعالیت.");
    });
  }

  function remove() {
    if (!confirm("این فعالیت حذف شود؟")) return;
    startTransition(async () => {
      const res = await deleteActivity(activity.id);
      if (res.ok) router.refresh();
      else alert(res.error ?? "حذف ناموفق بود.");
    });
  }

  return (
    <div
      className={`rounded-card border p-4 transition-colors ${
        dueState === "overdue"
          ? "border-red-200 bg-red-50"
          : "border-sand bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        {completable && canEdit ? (
          <input
            type="checkbox"
            checked={Boolean(activity.done_at)}
            disabled={pending}
            onChange={(e) => toggleDone(e.target.checked)}
            className="mt-1.5 h-4 w-4 shrink-0 cursor-pointer accent-pine"
            aria-label="انجام شد"
          />
        ) : (
          <span className="mt-0.5 shrink-0 text-[1.05rem]" aria-hidden="true">
            {meta.icon}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`text-[0.95rem] font-medium ${
                activity.done_at ? "text-slate line-through" : "text-ink"
              }`}
            >
              {activity.title}
            </span>
            <span className="rounded-full bg-sand px-2 py-0.5 text-[0.75rem] text-ink">
              {meta.label}
            </span>
            <DueBadge state={dueState} />
          </div>
          {activity.body && (
            <p className="mt-1 whitespace-pre-wrap text-caption leading-6 text-slate">
              {activity.body}
            </p>
          )}
          <p className="mt-1.5 text-[0.75rem] text-slate">
            {activity.due_at
              ? `سررسید: ${formatDate(activity.due_at)}`
              : formatDate(activity.created_at)}
            {activity.created_by && ` · ${activity.created_by}`}
            {showRefs && activity.contact && (
              <>
                {" · "}
                <a
                  href={`/admin/crm/contacts/${activity.contact.id}`}
                  className="text-pine underline-offset-2 hover:underline"
                >
                  {activity.contact.full_name}
                </a>
              </>
            )}
            {showRefs && activity.deal && ` · معامله: ${activity.deal.title}`}
          </p>
        </div>

        {canEdit && activity.type !== "stage_change" && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="shrink-0 text-caption text-slate transition-colors hover:text-red-600"
            aria-label="حذف فعالیت"
          >
            {pending ? <Spinner /> : "حذف"}
          </button>
        )}
      </div>
    </div>
  );
}

const FORM_TYPES: ActivityType[] = ["call", "meeting", "note", "task"];

export function ActivityForm({
  contactId,
  dealId,
  contacts,
  onDone,
}: {
  contactId?: string;
  dealId?: string;
  contacts?: Array<{ id: string; full_name: string }>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    // datetime-local تایم‌زون ندارد؛ همین‌جا (مرورگر کاربر) به لحظه‌ی ISO تبدیل می‌شود
    // تا سرور (UTC روی Vercel) زمان را جابه‌جا تفسیر نکند.
    const rawDue = String(formData.get("due_at") ?? "");
    const dueIso = rawDue ? new Date(rawDue).toISOString() : "";
    startTransition(async () => {
      const res = await createActivity({
        contact_id: contactId ?? String(formData.get("contact_id") ?? ""),
        deal_id: dealId ?? "",
        type: String(formData.get("type") ?? "note") as ActivityType & ("call" | "meeting" | "note" | "task"),
        title: String(formData.get("title") ?? ""),
        body: String(formData.get("body") ?? ""),
        due_at: dueIso,
      });
      if (res.ok) {
        onDone?.();
        router.refresh();
      } else {
        setError(res.error ?? "ثبت فعالیت ناموفق بود.");
      }
    });
  }

  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="نوع">
        <select name="type" className={inputClass} defaultValue="note">
          {FORM_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTIVITY_TYPE_META[t].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="عنوان *">
        <input name="title" required className={inputClass} />
      </Field>
      {!contactId && contacts && (
        <Field label="مخاطب">
          <select name="contact_id" className={inputClass} defaultValue="">
            <option value="">— انتخاب مخاطب —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="سررسید (برای وظیفه/جلسه)">
        <input name="due_at" type="datetime-local" dir="ltr" className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="توضیحات">
          <textarea name="body" rows={2} className={inputClass} />
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-caption text-red-600 sm:col-span-2">
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryBtnClass}>
          {pending && <Spinner light />}
          ثبت فعالیت
        </button>
      </div>
    </form>
  );
}
