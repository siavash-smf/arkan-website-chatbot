import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import { getReviewData } from "@/lib/rag/analytics";
import { toFa } from "@/lib/utils";

export const metadata: Metadata = { title: "بازخورد", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function fmt(iso: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function FeedbackPage() {
  if (!isAuthed()) redirect("/admin/login");
  const data = await getReviewData();

  return (
    <AdminShell active="feedback">
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">بازخورد و سؤالات بی‌جواب</h1>
          <p className="mt-1 text-caption text-slate">
            جایی برای بهبود چت‌بات: پاسخ‌هایی که کاربر نپسندیده و سؤالاتی که پاسخ‌شان در پایگاه دانش نبود.
          </p>
        </div>

        {!data ? (
          <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">داده‌ای در دسترس نیست.</div>
        ) : (
          <>
            <section>
              <h2 className="mb-3 font-heading text-body font-semibold text-pine">
                بازخوردهای منفی 👎 ({toFa(data.downFeedback.length)})
              </h2>
              {data.downFeedback.length === 0 ? (
                <Empty>هنوز بازخورد منفی‌ای ثبت نشده است.</Empty>
              ) : (
                <div className="space-y-2">
                  {data.downFeedback.map((d, i) => (
                    <div key={i} className="rounded-card border border-sand bg-white p-4 shadow-soft">
                      <p className="text-[0.9rem] leading-7 text-ink">{d.answer}…</p>
                      <p className="mt-1.5 text-[0.75rem] text-slate">{fmt(d.when)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-1 font-heading text-body font-semibold text-pine">
                سؤالات بی‌جواب ({toFa(data.gapQuestions.length)})
              </h2>
              <p className="mb-3 text-caption text-slate">
                این سؤالات منبعی در پایگاه دانش نداشتند — کاندیدای خوبی برای افزودن سند جدید‌اند.
              </p>
              {data.gapQuestions.length === 0 ? (
                <Empty>سؤال بی‌جوابی ثبت نشده است.</Empty>
              ) : (
                <div className="space-y-2">
                  {data.gapQuestions.map((g, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-card border border-sand bg-white p-4 shadow-soft">
                      <p className="text-[0.9rem] text-ink">{g.question}</p>
                      <span className="shrink-0 text-[0.75rem] text-slate">{fmt(g.when)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-sand bg-white px-5 py-10 text-center text-slate">{children}</div>
  );
}
