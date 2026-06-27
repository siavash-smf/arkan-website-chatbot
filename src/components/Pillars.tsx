import Section, { SectionHeading } from "./ui/Section";
import Reveal from "./ui/Reveal";
import { toFa } from "@/lib/utils";

const PILLARS = [
  {
    no: 1,
    title: "استراتژی",
    description: "جهت‌گیری، مزیت رقابتی و تصمیم درباره‌ی این‌که کجا بازی کنیم.",
    height: "h-16",
  },
  {
    no: 2,
    title: "ساختار",
    description: "سازمان، فرایندها و تیمی که بتواند استراتژی را اجرا کند.",
    height: "h-24",
  },
  {
    no: 3,
    title: "بازار",
    description: "برند، بازاریابی و فروشی که مشتری بیاورد.",
    height: "h-20",
    accent: true,
  },
  {
    no: 4,
    title: "اجرا",
    description: "تبدیل برنامه به نتیجه‌ی قابل‌اندازه‌گیری.",
    height: "h-12",
  },
];

export default function Pillars() {
  return (
    <Section id="pillars" surface="pine">
      <SectionHeading
        eyebrow="متدولوژی آرکان"
        title="چهار رکنِ یک رشد که می‌ماند"
        description="«ارکان» جمع «رکن» است؛ پایه‌هایی که رشد پایدار بر آن‌ها بنا می‌شود. ما هر چهار رکن را با هم می‌بینیم، نه جدا از هم."
        className="[&_h2]:text-bone [&_p]:text-bone/75"
      />

      <ol className="mt-14 grid gap-px overflow-hidden rounded-card bg-bone/10 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((pillar, i) => (
          <Reveal as="li" key={pillar.no} delay={i * 90}>
            <div className="flex h-full flex-col bg-pine p-7 transition-colors duration-300 hover:bg-pine-dark">
              {/* نقش‌مایه‌ی ستون — هم‌خوان با نشانه‌ی لوگو */}
              <div className="flex h-28 items-end gap-1.5" aria-hidden="true">
                <span
                  className={`w-2 rounded-t ${pillar.height} ${
                    pillar.accent ? "bg-brass" : "bg-bone/85"
                  }`}
                />
                <span className="w-2 rounded-t bg-bone/20" style={{ height: "70%" }} />
                <span className="w-2 rounded-t bg-bone/20" style={{ height: "45%" }} />
              </div>

              <p className="mt-6 nums font-heading text-caption font-semibold text-brass">
                رکن {toFa(pillar.no)}
              </p>
              <h3 className="mt-1 font-heading text-h3 font-bold text-bone">
                {pillar.title}
              </h3>
              <p className="mt-3 text-[0.95rem] leading-7 text-bone/70">
                {pillar.description}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>

      <Reveal>
        <p className="mt-10 max-w-2xl text-body leading-8 text-bone/80">
          آرکان فقط توصیه نمی‌دهد؛ تا مرحله‌ی اجرا کنار شما می‌ماند تا این چهار رکن در
          عمل، به نتیجه تبدیل شوند.
        </p>
      </Reveal>
    </Section>
  );
}
