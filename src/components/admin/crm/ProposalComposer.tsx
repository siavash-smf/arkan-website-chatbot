"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProposal, sendProposal, type ProposalInput } from "@/app/admin/proposal-actions";
import DocViewer, { type DocViewerHandle } from "@/components/documents/DocViewer";
import ProposalSheets from "@/components/documents/ProposalSheets";
import { blobToBase64, downloadBlob, renderSheetsToPdf } from "@/lib/documents/pdf";
import { formatToman, toFa } from "@/lib/utils";
import { DEFAULT_TEMPLATE_KEY, PROPOSAL_TEMPLATES } from "@/lib/crm/proposals/templates";
import {
  sendRevision,
  type ProposalData,
  type ProposalOption,
  type ProposalPhase,
  type ProposalRecord,
} from "@/lib/crm/proposals/types";
import { Field, Spinner, inputClass, outlineBtnClass, primaryBtnClass } from "./ui";

export type ContactOption = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: { name: string } | null;
};
export type DealOption = { id: string; title: string; contact_id: string; amount_toman: number };

/** فیلدهای فهرستی در فرم به‌صورت «هر خط یک مورد» ویرایش می‌شوند. */
type FormState = {
  contact_id: string;
  deal_id: string;
  client_name: string;
  client_email: string;
  client_company: string;
  client_phone: string;
  title: string;
  intro: string;
  understanding: string;
  goals: string;
  phases: ProposalPhase[];
  deliverables: string;
  methodology: string;
  timeline_note: string;
  exclusions: string;
  assumptions: string;
  why_us: string;
  next_steps: string;
  terms_note: string;
  options: ProposalOption[];
  valid_until: string;
};

type Phase = "idle" | "saving" | "rendering" | "sending";

const toLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const fromLines = (items: string[]) => items.join("\n");

function fromTemplate(key: string): Omit<FormState, "contact_id" | "deal_id" | "client_name" | "client_email" | "client_company" | "client_phone"> {
  const t = PROPOSAL_TEMPLATES.find((x) => x.key === key) ?? PROPOSAL_TEMPLATES[0];
  return {
    title: t.title,
    intro: t.intro,
    understanding: fromLines(t.understanding),
    goals: fromLines(t.goals),
    phases: t.phases.map((p) => ({ ...p })),
    deliverables: fromLines(t.deliverables),
    methodology: t.methodology,
    timeline_note: t.timelineNote,
    exclusions: fromLines(t.exclusions),
    assumptions: fromLines(t.assumptions),
    why_us: fromLines(t.whyUs),
    next_steps: fromLines(t.nextSteps),
    terms_note: t.termsNote,
    options: t.options.map((o) => ({ ...o, features: [...o.features] })),
    valid_until: "",
  };
}

function fromRecord(r: ProposalRecord): FormState {
  return {
    contact_id: r.contact_id ?? "",
    deal_id: r.deal_id ?? "",
    client_name: r.client_name,
    client_email: r.client_email,
    client_company: r.client_company ?? "",
    client_phone: r.client_phone ?? "",
    title: r.title,
    intro: r.intro ?? "",
    understanding: fromLines(r.understanding),
    goals: fromLines(r.goals),
    phases: r.phases.map((p) => ({ ...p })),
    deliverables: fromLines(r.deliverables),
    methodology: r.methodology ?? "",
    timeline_note: r.timeline_note ?? "",
    exclusions: fromLines(r.exclusions),
    assumptions: fromLines(r.assumptions),
    why_us: fromLines(r.why_us),
    next_steps: fromLines(r.next_steps),
    terms_note: r.terms_note ?? "",
    options: r.options.map((o) => ({ ...o, features: [...o.features] })),
    valid_until: r.valid_until ?? "",
  };
}

