"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContact } from "@/app/admin/crm-actions";
import { toFa } from "@/lib/utils";
import {
  CONTACT_SOURCE_LABELS,
  type Company,
  type ContactWithCompany,
} from "@/lib/crm/types";
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

export default function ContactsManager({
  contacts,
  companies,
  error,
}: {
  contacts: ContactWithCompany[];
  companies: Pick<Company, "id" | "name">[];
  error: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.full_name, c.phone, c.email, c.position, c.company?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [contacts, query]);

  function submitNew(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const res = await createContact({
        full_name: String(formData.get("full_name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        position: String(formData.get("position") ?? ""),
        company_id: String(formData.get("company_id") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
      if (res.ok) {
        setShowForm(false);
        router.refresh();
      } else {
        setFormError(res.error ?? "ثبت مخاطب ناموفق بود.");
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">مخاطبان</h1>
          <p className="mt-1 text-caption text-slate">
            مجموعاً {toFa(contacts.length)} مخاطب ثبت شده است.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className={outlineBtnClass}
        >
          {showForm ? "بستن فرم" : "+ مخاطب جدید"}
        </button>
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
              <h2 className="mb-4 font-heading text-body font-semibold text-pine">
                مخاطب جدید
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="نام و نام خانوادگی *">
                  <input name="full_name" required className={inputClass} />
                </Field>
                <Field label="سمت">
                  <input name="position" className={inputClass} />
                </Field>
                <Field label="تلفن">
                  <input name="phone" dir="ltr" className={inputClass} />
                </Field>
                <Field label="ایمیل">
                  <input name="email" type="email" dir="ltr" className={inputClass} />
                </Field>
                <Field label="شرکت">
                  <select name="company_id" className={inputClass} defaultValue="">
                    <option value="">— بدون شرکت —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="یادداشت">
                    <textarea name="notes" rows={2} className={inputClass} />
                  </Field>
                </div>
              </div>
              {formError && (
                <p role="alert" className="mt-3 text-caption text-red-600">
                  {formError}
                </p>
              )}
              <div className="mt-4">
                <button type="submit" disabled={pending} className={primaryBtnClass}>
                  {pending && <Spinner light />}
                  ثبت مخاطب
                </button>
              </div>
            </form>
          )}

          <div className="mb-5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در نام، تلفن، ایمیل یا شرکت…"
              className={`${inputClass} sm:max-w-sm`}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyBox
              message={
                contacts.length === 0
                  ? "هنوز مخاطبی ثبت نشده است. لیدها را تبدیل کنید یا مخاطب جدید بسازید."
                  : "نتیجه‌ای برای این جستجو یافت نشد."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-card border border-sand bg-white shadow-soft">
              <table className="w-full text-[0.95rem]">
                <thead>
                  <tr className="border-b border-sand text-right text-caption text-slate">
                    <th className="px-5 py-3 font-medium">نام</th>
                    <th className="px-5 py-3 font-medium">شرکت</th>
                    <th className="px-5 py-3 font-medium">تلفن</th>
                    <th className="px-5 py-3 font-medium">منبع</th>
                    <th className="px-5 py-3 font-medium">تاریخ ثبت</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-sand/60 transition-colors last:border-0 hover:bg-bone/60"
                    >
                      <td className="px-5 py-3.5">
                        <a
                          href={`/admin/crm/contacts/${c.id}`}
                          className="font-medium text-pine underline-offset-4 hover:underline"
                        >
                          {c.full_name}
                        </a>
                        {c.position && (
                          <span className="mr-2 text-caption text-slate">· {c.position}</span>
                        )}
                        {c.ai_summary && (
                          <span title="خلاصه‌ی AI دارد" className="mr-1.5 text-caption">
                            ✨
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-ink">{c.company?.name ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} dir="ltr" className="text-pine">
                            {c.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-sand px-2.5 py-0.5 text-[0.8rem] text-ink">
                          {CONTACT_SOURCE_LABELS[c.source] ?? c.source}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-caption text-slate">
                        {formatDate(c.created_at, false)}
                      </td>
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
