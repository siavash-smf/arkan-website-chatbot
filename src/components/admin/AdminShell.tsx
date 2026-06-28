import Logo from "@/components/ui/Logo";
import { logout } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "leads", label: "لیدها", href: "/admin" },
  { key: "knowledge", label: "پایگاه دانش", href: "/admin/knowledge" },
  { key: "models", label: "مدل‌ها", href: "/admin/models" },
  { key: "conversations", label: "گفتگوها", href: "/admin/conversations" },
  { key: "persona", label: "پرسونا", href: "/admin/persona" },
  { key: "widget", label: "ویجت", href: "/admin/widget" },
  { key: "telegram", label: "تلگرام", href: "/admin/telegram" },
] as const;

export type AdminTab = (typeof TABS)[number]["key"];

/**
 * پوسته‌ی مشترک پنل مدیریت: هدر + تب‌ها + محتوای بخش.
 * هر صفحه‌ی بخش، `active` خودش را می‌دهد (بدون نیاز به usePathname).
 */
export default function AdminShell({
  active,
  children,
}: {
  active: AdminTab;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bone">
      <header className="sticky top-0 z-10 border-b border-sand bg-bone/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4">
              <Logo />
              <span className="hidden text-caption text-slate sm:inline">پنل مدیریت</span>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-btn border border-pine/25 px-4 py-2 text-caption text-pine transition-colors hover:bg-pine/5"
              >
                خروج
              </button>
            </form>
          </div>
          {/* تب‌ها */}
          <nav aria-label="بخش‌های پنل" className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <a
                key={t.key}
                href={t.href}
                className={cn(
                  "whitespace-nowrap border-b-2 px-4 py-3 text-[0.95rem] transition-colors",
                  t.key === active
                    ? "border-brass font-medium text-pine"
                    : "border-transparent text-slate hover:text-pine"
                )}
                aria-current={t.key === active ? "page" : undefined}
              >
                {t.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
