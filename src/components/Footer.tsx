import Logo from "./ui/Logo";
import Container from "./ui/Container";
import { IconMail, IconPhone, IconPin } from "./ui/icons";
import { toFa } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#services", label: "خدمات" },
  { href: "/#pillars", label: "چهار رکن" },
  { href: "/#process", label: "فرایند همکاری" },
  { href: "/blog", label: "بلاگ" },
  { href: "/#consultation", label: "درخواست مشاوره" },
];

export default function Footer() {
  return (
    <footer className="bg-pine text-bone">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-3">
          {/* برند */}
          <div className="md:col-span-1">
            <Logo variant="light" />
            <p className="mt-4 max-w-xs text-[0.95rem] leading-8 text-bone/70">
              مشاور استراتژی و رشد کسب‌وکار. از استراتژی تا اجرا کنار شما می‌مانیم تا
              رشدی پایدار بسازید.
            </p>
          </div>

          {/* ناوبری */}
          <nav aria-label="پیوندهای فوتر" className="md:col-span-1">
            <h2 className="mb-4 font-heading text-[0.95rem] font-semibold text-bone">
              پیوندها
            </h2>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[0.95rem] text-bone/70 transition-colors hover:text-brass"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* تماس */}
          <div className="md:col-span-1">
            <h2 className="mb-4 font-heading text-[0.95rem] font-semibold text-bone">
              تماس با ما
            </h2>
            <ul className="space-y-3.5 text-[0.95rem] text-bone/80">
              <li>
                <a
                  href="mailto:info@arkan.co"
                  className="flex items-center gap-3 transition-colors hover:text-brass"
                  dir="ltr"
                >
                  <IconMail width={20} height={20} className="shrink-0 text-brass" />
                  <span>info@arkan.co</span>
                </a>
              </li>
              <li>
                <a
                  href="tel:+982188000000"
                  className="flex items-center gap-3 transition-colors hover:text-brass"
                >
                  <IconPhone width={20} height={20} className="shrink-0 text-brass" />
                  <span dir="ltr">{toFa("۰۲۱-۸۸۰۰۰۰۰۰")}</span>
                </a>
              </li>
              <li className="flex items-center gap-3">
                <IconPin width={20} height={20} className="shrink-0 text-brass" />
                <span>تهران، ایران</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-bone/15 pt-6 text-caption text-bone/60 sm:flex-row">
          <p>© {toFa("۱۴۰۴")} آرکان. همه‌ی حقوق محفوظ است.</p>
          <p>آرکان، مشاور استراتژی و رشد کسب‌وکار</p>
        </div>
      </Container>
    </footer>
  );
}
