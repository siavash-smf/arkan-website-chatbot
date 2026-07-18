"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCompany, deleteCompany, updateCompany } from "@/app/admin/crm-actions";
import { toFa } from "@/lib/utils";
import type { Company } from "@/lib/crm/types";
import {
  EmptyBox,
  ErrorBox,
  Field,
  Spinner,
  formatDate,
  inputClass,
  outlineBtnClass,
  primaryBtnClass,
} from "./ui";

type CompanyRow = Company & { contact_count: number; deal_count: number };

function CompanyForm({
  initial,
  onSubmit,
  pending,
  error,
}: {
  initial?: Company;
  onSubmit: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="نام شرکت *">
        <input name="name" required defaultValue={initial?.name} className={inputClass} />
      </Field>
      <Field label="حوزه">
        <input name="industry" defaultValue={initial?.industry ?? ""} className={inputClass} />
      </Field>
      <Field label="وب‌سایت">
        <input name="website" dir="ltr" defaultValue={initial?.website ?? ""} className={inputClass} />
      </Field>
      <Field label="شهر">
        <input name="city" defaultValue={initial?.city ?? ""} className={inputClass} />
      </Field>
      <Field label="اندازه (تعداد نفرات)">
        <input name="size_label" placeholder="مثلاً ۱۱-۵۰" defaultValue={initial?.size_label ?? ""} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="یادداشت">
          <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} className={inputClass} />
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
          {initial ? "ذخیره‌ی تغییرات" : "ثبت شرکت"}
        </button>
      </div>
    </form>
  );
}

export default function CompaniesManager({
  companies,
  error,
  canEdit,
}: {
  companies: CompanyRow[];
  error: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      [c.name, c.industry, c.city].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [companies, query]);

  function readForm(formData: FormData) {
    return {
      name: String(formData.get("name") ?? ""),
      industry: String(formData.get("industry") ?? ""),
      website: String(formData.get("website") ?? ""),
      city: String(formData.get("city") ?? ""),
      size_label: String(formData.get("size_label") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };
  }

  function submitCreate(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const res = await createCompany(readForm(formData));
      if (res.ok) {
        setShowForm(false);
        router.refresh();
      } else setFormError(res.error ?? "ثبت شرکت ناموفق بود.");
    });
  }

  function submitEdit(formData: FormData) {
    if (!editing) return;
    setFormError(null);
    startTransition(async () => {
      const res = await updateCompany(editing.id, readForm(formData));
      if (res.ok) {
        setEditing(null);
        router.refresh();
      } else setFormError(res.error ?? "ذخیره ناموفق بود.");
    });
  }

  function remove(company: CompanyRow) {
    if (!confirm(`شرکت «${company.name}» حذف شود؟ مخاطبان آن بدون شرکت می‌شوند.`)) return;
    startTransition(async () => {
      const res = await deleteCompany(company.id);
      if (res.ok) router.refresh();
      else alert(res.error ?? "حذف ناموفق بود.");
    });
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">شرکت‌ها</h1>
          <p className="mt-1 text-caption text-slate">
            مجموعاً {toFa(companies.length)} شرکت ثبت شده است.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setEditing(null);
            }}
            className={outlineBtnClass}
          >
            {showForm ? "بستن فرم" : "+ شرکت جدید"}
          </button>
        )}
      </div>

      {error ? (
        <ErrorBox message={error} />
      ) : (
        <>
          {(showForm || editing) && (
            <div className="mb-6 rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
              <h2 className="mb-4 font-heading text-body font-semibold text-pine">
                {editing ? `ویرایش «${editing.name}»` : "شرکت جدید"}
              </h2>
              <CompanyForm
                key={editing?.id ?? "new"}
                initial={editing ?? undefined}
                onSubmit={editing ? submitEdit : submitCreate}
                pending={pending}
                error={formError}
              />
            </div>
          )}

          <div className="mb-5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در نام، حوزه یا شهر…"
              className={`${inputClass} sm:max-w-sm`}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyBox
              message={
                companies.length === 0
                  ? "هنوز شرکتی ثبت نشده است."
                  : "نتیجه‌ای برای این جستجو یافت نشد."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-card border border-sand bg-white shadow-soft">
              <table className="w-full text-[0.95rem]">
                <thead>
                  <tr className="border-b border-sand text-right text-caption text-slate">
                    <th className="px-5 py-3 font-medium">نام</th>
                    <th className="px-5 py-3 font-medium">حوزه</th>
                    <th className="px-5 py-3 font-medium">شهر</th>
                    <th className="px-5 py-3 font-medium">مخاطبان</th>
                    <th className="px-5 py-3 font-medium">معاملات</th>
                    <th className="px-5 py-3 font-medium">ثبت</th>
                    {canEdit && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-sand/60 transition-colors last:border-0 hover:bg-bone/60"
                    >
                      <td className="px-5 py-3.5 font-medium text-ink">
                        {c.name}
                        {c.website && (
                          <a
                            href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                            target="_blank"
                            rel="noreferrer"
                            dir="ltr"
                            className="mr-2 text-caption text-pine underline-offset-2 hover:underline"
                          >
                            ↗
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-ink">{c.industry ?? "—"}</td>
                      <td className="px-5 py-3.5 text-ink">{c.city ?? "—"}</td>
                      <td className="px-5 py-3.5 text-ink">{toFa(c.contact_count)}</td>
                      <td className="px-5 py-3.5 text-ink">{toFa(c.deal_count)}</td>
                      <td className="px-5 py-3.5 text-caption text-slate">
                        {formatDate(c.created_at, false)}
                      </td>
                      {canEdit && (
                        <td className="px-5 py-3.5 text-left">
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(c);
                                setShowForm(false);
                              }}
                              className="text-caption text-pine underline-offset-4 hover:underline"
                            >
                              ویرایش
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(c)}
                              className="text-caption text-slate transition-colors hover:text-red-600"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
