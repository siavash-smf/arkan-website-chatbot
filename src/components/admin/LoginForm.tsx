"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { login, createFirstOwner } from "@/app/admin/actions";
import Logo from "@/components/ui/Logo";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-btn border-b-2 border-transparent bg-pine px-7 py-3.5 text-body font-medium text-bone transition-colors hover:border-brass hover:bg-pine-dark disabled:opacity-70"
    >
      {pending ? (
        <>
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-bone/40 border-t-bone"
            aria-hidden="true"
          />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  autoFocus,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-caption font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        dir="ltr"
        placeholder={placeholder}
        className="w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink transition-colors placeholder:text-slate/50 focus:border-brass focus:outline-none"
      />
    </div>
  );
}

/**
 * فرم ورود پنل.
 * bootstrap=true یعنی هنوز هیچ کاربر ادمینی ساخته نشده:
 * ورود با رمز واحد قدیمی + امکان «ایجاد اولین مالک».
 */
export default function LoginForm({ bootstrap }: { bootstrap: boolean }) {
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [loginState, loginAction] = useFormState(login, {});
  const [setupState, setupAction] = useFormState(createFirstOwner, {});

  const showSetup = bootstrap && mode === "setup";

  return (
    <div className="w-full max-w-sm rounded-card border border-sand bg-white p-7 shadow-soft-md sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo />
        <h1 className="mt-5 font-heading text-h3 font-semibold text-pine">
          {showSetup ? "ایجاد اولین مدیر" : "پنل مدیریت"}
        </h1>
        <p className="mt-2 text-caption text-slate">
          {showSetup
            ? "حساب مالک را بسازید تا ورود چندکاربره فعال شود."
            : bootstrap
              ? "با رمز مدیر وارد شوید یا اولین حساب مالک را بسازید."
              : "با ایمیل و رمز عبور خود وارد شوید."}
        </p>
      </div>

      {showSetup ? (
        <form action={setupAction} noValidate>
          <Field id="setup_code" label="کد راه‌اندازی (رمز مدیر فعلی)" type="password" autoFocus />
          <Field id="email" label="ایمیل" type="email" autoComplete="email" placeholder="you@arkan.ir" />
          <Field id="password" label="رمز عبور (حداقل ۸ کاراکتر)" type="password" autoComplete="new-password" />

          {setupState?.error && (
            <p role="alert" className="mt-3 text-caption text-red-600">
              {setupState.error}
            </p>
          )}

          <div className="mt-6">
            <SubmitButton label="ایجاد حساب مالک" pendingLabel="در حال ایجاد…" />
          </div>
        </form>
      ) : (
        <form action={loginAction} noValidate>
          {!bootstrap && (
            <Field id="email" label="ایمیل" type="email" autoComplete="email" autoFocus placeholder="you@arkan.ir" />
          )}
          <Field
            id="password"
            label={bootstrap ? "رمز مدیر" : "رمز عبور"}
            type="password"
            autoComplete="current-password"
            autoFocus={bootstrap}
          />

          {loginState?.error && (
            <p role="alert" className="mt-3 text-caption text-red-600">
              {loginState.error}
            </p>
          )}

          <div className="mt-6">
            <SubmitButton label="ورود به پنل" pendingLabel="در حال ورود…" />
          </div>
        </form>
      )}

      {bootstrap && (
        <button
          type="button"
          onClick={() => setMode(showSetup ? "login" : "setup")}
          className="mt-4 w-full text-center text-caption text-pine underline-offset-4 hover:underline"
        >
          {showSetup ? "بازگشت به ورود با رمز مدیر" : "ایجاد اولین حساب مالک →"}
        </button>
      )}
    </div>
  );
}
