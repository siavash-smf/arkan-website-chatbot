import { faNum, toFa } from "@/lib/utils";
import { channelLabel, type Analytics } from "@/lib/rag/analytics";

function faCost(usd: number): string {
  return "$" + usd.toFixed(usd < 1 ? 4 : 2);
}

export default function Dashboard({
  data,
  error,
  overdueTasks = 0,
}: {
  data: Analytics | null;
  error: string | null;
  overdueTasks?: number;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">داشبورد</h1>
        <p className="mt-1 text-caption text-slate">نمای کلی عملکرد چت‌بات در همه‌ی کانال‌ها.</p>
      </div>

      {error || !data ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
          {error ?? "داده‌ای در دسترس نیست."}
        </div>
      ) : (
        <>
          {/* کارت‌های آمار */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="گفتگوها" value={faNum(data.totals.conversations)} />
            <Stat label="کاربران یکتا" value={faNum(data.totals.users)} />
            <Stat label="پیام‌ها" value={faNum(data.totals.messages)} />
            <Stat label="لیدهای چت‌بات" value={faNum(data.totals.chatbotLeads)} hint={`از ${faNum(data.totals.leads)} کل لید`} />
            <Stat label="نرخ تبدیل به لید" value={`${toFa(data.conversionRate)}٪`} hint="لید چت‌بات ÷ گفتگوها" />
            <Stat label="نرخ رضایت" value={`${toFa(data.satisfactionRate)}٪`} hint={`👍 ${toFa(data.feedback.up)} · 👎 ${toFa(data.feedback.down)}`} />
            <Stat label="هزینه‌ی تخمینی" value={faCost(data.totalCostUsd)} hint={`${faNum(data.totalTokens)} توکن`} />
            <Stat label="پاسخ‌های بدون منبع" value={faNum(data.gaps)} hint="شکاف‌های احتمالی دانش" />
            <a href="/admin/crm/activities" className="block">
              <div
                className={`rounded-card border p-5 shadow-soft transition-colors ${
                  overdueTasks > 0
                    ? "border-red-200 bg-red-50 hover:bg-red-100/70"
                    : "border-sand bg-white hover:bg-bone/60"
                }`}
              >
                <p className={`text-caption ${overdueTasks > 0 ? "text-red-700" : "text-slate"}`}>
                  وظایف معوق CRM
                </p>
                <p
                  className={`nums mt-1 font-heading text-[1.6rem] font-bold leading-tight ${
                    overdueTasks > 0 ? "text-red-700" : "text-pine"
                  }`}
                >
                  {faNum(overdueTasks)}
                </p>
                <p className="mt-1 text-[0.75rem] text-slate">مشاهده‌ی فعالیت‌ها ←</p>
              </div>
            </a>
          </div>

          {/* تفکیک کانال */}
          <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
            <h2 className="mb-4 font-heading text-body font-semibold text-pine">گفتگوها به تفکیک کانال</h2>
            {data.byChannel.length === 0 ? (
              <p className="text-caption text-slate">هنوز گفتگویی ثبت نشده است.</p>
            ) : (
              <div className="space-y-3">
                {data.byChannel.map((c) => {
                  const max = Math.max(...data.byChannel.map((x) => x.conversations), 1);
                  const pct = Math.round((c.conversations / max) * 100);
                  return (
                    <div key={c.channel} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[0.9rem] text-ink">{channelLabel(c.channel)}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-sand">
                        <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="nums w-12 shrink-0 text-left text-caption text-slate">{faNum(c.conversations)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* مصرف توکن و هزینه به تفکیک مدل */}
          <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-body font-semibold text-pine">مصرف توکن و هزینه به‌تفکیک مدل</h2>
              <span className="text-[0.75rem] text-slate">هزینه تخمینی است</span>
            </div>
            {data.models.length === 0 ? (
              <p className="text-caption text-slate">هنوز پاسخی تولید نشده است.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[0.9rem]">
                  <thead>
                    <tr className="border-b border-sand text-right text-caption text-slate">
                      <th className="py-2 font-medium">مدل</th>
                      <th className="py-2 font-medium">پاسخ‌ها</th>
                      <th className="py-2 font-medium">توکن ورودی</th>
                      <th className="py-2 font-medium">توکن خروجی</th>
                      <th className="py-2 font-medium">هزینه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.models.map((m) => (
                      <tr key={m.model} className="border-b border-sand/60">
                        <td dir="ltr" className="py-2.5 text-right text-pine">{m.model}</td>
                        <td className="nums py-2.5">{faNum(m.messages)}</td>
                        <td className="nums py-2.5">{faNum(m.tokensIn)}</td>
                        <td className="nums py-2.5">{faNum(m.tokensOut)}</td>
                        <td className="nums py-2.5 text-brass-dark">{faCost(m.costUsd)}</td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="py-2.5 text-ink">مجموع</td>
                      <td className="nums py-2.5">{faNum(data.models.reduce((s, m) => s + m.messages, 0))}</td>
                      <td className="nums py-2.5">{faNum(data.models.reduce((s, m) => s + m.tokensIn, 0))}</td>
                      <td className="nums py-2.5">{faNum(data.models.reduce((s, m) => s + m.tokensOut, 0))}</td>
                      <td className="nums py-2.5 text-brass-dark">{faCost(data.totalCostUsd)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-sand bg-white p-5 shadow-soft">
      <p className="text-caption text-slate">{label}</p>
      <p className="nums mt-1 font-heading text-[1.6rem] font-bold leading-tight text-pine">{value}</p>
      {hint && <p className="mt-1 text-[0.75rem] text-slate">{hint}</p>}
    </div>
  );
}
