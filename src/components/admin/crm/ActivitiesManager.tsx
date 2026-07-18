"use client";

import { useMemo, useState } from "react";
import { toFa } from "@/lib/utils";
import {
  ACTIVITY_TYPE_META,
  type ActivityType,
  type ActivityWithRefs,
  type Contact,
} from "@/lib/crm/types";
import { ActivityForm, ActivityItem, activityDueState } from "./ActivityBits";
import { EmptyBox, ErrorBox, FilterChip, outlineBtnClass } from "./ui";

type StatusFilter = "all" | "open" | "done" | "overdue" | "today";

const TYPE_FILTERS: Array<ActivityType | "all"> = ["all", "call", "meeting", "note", "task"];

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "همه" },
  { key: "open", label: "باز" },
  { key: "overdue", label: "معوق" },
  { key: "today", label: "امروز" },
  { key: "done", label: "انجام‌شده" },
];

export default function ActivitiesManager({
  activities,
  contacts,
  error,
  canEdit,
}: {
  activities: ActivityWithRefs[];
  contacts: Pick<Contact, "id" | "full_name">[];
  error: string | null;
  canEdit: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<ActivityType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      const due = activityDueState(a);
      switch (statusFilter) {
        case "open":
          return !a.done_at && a.type !== "stage_change";
        case "done":
          return Boolean(a.done_at);
        case "overdue":
          return due === "overdue";
        case "today":
          return due === "today";
        default:
          return true;
      }
    });
  }, [activities, typeFilter, statusFilter]);

  const overdueCount = useMemo(
    () => activities.filter((a) => activityDueState(a) === "overdue").length,
    [activities]
  );

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">فعالیت‌ها و وظایف</h1>
          <p className="mt-1 text-caption text-slate">
            {toFa(activities.length)} فعالیت
            {overdueCount > 0 && (
              <span className="mr-2 font-medium text-red-600">
                · {toFa(overdueCount)} وظیفه‌ی معوق
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setShowForm((v) => !v)} className={outlineBtnClass}>
            {showForm ? "بستن فرم" : "+ فعالیت جدید"}
          </button>
        )}
      </div>

      {error ? (
        <ErrorBox message={error} />
      ) : (
        <>
          {showForm && (
            <div className="mb-6 rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
              <h2 className="mb-4 font-heading text-body font-semibold text-pine">فعالیت جدید</h2>
              <ActivityForm contacts={contacts} onDone={() => setShowForm(false)} />
            </div>
          )}

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((t) => (
                <FilterChip
                  key={t}
                  active={typeFilter === t}
                  onClick={() => setTypeFilter(t)}
                  label={t === "all" ? "همه‌ی انواع" : ACTIVITY_TYPE_META[t].label}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((s) => (
                <FilterChip
                  key={s.key}
                  active={statusFilter === s.key}
                  onClick={() => setStatusFilter(s.key)}
                  label={s.label}
                />
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyBox
              message={
                activities.length === 0
                  ? "هنوز فعالیتی ثبت نشده است."
                  : "نتیجه‌ای برای این فیلتر یافت نشد."
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((a) => (
                <ActivityItem key={a.id} activity={a} showRefs canEdit={canEdit} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
