"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContract } from "@/app/admin/crm-actions";
import { formatToman, toFa } from "@/lib/utils";
import {
  CONTRACT_STATUS_META,
  type Contact,
  type ContractWithRefs,
  type DealWithContact,
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

export default function ContractsManager({
  contracts,
  contacts,
  deals,
  error,
  canEdit,
}: {
  contracts: ContractWithRefs[];
  contacts: Pick<Contact, "id" | "full_name">[];
  deals: Pick<DealWithContact, "id" | "title" | "contact_id" | "amount_toman">[];
  error: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState("");
  const [pending, startTransition] = useTransition();

  const contactDeals = deals.filter((d) => d.contact_id === selectedContact);

  function submitNew(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const res = await createContract({
        title: String(formData.get("title") ?? ""),
        contact_id: String(formData.get("contact_id") ?? ""),
        deal_id: String(formData.get("deal_id") ?? ""),
        amount_toman: Number(formData.get("amount_toman") ?? 0) || 0,
        start_date: String(formData.get("start_date") ?? ""),
        duration_label: String(formData.get("duration_label") ?? ""),
      });
      if (res.ok && res.id) {
        router.push(`/admin/crm/contracts/${res.id}`);
        router.refresh();
      } else {
        setFormError(res.error ?? "ساخت قرارداد ناموفق بود.");
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">قراردادها</h1>
          <p className="mt-1 text-caption text-slate">
            مجموعاً {toFa(contracts.length)} قرارداد — با قالب برند آرکان، لینک ارسال به کلاینت و تأیید آنلاین.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setShowForm((v) => !v)} className={outlineBtnClass}>
            {showForm ? "بستن فرم" : "+ قرارداد جدید"}
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
              <h2 className="mb-1 font-heading text-body font-semibold text-pine">قرارداد جدید</h2>
              <p className="mb-4 text-caption text-slate">
                متن اولیه از قالب استاندارد آرکان ساخته می‌شود و در گام بعد قابل ویرایش/بازنویسی با AI است.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="عنوان قرارداد *">
                  <input name="title" required placeholder="مثلاً قرارداد مشاوره استراتژی رشد" className={inputClass} />
                </Field>
                <Field label="کارفرما (مخاطب) *">
                  <select
                    name="contact_id"
                    required
                    value={selectedContact}
                    onChange={(e) => setSelectedContact(e.target.value)}
                    className={inputClass}
                  >
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
                <Field label="معامله‌ی مرتبط (اختیاری — مبلغ از آن پیش‌فرض می‌شود)">
                  <select name="deal_id" className={inputClass} defaultValue="" disabled={!selectedContact}>
                    <option value="">— بدون معامله —</option>
                    {contactDeals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="مبلغ (تومان)">
                  <input name="amount_toman" type="number" min={0} dir="ltr" className={inputClass} />
                </Field>
                <Field label="تاریخ شروع">
                  <input name="start_date" type="date" dir="ltr" className={inputClass} />
                </Field>
                <Field label="مدت قرارداد">
                  <input name="duration_label" placeholder="مثلاً ۳ ماه" className={inputClass} />
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
                  ساخت قرارداد و رفتن به ویرایشگر
                </button>
              </div>
            </form>
          )}

          {contracts.length === 0 ? (
            <EmptyBox message="هنوز قراردادی ساخته نشده است. از دکمه‌ی «+ قرارداد جدید» شروع کنید." />
          ) : (
            <div className="overflow-x-auto rounded-card border border-sand bg-white shadow-soft">
              <table className="w-full text-[0.95rem]">
                <thead>
                  <tr className="border-b border-sand text-right text-caption text-slate">
                    <th className="px-5 py-3 font-medium">شماره</th>
                    <th className="px-5 py-3 font-medium">عنوان</th>
                    <th className="px-5 py-3 font-medium">کارفرما</th>
                    <th className="px-5 py-3 font-medium">مبلغ</th>
                    <th className="px-5 py-3 font-medium">وضعیت</th>
                    <th className="px-5 py-3 font-medium">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => {
                    const meta = CONTRACT_STATUS_META[c.status];
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-sand/60 transition-colors last:border-0 hover:bg-bone/60"
                      >
                        <td dir="ltr" className="px-5 py-3.5 text-right text-caption text-slate">
                          {c.contract_no}
                        </td>
                        <td className="px-5 py-3.5">
                          <a
                            href={`/admin/crm/contracts/${c.id}`}
                            className="font-medium text-pine underline-offset-4 hover:underline"
                          >
                            {c.title}
                          </a>
                        </td>
                        <td className="px-5 py-3.5 text-ink">
                          {c.contact?.full_name ?? "—"}
                          {c.company?.name && (
                            <span className="mr-1.5 text-caption text-slate">· {c.company.name}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-ink">
                          {c.amount_toman > 0 ? formatToman(c.amount_toman) : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                          {c.status === "accepted" && c.accepted_by_name && (
                            <span className="mr-1.5 text-[0.75rem] text-slate">
                              توسط {c.accepted_by_name}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-caption text-slate">
                          {formatDate(c.created_at, false)}
                        </td>
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
