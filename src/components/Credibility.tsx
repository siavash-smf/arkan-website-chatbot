import Image from "next/image";
import Section, { SectionHeading } from "./ui/Section";
import Reveal from "./ui/Reveal";
import { IconQuote } from "./ui/icons";

const STATS = [
  { value: "۷+", label: "سال فعالیت" },
  { value: "۲۰۰+", label: "پروژه‌ی موفق" },
  { value: "۱۲", label: "مشاور باتجربه" },
];

const QUOTES = [
  {
    text: "آرکان فقط یک گزارش به ما نداد؛ شش ماه کنار ما ماند تا برنامه واقعاً اجرا شد.",
    author: "مدیرعامل یک شرکت تولیدی",
  },
  {
    text: "بعد از سه سال درجازدن، اولین بار حس کردیم می‌دانیم باید کجا تمرکز کنیم.",
    author: "بنیان‌گذار یک استارتاپ خدماتی",
  },
];

export default function Credibility() {
  return (
    <Section id="about" surface="bone">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* تصویر تیم */}
        <Reveal className="order-1">
          <div className="overflow-hidden rounded-card shadow-soft-md">
            <Image
              src="/images/team.jpg"
              alt="تیم مشاوران آرکان در حال بررسی استراتژی یک کسب‌وکار دور میز جلسه"
              width={1200}
              height={896}
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-full w-full object-cover"
            />
          </div>
        </Reveal>

        {/* متن + آمار */}
        <div className="order-2">
          <SectionHeading
            eyebrow="درباره‌ی آرکان"
            title="یک تکیه‌گاه باتجربه، نه یک مشاورِ گذری"
            description="از سال ۱۳۹۶ کنار کسب‌وکارهای کوچک و متوسط بوده‌ایم. تجربه‌مان را در کنار صداقت می‌گذاریم؛ حتی وقتی حقیقت به سود بستن قرارداد نباشد."
          />

          <dl className="mt-10 grid grid-cols-3 gap-4">
            {STATS.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 80}>
                <div className="rounded-card border border-sand bg-white px-3 py-5 text-center shadow-soft">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="nums block font-heading text-[1.75rem] font-bold leading-none text-pine">
                      {stat.value}
                    </span>
                    <span className="mt-2 block text-caption text-slate">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>

      {/* نقل‌قول‌ها */}
      <div className="mt-16 grid gap-5 md:grid-cols-2">
        {QUOTES.map((quote, i) => (
          <Reveal key={quote.author} delay={i * 90}>
            <figure className="flex h-full flex-col rounded-card border border-sand bg-white p-7 shadow-soft">
              <IconQuote width={32} height={32} className="text-brass/70" />
              <blockquote className="mt-4 flex-1 text-body leading-8 text-ink">
                «{quote.text}»
              </blockquote>
              <figcaption className="mt-5 text-caption font-medium text-slate">
                — {quote.author}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