function toInput(f: FormState): ProposalInput {
  const orNull = (v: string) => v.trim() || null;
  return {
    contact_id: f.contact_id || null,
    deal_id: f.deal_id || null,
    client_name: f.client_name,
    client_email: f.client_email,
    client_company: orNull(f.client_company),
    client_phone: orNull(f.client_phone),
    title: f.title,
    intro: orNull(f.intro),
    understanding: toLines(f.understanding),
    goals: toLines(f.goals),
    phases: f.phases
      .filter((p) => p.title.trim() || p.detail?.trim())
      .map((p) => ({ title: p.title, detail: p.detail?.trim() || null, duration: p.duration?.trim() || null })),
    deliverables: toLines(f.deliverables),
    methodology: orNull(f.methodology),
    timeline_note: orNull(f.timeline_note),
    exclusions: toLines(f.exclusions),
    assumptions: toLines(f.assumptions),
    why_us: toLines(f.why_us),
    next_steps: toLines(f.next_steps),
    terms_note: orNull(f.terms_note),
    options: f.options
      .filter((o) => o.name.trim() || o.price > 0)
      .map((o) => ({
        ...o,
        features: toLines(o.features.join("\n")),
        tagline: o.tagline?.trim() || null,
        paymentNote: o.paymentNote?.trim() || null,
        durationNote: o.durationNote?.trim() || null,
      })),
    valid_until: f.valid_until || null,
  };
}

const todayISO = () => new Date().toISOString();

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-sand bg-white p-5 shadow-soft">
      <div>
        <h2 className="font-heading text-body font-semibold text-pine">{title}</h2>
        {hint && <p className="mt-0.5 text-caption text-slate">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[0.75rem] text-slate">{children}</p>;
}

/**
 * فرم پروپوزال + پیش‌نمایش زنده‌ی A4.
 * هر تغییر فرم بلافاصله در پیش‌نمایش دیده می‌شود و PDF دقیقاً از همان صفحه‌ها ساخته می‌شود.
 */
