import { cn } from "@/lib/utils";
import Container from "./Container";
import Reveal from "./Reveal";

type SectionHeadingProps = {
  /** برچسب کوچک بالای عنوان (eyebrow) */
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "start" | "center";
  className?: string;
};

/** سرتیتر استاندارد بخش‌ها — برای یکدستی تایپوگرافی و فاصله‌ها */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "start",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {eyebrow && (
        <p className="mb-3 inline-flex items-center gap-2 text-caption font-medium text-brass">
          <span className="h-px w-6 bg-brass" aria-hidden="true" />
          {eyebrow}
        </p>
      )}
      <h2 className="text-[1.75rem] font-bold leading-tight sm:text-h2">{title}</h2>
      {description && (
        <p className="mt-4 text-body text-slate">{description}</p>
      )}
    </Reveal>
  );
}

type SectionProps = {
  id?: string;
  children: React.ReactNode;
  className?: string;
  /** پس‌زمینه‌ی بخش */
  surface?: "bone" | "sand" | "pine" | "white";
};

const surfaceMap = {
  bone: "bg-bone",
  sand: "bg-sand",
  white: "bg-white",
  pine: "bg-pine text-bone",
};

export default function Section({
  id,
  children,
  className,
  surface = "bone",
}: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-20 sm:py-28", surfaceMap[surface], className)}>
      <Container>{children}</Container>
    </section>
  );
}
