import Section, { SectionHeading } from "./ui/Section";
import Reveal from "./ui/Reveal";
import {
  IconStrategy,
  IconModel,
  IconBrand,
  IconStructure,
  IconSales,
} from "./ui/icons";

const SERVICES = [
  {
    icon: IconStrategy,
    title: "مشاوره‌ی استراتژی رشد",
    description:
      "جهت‌گیری روشن و تصمیم درباره‌ی این‌که کجا و چگونه بازی کنید تا رشد پایدار بماند.",
  },
  {
    icon: IconModel,
    title: "بازطراحی مدل کسب‌وکار",
    description:
      "وقتی مدل فعلی دیگر جواب نمی‌دهد، آن را بازطراحی می‌کنیم تا با واقعیت بازار بخواند.",
  },
  {
    icon: IconBrand,
    title: "استراتژی برند و بازاریابی",
    description:
      "برند، بازاریابی و پیامی که مشتری درست را جذب کند و ارزش شما را روشن نشان دهد.",
  },
  {
    icon: IconStructure,
    title: "طراحی ساختار و فرایندهای سازمانی",
    description:
      "سازمان، فرایند و تیمی که بتواند استراتژی را بدون آشفتگی اجرا کند.",
  },
  {
    icon: IconSales,
    title: "مشاوره‌ی فروش و توسعه‌ی بازار",
    description:
      "مسیر فروش و ورود به بازارهای تازه را طراحی می‌کنیم تا درآمد دوباره حرکت کند.",
  },
];

export default function Services() {
  return (
    <Section id="services" surface="bone">
      <SectionHeading
        eyebrow="خدمات آرکان"
        title="جایی که گیر کرده‌اید، دقیقاً همان‌جا کنارتان هستیم"
        description="پنج حوزه‌ی تخصصی که بیشترِ کسب‌وکارهای در حال رشد در آن به تکیه‌گاه نیاز دارند."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service, i) => {
          const Icon = service.icon;
          return (
            <Reveal key={service.title} delay={i * 70}>
              <article className="group flex h-full flex-col rounded-card border border-sand bg-white p-7 shadow-soft transition-shadow duration-300 hover:shadow-soft-md">
                <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sand text-pine transition-colors duration-300 group-hover:bg-pine group-hover:text-bone">
                  <Icon width={24} height={24} />
                </span>
                <h3 className="font-heading text-h3 font-semibold text-pine">
                  {service.title}
                </h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-slate">
                  {service.description}
                </p>
              </article>
            </Reveal>
          );
        })}

        {/* کارت دعوت به اقدام — ششمین خانه‌ی گرید */}
        <Reveal delay={SERVICES.length * 70}>
          <a
            href="#consultation"
            className="flex h-full flex-col justify-between rounded-card bg-pine p-7 text-bone shadow-soft transition-colors duration-300 hover:bg-pine-dark"
          >
            <h3 className="font-heading text-h3 font-semibold text-bone">
              مطمئن نیستید کدام خدمت برای شماست؟
            </h3>
            <p className="mt-3 text-[0.95rem] leading-7 text-bone/80">
              در تماس اولیه‌ی رایگان، وضعیت شما را می‌شنویم و قدم بعدی را روشن می‌کنیم.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-brass">
              درخواست مشاوره
              <span aria-hidden="true">←</span>
            </span>
          </a>
        </Reveal>
      </div>
    </Section>
  );
}