export default function ProposalComposer({
  record: initialRecord,
  contacts,
  deals,
  locked,
}: {
  record: ProposalRecord | null;
  contacts: ContactOption[];
  deals: DealOption[];
  /** تبدیل‌شده یا نقش فقط‌خواندنی */
  locked: boolean;
}) {
  const router = useRouter();
  const [record, setRecord] = useState<ProposalRecord | null>(initialRecord);
  const [form, setForm] = useState<FormState>(() =>
    initialRecord
      ? fromRecord(initialRecord)
      : {
          contact_id: "",
          deal_id: "",
          client_name: "",
          client_email: "",
          client_company: "",
          client_phone: "",
          ...fromTemplate(DEFAULT_TEMPLATE_KEY),
        }
  );
  const [emailNote, setEmailNote] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  // نسخه‌ای که در حال ارسال است؛ تا پایان ارسال روی PDF چاپ می‌شود
  const [sendingRevision, setSendingRevision] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const recordRef = useRef<ProposalRecord | null>(record);
  const sheetsRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<DocViewerHandle | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setOption = (i: number, patch: Partial<ProposalOption>) =>
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) }));
  const setPhaseRow = (i: number, patch: Partial<ProposalPhase>) =>
    setForm((f) => ({ ...f, phases: f.phases.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));

  const contactDeals = deals.filter((d) => d.contact_id === form.contact_id);

  function pickContact(id: string) {
    const c = contacts.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      contact_id: id,
      deal_id: "",
      ...(c
        ? {
            client_name: c.full_name,
            client_email: c.email ?? "",
            client_phone: c.phone ?? "",
            client_company: c.company?.name ?? "",
          }
        : {}),
    }));
  }

  function applyTemplate(key: string) {
    if (record && !confirm("متن فعلی با قالب جایگزین شود؟ مشخصات کلاینت حفظ می‌شود.")) return;
    setForm((f) => ({ ...f, ...fromTemplate(key) }));
  }

  // داده‌ی سند برای پیش‌نمایش و PDF — همیشه از روی فرم فعلی
  const previewData: ProposalData = useMemo(() => {
    const input = toInput(form);
    return {
      proposalNo: record?.proposal_no ?? "AP-پیش‌نویس",
      issuedAt: sendingRevision !== null ? todayISO() : (record?.sent_at ?? record?.created_at ?? todayISO()),
      revision: sendingRevision ?? record?.revision ?? 1,
      clientName: form.client_name || "نام کلاینت",
      clientEmail: form.client_email || "client@example.com",
      clientCompany: input.client_company,
      clientPhone: input.client_phone,
      title: form.title || "عنوان پیشنهاد را وارد کنید",
      intro: input.intro,
      understanding: input.understanding,
      goals: input.goals,
      phases: input.phases.map((p) => ({ ...p, title: p.title || "…" })),
      deliverables: input.deliverables,
      methodology: input.methodology,
      timelineNote: input.timeline_note,
      exclusions: input.exclusions,
      assumptions: input.assumptions,
      whyUs: input.why_us,
      nextSteps: input.next_steps,
      termsNote: input.terms_note,
      options: input.options,
      validUntil: input.valid_until || null,
    };
    // sendingRevision و record عمداً در وابستگی‌ها هستند: تغییرشان سند را دوباره می‌چیند
  }, [form, record, sendingRevision]);

  const makePdf = useCallback(async () => {
    const root = sheetsRef.current;
    if (!root) throw new Error("پیش‌نمایش آماده نیست.");
    const capture = () =>
      renderSheetsToPdf(root, { title: `پیشنهاد ${previewData.proposalNo}`, subject: previewData.title });
    // پیش‌نمایش ممکن است کوچک‌نمایی شده باشد؛ PDF همیشه در اندازه‌ی ۱:۱ گرفته می‌شود
    return viewerRef.current ? viewerRef.current.atFullScale(capture) : capture();
  }, [previewData.proposalNo, previewData.title]);

  async function save() {
    setMessage(null);
    setPhase("saving");
    const res = await saveProposal(record?.id ?? null, toInput(form));
    setPhase("idle");
    if (!res.ok || !res.record) {
      setMessage({ ok: false, text: res.error ?? "ذخیره ناموفق بود." });
      return;
    }
    if (!record) {
      router.push(`/admin/crm/proposals/${res.record.id}`);
      router.refresh();
      return;
    }
    setRecord(res.record);
    setMessage({ ok: true, text: "ذخیره شد." });
    router.refresh();
  }

  async function download() {
    setDownloading(true);
    setMessage(null);
    try {
      const blob = await makePdf();
      downloadBlob(blob, `${previewData.proposalNo}.pdf`);
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message || "ساخت PDF ناموفق بود." });
    } finally {
      setDownloading(false);
    }
  }

  // ── ارسال: ذخیره ← چیدن دوباره با شماره و نسخه‌ی واقعی ← PDF ← ایمیل ──
  async function startSend() {
    if (!confirm(`پروپوزال برای ${form.client_email || "کلاینت"} ایمیل شود؟`)) return;
    setMessage(null);
    setPhase("saving");
    const res = await saveProposal(record?.id ?? null, toInput(form));
    if (!res.ok || !res.record) {
      setPhase("idle");
      setMessage({ ok: false, text: res.error ?? "ذخیره ناموفق بود." });
      return;
    }
    // از اینجا ProposalSheets با شماره‌ی واقعی دوباره چیده می‌شود و onReady ادامه می‌دهد
    recordRef.current = res.record;
    setRecord(res.record);
    setSendingRevision(sendRevision(res.record));
    setPhase("rendering");
  }

  const finishSend = useCallback(async () => {
    const saved = recordRef.current;
    if (!saved) return;
    setPhase("sending");
    try {
      const blob = await makePdf();
      const res = await sendProposal(saved.id, await blobToBase64(blob), emailNote);
      if (!res.ok) throw new Error(res.error ?? "ارسال ناموفق بود.");
      setEmailNote("");
      setRecord({ ...saved, status: "sent", sent_at: new Date().toISOString(), revision: sendRevision(saved) });
      setMessage({ ok: true, text: `پروپوزال ${saved.proposal_no} برای ${saved.client_email} ارسال شد.` });
      if (!initialRecord) router.push(`/admin/crm/proposals/${saved.id}`);
      router.refresh();
    } catch (e) {
      // پروپوزال ذخیره شده؛ همین‌جا می‌مانیم تا بشود دوباره تلاش کرد
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setSendingRevision(null);
      setPhase("idle");
    }
  }, [makePdf, emailNote, initialRecord, router]);

  const finishSendRef = useRef(finishSend);
  useEffect(() => {
    finishSendRef.current = finishSend;
  }, [finishSend]);

  const handleSheetsReady = useCallback(() => {
    if (phaseRef.current === "rendering") void finishSendRef.current();
  }, []);

  const busy = phase !== "idle";
  const priceSummary =
    form.options.length > 1
      ? `${toFa(form.options.length)} بسته — از ${formatToman(Math.min(...form.options.map((o) => o.price || 0)))}`
      : formatToman(form.options[0]?.price ?? 0);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* ── فرم ── */}
      <div className="min-w-0 space-y-5">
        <fieldset disabled={locked || busy} className="min-w-0 space-y-5">
          {!locked && (
            <Section title="شروع از قالب" hint="یکی از خدمات آرکان را انتخاب کنید؛ همه‌ی متن‌ها را بعد برای همین کلاینت شخصی کنید.">
              <div className="flex flex-wrap gap-2">
                {PROPOSAL_TEMPLATES.map((t) => (
                  <button key={t.key} type="button" onClick={() => applyTemplate(t.key)} className={outlineBtnClass}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="مشخصات کلاینت" hint="دستی وارد کنید، یا از مخاطبان CRM انتخاب کنید تا خودکار پر شود.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="انتخاب از مخاطبان CRM (اختیاری)">
                <select value={form.contact_id} onChange={(e) => pickContact(e.target.value)} className={inputClass}>
                  <option value="">— ورود دستی —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                      {c.company ? ` — ${c.company.name}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="معامله‌ی مرتبط (اختیاری)">
                <select
                  value={form.deal_id}
                  onChange={(e) => set("deal_id", e.target.value)}
                  disabled={!form.contact_id}
                  className={inputClass}
                >
                  <option value="">— بدون معامله —</option>
                  {contactDeals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({formatToman(d.amount_toman)})
                    </option>
                  ))}
                </select>
                <Hint>با ارسال پروپوزال، معامله به مرحله‌ی «ارسال پروپوزال» می‌رود.</Hint>
              </Field>
              <Field label="نام کلاینت *">
                <input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="مثلاً نسترن قاسمی" className={inputClass} />
              </Field>
              <Field label="ایمیل *">
                <input
                  type="email"
                  dir="ltr"
                  value={form.client_email}
                  onChange={(e) => set("client_email", e.target.value)}
                  placeholder="client@example.com"
                  className={inputClass}
                />
              </Field>
              <Field label="شرکت یا برند">
                <input value={form.client_company} onChange={(e) => set("client_company", e.target.value)} className={inputClass} />
              </Field>
              <Field label="تلفن">
                <input dir="ltr" value={form.client_phone} onChange={(e) => set("client_phone", e.target.value)} className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section title="عنوان و خلاصه">
            <Field label="عنوان پیشنهاد *">
              <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
            </Field>
            <Field label="خلاصه‌ی پیشنهاد">
              <textarea rows={4} value={form.intro} onChange={(e) => set("intro", e.target.value)} className={inputClass} />
              <Hint>دو سه جمله؛ اولین چیزی که کلاینت می‌خواند. هر خط یک پاراگراف.</Hint>
            </Field>
          </Section>

          <Section title="درک ما از وضعیت و اهداف">
            <Field label="درک ما از وضعیت کلاینت">
              <textarea rows={5} value={form.understanding} onChange={(e) => set("understanding", e.target.value)} className={inputClass} />
              <Hint>هر خط یک بند — نشان می‌دهد حرف کلاینت را شنیده‌اید.</Hint>
            </Field>
            <Field label="اهداف همکاری">
              <textarea rows={3} value={form.goals} onChange={(e) => set("goals", e.target.value)} className={inputClass} />
              <Hint>هر خط یک هدف.</Hint>
            </Field>
          </Section>

          <Section title="مراحل اجرا">
            <div className="space-y-3">
              {form.phases.map((p, i) => (
                <div key={i} className="space-y-2 rounded-btn border border-sand p-3">
                  <div className="flex gap-2">
                    <input
                      value={p.title}
                      onChange={(e) => setPhaseRow(i, { title: e.target.value })}
                      placeholder="عنوان مرحله"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      value={p.duration ?? ""}
                      onChange={(e) => setPhaseRow(i, { duration: e.target.value })}
                      placeholder="مدت"
                      className={`${inputClass} !w-32`}
                    />
                    <button
                      type="button"
                      onClick={() => set("phases", form.phases.filter((_, idx) => idx !== i))}
                      className="shrink-0 px-2 text-caption text-red-600 hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={p.detail ?? ""}
                    onChange={(e) => setPhaseRow(i, { detail: e.target.value })}
                    placeholder="شرح این مرحله"
                    className={inputClass}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("phases", [...form.phases, { title: "", detail: "", duration: "" }])}
                className="text-caption text-pine underline-offset-4 hover:underline"
              >
                + افزودن مرحله
              </button>
            </div>
            <Field label="زمان‌بندی">
              <textarea rows={2} value={form.timeline_note} onChange={(e) => set("timeline_note", e.target.value)} className={inputClass} />
            </Field>
            <Field label="روش کار و همراهی آرکان">
              <textarea rows={4} value={form.methodology} onChange={(e) => set("methodology", e.target.value)} className={inputClass} />
              <Hint>هر خط یک پاراگراف: کدام رکن از چهار رکن، نقش مشاور راهبر، ریتم جلسات.</Hint>
            </Field>
          </Section>

          <Section title="خروجی‌های تحویلی">
            <textarea rows={5} value={form.deliverables} onChange={(e) => set("deliverables", e.target.value)} className={inputClass} />
            <Hint>هر خط یک خروجی — در سند با تیک نمایش داده می‌شود.</Hint>
          </Section>

          <Section title="بسته‌ها و مبلغ" hint="یک تا چهار بسته. با ستاره، بسته‌ی «پیشنهاد ما» را مشخص کنید.">
            <Field label="اعتبار پیشنهاد تا (اختیاری)">
              <input
                type="date"
                dir="ltr"
                value={form.valid_until}
                onChange={(e) => set("valid_until", e.target.value)}
                className={`${inputClass} sm:max-w-xs`}
              />
            </Field>
            <div className="space-y-3">
              {form.options.map((o, i) => (
                <div key={o.id} className={`space-y-2 rounded-btn border p-3 ${o.recommended ? "border-pine/40 bg-pine/[0.03]" : "border-sand"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={o.name}
                      onChange={(e) => setOption(i, { name: e.target.value })}
                      placeholder="نام بسته"
                      className={`${inputClass} !w-48`}
                    />
                    <input
                      type="number"
                      min={0}
                      dir="ltr"
                      value={o.price || ""}
                      onChange={(e) => setOption(i, { price: Number(e.target.value) || 0 })}
                      placeholder="مبلغ (تومان)"
                      className={`${inputClass} !w-40`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          options: f.options.map((x, idx) => ({ ...x, recommended: idx === i ? !x.recommended : false })),
                        }))
                      }
                      className={`rounded-btn border px-3 py-2 text-caption ${o.recommended ? "border-pine bg-pine text-bone" : "border-sand text-slate"}`}
                      title="پیشنهاد ما"
                    >
                      ★ پیشنهاد ما
                    </button>
                    {form.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => set("options", form.options.filter((_, idx) => idx !== i))}
                        className="px-2 text-caption text-red-600 hover:underline"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                  {o.price > 0 && <p className="text-[0.75rem] text-slate">{formatToman(o.price)}</p>}
                  <input
                    value={o.tagline ?? ""}
                    onChange={(e) => setOption(i, { tagline: e.target.value })}
                    placeholder="یک خط توضیح، مثلاً «برای شروع با کم‌ترین ریسک»"
                    className={inputClass}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={o.durationNote ?? ""}
                      onChange={(e) => setOption(i, { durationNote: e.target.value })}
                      placeholder="مدت، مثلاً ۱۲ هفته"
                      className={inputClass}
                    />
                    <input
                      value={o.paymentNote ?? ""}
                      onChange={(e) => setOption(i, { paymentNote: e.target.value })}
                      placeholder="شرایط پرداخت"
                      className={inputClass}
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={fromLines(o.features)}
                    onChange={(e) => setOption(i, { features: e.target.value.split("\n") })}
                    onBlur={(e) => setOption(i, { features: toLines(e.target.value) })}
                    placeholder="هر خط یک ویژگی این بسته"
                    className={inputClass}
                  />
                </div>
              ))}
              {form.options.length < 4 && (
                <button
                  type="button"
                  onClick={() =>
                    set("options", [
                      ...form.options,
                      {
                        id: `opt-${Date.now().toString(36)}`,
                        name: "",
                        tagline: null,
                        price: 0,
                        recommended: false,
                        features: [],
                        paymentNote: null,
                        durationNote: null,
                      },
                    ])
                  }
                  className="text-caption text-pine underline-offset-4 hover:underline"
                >
                  + افزودن بسته
                </button>
              )}
            </div>
          </Section>

          <Section title="مرزهای کار و اعتماد">
            <Field label="آنچه در این پیشنهاد نیست">
              <textarea rows={3} value={form.exclusions} onChange={(e) => set("exclusions", e.target.value)} className={inputClass} />
              <Hint>هر خط یک مورد — در قرارداد هم به ماده‌ی «موارد خارج از دامنه» منتقل می‌شود.</Hint>
            </Field>
            <Field label="پیش‌فرض‌ها">
              <textarea rows={3} value={form.assumptions} onChange={(e) => set("assumptions", e.target.value)} className={inputClass} />
            </Field>
            <Field label="چرا آرکان">
              <textarea rows={4} value={form.why_us} onChange={(e) => set("why_us", e.target.value)} className={inputClass} />
            </Field>
          </Section>

          <Section title="گام‌های بعدی و شرایط">
            <Field label="گام‌های بعدی">
              <textarea rows={4} value={form.next_steps} onChange={(e) => set("next_steps", e.target.value)} className={inputClass} />
            </Field>
            <Field label="شرایط پیشنهاد">
              <textarea rows={3} value={form.terms_note} onChange={(e) => set("terms_note", e.target.value)} className={inputClass} />
              <Hint>هر خط یک بند.</Hint>
            </Field>
            <Field label="یادداشت داخل ایمیل (فقط در متن ایمیل، نه در سند)">
              <textarea rows={2} value={emailNote} onChange={(e) => setEmailNote(e.target.value)} className={inputClass} />
            </Field>
          </Section>
        </fieldset>

        {message && (
          <p
            role="alert"
            className={`rounded-card border px-4 py-3 text-caption ${
              message.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* نوار اقدامات */}
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-card border border-sand bg-white/95 p-3 shadow-soft-md backdrop-blur">
          {!locked && (
            <>
              <button type="button" onClick={startSend} disabled={busy} className={primaryBtnClass}>
                {(phase === "rendering" || phase === "sending") && <Spinner light />}
                {phase === "rendering"
                  ? "در حال ساخت PDF…"
                  : phase === "sending"
                    ? "در حال ارسال…"
                    : record?.sent_at
                      ? "ذخیره و ارسال نسخه‌ی تازه"
                      : "ذخیره و ارسال با ایمیل"}
              </button>
              <button type="button" onClick={save} disabled={busy} className={outlineBtnClass}>
                {phase === "saving" && <Spinner />}
                ذخیره
              </button>
            </>
          )}
          <button type="button" onClick={download} disabled={downloading || busy} className={outlineBtnClass}>
            {downloading && <Spinner />}
            دانلود PDF
          </button>
          <span className="text-caption text-slate">{priceSummary}</span>
        </div>
      </div>

      {/* ── پیش‌نمایش ── */}
      <div className="min-w-0">
        <DocViewer innerRef={sheetsRef} handleRef={viewerRef}>
          <ProposalSheets data={previewData} onReady={handleSheetsReady} />
        </DocViewer>
      </div>
    </div>
  );
}
