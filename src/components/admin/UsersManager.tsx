"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminUser,
  resetUserPassword,
  toggleUserActive,
  updateUserRole,
} from "@/app/admin/actions";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { AUDIT_ACTION_LABELS } from "@/lib/audit-actions";
import { toFa } from "@/lib/utils";
import {
  EmptyBox,
  ErrorBox,
  Field,
  Spinner,
  formatDate,
  inputClass,
  outlineBtnClass,
  primaryBtnClass,
} from "./crm/ui";

export type AdminUserRow = {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  has_password: boolean;
};

export type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  created_at: string;
};

const ROLE_BADGE: Record<Role, string> = {
  owner: "bg-brass/15 text-brass-dark",
  admin: "bg-pine/10 text-pine",
  editor: "bg-blue-100 text-blue-700",
  operator: "bg-green-100 text-green-700",
  viewer: "bg-slate/15 text-slate",
};

export default function UsersManager({
  users,
  audit,
  error,
  isOwner,
  currentUid,
}: {
  users: AdminUserRow[];
  audit: AuditRow[];
  error: string | null;
  isOwner: boolean;
  currentUid: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitNew(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const res = await createAdminUser(
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
        String(formData.get("role") ?? "viewer") as Role
      );
      if (res.ok) {
        setShowForm(false);
        router.refresh();
      } else {
        setFormError(res.error ?? "ساخت کاربر ناموفق بود.");
      }
    });
  }

  function changeRole(id: string, role: Role) {
    setPendingId(id);
    startTransition(async () => {
      const res = await updateUserRole(id, role);
      setPendingId(null);
      if (res.ok) router.refresh();
      else alert(res.error ?? "تغییر نقش ناموفق بود.");
    });
  }

  function toggleActive(user: AdminUserRow) {
    setPendingId(user.id);
    startTransition(async () => {
      const res = await toggleUserActive(user.id, !user.is_active);
      setPendingId(null);
      if (res.ok) router.refresh();
      else alert(res.error ?? "به‌روزرسانی ناموفق بود.");
    });
  }

  function resetPassword(user: AdminUserRow) {
    const password = prompt(`رمز جدید برای ${user.email} (حداقل ۸ کاراکتر):`);
    if (!password) return;
    setPendingId(user.id);
    startTransition(async () => {
      const res = await resetUserPassword(user.id, password);
      setPendingId(null);
      if (res.ok) alert("رمز با موفقیت تغییر کرد.");
      else alert(res.error ?? "بازنشانی رمز ناموفق بود.");
    });
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">کاربران و لاگ عملیات</h1>
          <p className="mt-1 text-caption text-slate">
            {toFa(users.length)} کاربر ادمین · نقش‌ها: مالک، مدیر، ویرایشگر، اپراتور، بیننده (فقط‌خواندنی)
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className={outlineBtnClass}>
          {showForm ? "بستن فرم" : "+ کاربر جدید"}
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
              <h2 className="mb-4 font-heading text-body font-semibold text-pine">کاربر جدید</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="ایمیل *">
                  <input name="email" type="email" required dir="ltr" className={inputClass} />
                </Field>
                <Field label="رمز عبور (حداقل ۸ کاراکتر) *">
                  <input name="password" type="password" required dir="ltr" className={inputClass} />
                </Field>
                <Field label="نقش">
                  <select name="role" className={inputClass} defaultValue="operator">
                    {ROLES.filter((r) => (isOwner ? true : r !== "owner" && r !== "admin")).map(
                      (r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      )
                    )}
                  </select>
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
                  ساخت کاربر
                </button>
              </div>
            </form>
          )}

          {users.length === 0 ? (
            <EmptyBox message="هنوز کاربری ساخته نشده است. (ورود فعلی با رمز واحد قدیمی است)" />
          ) : (
            <div className="mb-8 overflow-x-auto rounded-card border border-sand bg-white shadow-soft">
              <table className="w-full text-[0.95rem]">
                <thead>
                  <tr className="border-b border-sand text-right text-caption text-slate">
                    <th className="px-5 py-3 font-medium">ایمیل</th>
                    <th className="px-5 py-3 font-medium">نقش</th>
                    <th className="px-5 py-3 font-medium">وضعیت</th>
                    <th className="px-5 py-3 font-medium">آخرین ورود</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-sand/60 last:border-0">
                      <td dir="ltr" className="px-5 py-3.5 text-right text-ink">
                        {u.email}
                        {u.id === currentUid && (
                          <span className="mr-2 text-caption text-slate">(شما)</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {isOwner && u.id !== currentUid ? (
                          <select
                            value={u.role}
                            disabled={pendingId === u.id}
                            onChange={(e) => changeRole(u.id, e.target.value as Role)}
                            className="rounded-btn border border-slate/30 bg-white px-2.5 py-1.5 text-caption text-ink focus:border-brass focus:outline-none"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${ROLE_BADGE[u.role]}`}
                          >
                            {ROLE_LABELS[u.role]}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${
                            u.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {u.is_active ? "فعال" : "غیرفعال"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-caption text-slate">
                        {u.last_login_at ? formatDate(u.last_login_at) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-left">
                        {u.id !== currentUid && (
                          <div className="flex justify-end gap-3">
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => resetPassword(u)}
                                disabled={pendingId === u.id}
                                className="text-caption text-pine underline-offset-4 hover:underline"
                              >
                                رمز جدید
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleActive(u)}
                              disabled={pendingId === u.id}
                              className={`text-caption underline-offset-4 hover:underline ${
                                u.is_active ? "text-red-600" : "text-green-700"
                              }`}
                            >
                              {u.is_active ? "غیرفعال کن" : "فعال کن"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* لاگ عملیات */}
          <section>
            <h2 className="mb-4 font-heading text-body font-semibold text-pine">
              آخرین عملیات ({toFa(audit.length)})
            </h2>
            {audit.length === 0 ? (
              <EmptyBox message="هنوز عملیاتی ثبت نشده است." />
            ) : (
              <div className="overflow-x-auto rounded-card border border-sand bg-white shadow-soft">
                <table className="w-full text-[0.9rem]">
                  <thead>
                    <tr className="border-b border-sand text-right text-caption text-slate">
                      <th className="px-5 py-3 font-medium">زمان</th>
                      <th className="px-5 py-3 font-medium">کاربر</th>
                      <th className="px-5 py-3 font-medium">عملیات</th>
                      <th className="px-5 py-3 font-medium">هدف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((row) => (
                      <tr key={row.id} className="border-b border-sand/60 last:border-0">
                        <td className="px-5 py-2.5 text-caption text-slate">
                          {formatDate(row.created_at)}
                        </td>
                        <td dir="ltr" className="px-5 py-2.5 text-right text-ink">
                          {row.actor_email ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 text-ink">
                          {AUDIT_ACTION_LABELS[row.action as keyof typeof AUDIT_ACTION_LABELS] ??
                            row.action}
                        </td>
                        <td dir="ltr" className="px-5 py-2.5 text-right text-caption text-slate">
                          {row.target ? row.target.slice(0, 13) + "…" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
