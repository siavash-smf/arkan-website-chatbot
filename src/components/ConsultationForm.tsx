"use client";

import { useRef, useState } from "react";
import Section from "./ui/Section";
import Reveal from "./ui/Reveal";
import { IconCheck } from "./ui/icons";
import { submitLead } from "@/app/actions";
import {
  leadSchema,
  STAGE_OPTIONS,
  TIME_OPTIONS,
  type LeadInput,
  type LeadFieldErrors,
} from "@/lib/validation";

const EMPTY: LeadInput = {
  full_name: "",
  phone: "",
  email: "",
  business_name: "",
  industry: "",
  stage: "" as LeadInput["stage"],
  challenge: "",
  preferred_time: "",
};

const FIELD_ORDER: (keyof LeadInput)[] = [
  "full_name",
  "phone",
  "email",
  "business_name",
  "industry",
  "stage",
  "challenge",
  "preferred_time",
];

type Status = "idle" | "submitting" | "success" | "error";

export default function ConsultationForm() {
  const [values, setValues] = useState<LeadInput>(EMPTY);
  const [errors, setErrors] = useState<LeadFieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  function update<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  // اعتبارسنجی یک فیلد روی blur
  function validateField(key: keyof LeadInput) {
    const result = leadSchema.safeParse(values);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === key);
      if (issue) setErrors((e) => ({ ...e, [key]: issue.message }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    // اعتبارسنجی کامل سمت کلاینت
    const result = leadSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: LeadFieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof LeadInput;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      // فوکوس به اولین فیلد نامعتبر
      const firstInvalid = FIELD_ORDER.find((k) => fieldErrors[k]);
      if (firstInvalid) {
        formRef.current
          ?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
          ?.focus();
      }
      return;
    }

    setStatus("submitting");
    try {
      const res = await submitLead(result.data);
      if (res.ok) {
        setStatus("success");
        setValues(EMPTY);
        setErrors({});
        // فوکوس به پیام موفقیت برای screen reader
        requestAnimationFrame(() => successRef.current?.focus());
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        setFormError(
          res.formError ?? "لطفاً خطاهای فرم را برطرف کنید و دوباره تلاش کنید."
        );
        setStatus("error");
      }
    } catch {
      setFormError("ارتباط برقرار نشد. لطفاً اتصال خود را بررسی و دوباره تلاش کنید.");
      setStatus("error");
    }
  }

  return (
    <Section id="consultation" surface="bone" className="scroll-mt-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        {/* ستون توضیح (راست در RTL) */}
        <div>
          <Reveal>
            <p className="mb-3 inline-flex items-center gap-2 text-caption font-medium text-brass">
              <span className="h-px w-6 bg-brass" aria-hidden="true" />
              درخواست مشاوره
            </p>
            <h2 className="text-[1.75rem] font-bold leading-tight sm:text-h2">
              اولین قدم برای رشد پایدار را همین‌جا بردارید
            </h2>
            <p className="mt-4 text-body text-slate">
              فرم را پر کنید؛ تیم آرکان ظرف ۲۴ ساعت کاری با شما تماس می‌گیرد. تماس
              اولیه رایگان است و هیچ تعهدی ایجاد نمی‌کند.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <ul className="mt-8 space-y-4">
              {[
                "پاسخ ظرف ۲۴ ساعت کاری",
                "تماس اولیه‌ی کاملاً رایگان",
                "بدون وعده‌ی تضمینی؛ فقط مسیر روشن",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[0.95rem] text-ink/85">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine text-bone">
                    <IconCheck width={15} height={15} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* فرم (چپ در RTL) */}
        <Reveal delay={80}>
          <div className="rounded-card border border-sand bg-white p-6 shadow-soft-md sm:p-8">
            {status === "success" ? (
              <div
                ref={successRef}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                className="flex flex-col items-center py-10 text-center outline-none"
              >
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-pine text-bone">
                  <IconCheck width={32} height={32} />
                </span>
                <h3 className="mt-6 font-heading text-h3 font-semibold text-pine">
                  درخواست شما ثبت شد
                </h3>
                <p className="mt-3 max-w-sm text-body text-slate">
                  درخواست شما ثبت شد. تیم آرکان ظرف ۲۴ ساعت کاری با شما تماس می‌گیرد.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus("idle")}
                  className="mt-6 text-[0.95rem] text-brass underline-offset-4 hover:underline"
                >
                  ثبت درخواست دیگر
                </button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} noValidate>
                {/* خطای کلی فرم */}
                {formError && (
                  <div
                    role="alert"
                    className="mb-5 rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-caption text-red-700"
                  >
                    {formError}
                  </div>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    name="full_name"
                    label="نام و نام خانوادگی"
                    required
                    value={values.full_name}
                    error={errors.full_name}
                    onChange={(v) => update("full_name", v)}
                    onBlur={() => validateField("full_name")}
                    autoComplete="name"
                  />
                  <Field
                    name="phone"
                    label="شماره‌ی تماس"
                    required
                    type="tel"
                    dir="ltr"
                    inputMode="tel"
                    value={values.phone}
                    error={errors.phone}
                    onChange={(v) => update("phone", v)}
                    onBlur={() => validateField("phone")}
                    autoComplete="tel"
                  />
                  <Field
                    name="email"
                    label="ایمیل"
                    type="email"
                    dir="ltr"
                    inputMode="email"
                    value={values.email ?? ""}
                    error={errors.email}
                    onChange={(v) => update("email", v)}
                    onBlur={() => validateField("email")}
                    autoComplete="email"
                  />
                  <Field
                    name="business_name"
                    label="نام کسب‌وکار"
                    required
                    value={values.business_name}
                    error={errors.business_name}
                    onChange={(v) => update("business_name", v)}
                    onBlur={() => validateField("business_name")}
                    autoComplete="organization"
                  />
                  <Field
                    name="industry"
                    label="حوزه‌ی فعالیت"
                    value={values.industry ?? ""}
                    error={errors.industry}
                    onChange={(v) => update("industry", v)}
                  />
                  <SelectField
                    name="stage"
                    label="مرحله‌ی کسب‌وکار"
                    required
                    placeholder="انتخاب کنید"
                    options={STAGE_OPTIONS}
                    value={values.stage}
                    error={errors.stage}
                    onChange={(v) => update("stage", v as LeadInput["stage"])}
                    onBlur={() => validateField("stage")}
                  />
                </div>

                <div className="mt-5">
                  <TextareaField
                    name="challenge"
                    label="بزرگ‌ترین چالش فعلی شما چیست؟"
                    required
                    value={values.challenge}
                    error={errors.challenge}
                    onChange={(v) => update("challenge", v)}
                    onBlur={() => validateField("challenge")}
                  />
                </div>

                <div className="mt-5 sm:max-w-[50%] sm:pl-2.5">
                  <SelectField
                    name="preferred_time"
                    label="زمان مناسب برای تماس"
                    placeholder="فرقی نمی‌کند"
                    options={TIME_OPTIONS}
                    value={values.preferred_time ?? ""}
                    error={errors.preferred_time}
                    onChange={(v) => update("preferred_time", v as LeadInput["preferred_time"])}
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="mt-7 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-btn border-b-2 border-transparent bg-pine px-7 py-3.5 text-body font-medium text-bone transition-colors duration-200 hover:border-brass hover:bg-pine-dark focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {status === "submitting" ? (
                    <>
                      <span
                        className="h-5 w-5 animate-spin rounded-full border-2 border-bone/40 border-t-bone"
                        aria-hidden="true"
                      />
                      در حال ثبت…
                    </>
                  ) : (
                    "ثبت درخواست مشاوره"
                  )}
                </button>

                <p className="mt-4 text-center text-caption text-slate">
                  با ثبت این فرم، هیچ هزینه یا تعهدی برای شما ایجاد نمی‌شود.
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ── زیرکامپوننت‌های فیلد ── */

const labelCls = "mb-1.5 block text-caption font-medium text-ink";
const fieldBase =
  "w-full min-h-[44px] rounded-btn border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink transition-colors placeholder:text-slate/60 focus:outline-none";
const errorCls = "mt-1.5 text-caption text-red-600";

function borderClasses(hasError?: boolean) {
  return hasError
    ? "border-red-400 focus:border-red-500"
    : "border-slate/30 focus:border-brass";
}

function RequiredMark() {
  return (
    <span className="text-brass" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

type BaseFieldProps = {
  name: string;
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  onChange: (v: string) => void;
  onBlur?: () => void;
};

function Field({
  name,
  label,
  value,
  error,
  required,
  onChange,
  onBlur,
  type = "text",
  dir,
  inputMode,
  autoComplete,
}: BaseFieldProps & {
  type?: string;
  dir?: "ltr" | "rtl";
  inputMode?: "tel" | "email" | "text";
  autoComplete?: string;
}) {
  const errId = error ? `${name}-error` : undefined;
  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}
        {required && <RequiredMark />}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        dir={dir}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={errId}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${fieldBase} ${borderClasses(!!error)}`}
      />
      {error && (
        <p id={errId} className={errorCls} aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectField({
  name,
  label,
  value,
  error,
  required,
  placeholder,
  options,
  onChange,
  onBlur,
}: BaseFieldProps & { placeholder: string; options: readonly string[] }) {
  const errId = error ? `${name}-error` : undefined;
  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}
        {required && <RequiredMark />}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={errId}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${fieldBase} cursor-pointer appearance-none bg-[length:1rem] bg-[left_0.75rem_center] bg-no-repeat ${borderClasses(!!error)} ${
          value ? "text-ink" : "text-slate/60"
        }`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235A5F5B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="text-ink">
            {opt}
          </option>
        ))}
      </select>
      {error && (
        <p id={errId} className={errorCls} aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

function TextareaField({
  name,
  label,
  value,
  error,
  required,
  onChange,
  onBlur,
}: BaseFieldProps) {
  const errId = error ? `${name}-error` : undefined;
  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}
        {required && <RequiredMark />}
      </label>
      <textarea
        id={name}
        name={name}
        value={value}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={errId}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${fieldBase} resize-y leading-7 ${borderClasses(!!error)}`}
        placeholder="مثلاً: فروش‌مان دو سال است متوقف شده و نمی‌دانیم مشکل از مدل کسب‌وکار است یا اجرا."
      />
      {error && (
        <p id={errId} className={errorCls} aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
