import { faNum, formatToman, toFa } from "@/lib/utils";
import type { CrmReport } from "@/lib/crm/reports";

/** گزارش‌های CRM — رندر سروری با همان الگوی div-bar داشبورد. */

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-sand bg-white p-5 shadow-soft">
      <p className="text-caption text-slate">{label}</p>
      <p className="nums mt-1 font-heading text-[1.35rem] font-bold leading-tight text-pine">
        {value}
      </p>
      {hint && <p className="mt-1 text-[0.75rem] text-slate">{hint}</p>}
    </div>
  );
}

function Bar({ pct, className = "bg-pine" }: { pct: number; className?: string }) {
  return (
    <div className="h-3 flex-1 overflow-hidden rounded-full bg-sand">
      <div
        className={`h-full rounded-full ${className}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

export default function CrmReports({ report, error }: { report: CrmReport | null; error: string | null }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">گزارش‌های CRM</h1>
        <p className="mt-1 text-caption text-slate">
          قیف تبدیل، ارزش پایپ‌لاین، منابع لید و درآمد.
        </p>
      </div>

      {error || !report ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
          {error ?? "داده‌ای در دسترس نیست."}
        </div>
      ) : (
        <>
          {/* کارت‌های آمار */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="ارزش کل پایپ‌لاین"
              value={formatToman(report.totals.pipelineValue)}
              hint={`${faNum(report.totals.openDeals)} معامله‌ی باز`}
            />
            <Stat
              label="درآمد ۳۰ روز اخیر"
              value={formatToman(report.totals.monthRevenue)}
              hint="معاملات برد‌ه‌شده"
            />
            <Stat
              label="نرخ برد"
              value={`${toFa(report.totals.winRate)}٪`}
              hint="از معاملات بسته‌شده"
            />
            <Stat
              label="میانگین اندازه‌ی معامله"
              value={formatToman(report.totals.avgDealSize)}
              hint={`${faNum(report.totals.wonDeals)} برد`}
            />
          </div>

          {/* قیف تبدیل */}
          <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
            <h2 className="mb-4 font-heading text-body font-semibold text-pine">قیف تبدیل</h2>
            <div className="space-y-3">
              {report.funnel.map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-[0.9rem] text-ink">{step.label}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-sand">
                    <div
                      className={`flex h-full items-center rounded-full px-3 ${
                        i === report.funnel.length - 1 ? "bg-brass" : "bg-pine"
                      }`}
                      style={{ width: `${Math.max(step.pct, 4)}%` }}
                    >
                      <span className="whitespace-nowrap text-[0.72rem] font-medium text-bone">
                        {faNum(step.count)}
                      </span>
                    </div>
                  </div>
                  <span className="nums w-12 shrink-0 text-left text-caption text-slate">
                    {toFa(step.pct)}٪
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ارزش پایپ‌لاین به تفکیک مرحله */}
          <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
            <h2 className="mb-4 font-heading text-body font-semibold text-pine">
              ارزش پایپ‌لاین به تفکیک مرحله
            </h2>
            {report.pipelineByStage.every((s) => s.count === 0) ? (
              <p className="text-caption text-slate">معامله‌ی بازی در پایپ‌لاین نیست.</p>
            ) : (
              <div className="space-y-3">
                {report.pipelineByStage.map((s) => {
                  const max = Math.max(...report.pipelineByStage.map((x) => x.value), 1);
                  return (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-[0.9rem] text-ink">{s.label}</span>
                      <Bar pct={Math.round((s.value / max) * 100)} />
                      <span className="nums w-40 shrink-0 text-left text-caption text-slate">
                        {faNum(s.count)} · {formatToman(s.value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* منابع لید */}
          <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
            <h2 className="mb-4 font-heading text-body font-semibold text-pine">منابع لید</h2>
            {report.leadSources.length === 0 ? (
              <p className="text-caption text-slate">هنوز لیدی ثبت نشده است.</p>
            ) : (
              <div className="space-y-3">
                {report.leadSources.map((s) => {
                  const max = Math.max(...report.leadSources.map((x) => x.total), 1);
                  return (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[0.9rem] text-ink">{s.label}</span>
                      <Bar pct={Math.round((s.total / max) * 100)} />
                      <span className="nums w-40 shrink-0 text-left text-caption text-slate">
                        {faNum(s.total)} لید · {faNum(s.converted)} تبدیل
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* درآمد ماهانه */}
          <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
            <h2 className="mb-4 font-heading text-body font-semibold text-pine">
              درآمد ماهانه (۱۲ ماه اخیر)
            </h2>
            {report.monthlyRevenue.every((m) => m.value === 0) ? (
              <p className="text-caption text-slate">هنوز معامله‌ی برد‌ه‌شده‌ای با مبلغ ثبت نشده است.</p>
            ) : (
              <div className="space-y-2.5">
                {report.monthlyRevenue.map((m) => {
                  const max = Math.max(...report.monthlyRevenue.map((x) => x.value), 1);
                  return (
                    <div key={m.label} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[0.85rem] text-ink">{m.label}</span>
                      <Bar
                        pct={Math.round((m.value / max) * 100)}
                        className={m.value > 0 ? "bg-brass" : "bg-sand"}
                      />
                      <span className="nums w-36 shrink-0 text-left text-caption text-slate">
                        {m.value > 0 ? formatToman(m.value) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
