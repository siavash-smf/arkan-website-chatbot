import Logo from "@/components/ui/Logo";
import { logout } from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import { hasRole, type Role } from "@/lib/auth";

type Tab = { key: string; label: string; href: string; minRole?: Role };
type Group = { key: string; label: string; tabs: readonly Tab[] };

// as const ⇒ کلیدها literal می‌مانند و پاس‌دادن active اشتباه خطای کامپایل می‌شود
const GROUPS = [
  {
    key: "dashboard",
    label: "داشبورد",
    tabs: [{ key: "dashboard", label: "داشبورد", href: "/admin" }],
  },
  {
    key: "crm",
    label: "CRM",
    tabs: [
      { key: "leads", label: "لیدها", href: "/admin/leads" },
      { key: "contacts", label: "مخاطبان", href: "/admin/crm/contacts" },
      { key: "companies", label: "شرکت‌ها", href: "/admin/crm/companies" },
      { key: "deals", label: "معاملات", href: "/admin/crm/deals" },
      { key: "activities", label: "فعالیت‌ها", href: "/admin/crm/activities" },
      { key: "contracts", label: "قراردادها", href: "/admin/crm/contracts" },
      { key: "campaigns", label: "کمپین‌ها", href: "/admin/crm/campaigns" },
      { key: "reports", label: "گزارش‌ها", href: "/admin/crm/reports" },
      { key: "assistant", label: "✨ دستیار", href: "/admin/crm/assistant" },
    ],
  },
  {
    key: "chatbot",
    label: "چت‌بات",
    tabs: [
      { key: "conversations", label: "گفتگوها", href: "/admin/conversations" },
      { key: "knowledge", label: "پایگاه دانش", href: "/admin/knowledge" },
      { key: "models", label: "مدل‌ها", href: "/admin/models" },
      { key: "persona", label: "پرسونا", href: "/admin/persona" },
      { key: "playground", label: "پلی‌گراند", href: "/admin/playground" },
      { key: "feedback", label: "بازخورد", href: "/admin/feedback" },
    ],
  },
  {
    key: "settings",
    label: "تنظیمات",
    tabs: [
      { key: "widget", label: "ویجت", href: "/admin/widget" },
      { key: "telegram", label: "تلگرام", href: "/admin/telegram" },
      { key: "users", label: "کاربران", href: "/admin/users", minRole: "admin" },
    ],
  },
] as const satisfies readonly Group[];

export type AdminTab = (typeof GROUPS)[number]["tabs"][number]["key"];

/**
 * پوسته‌ی مشترک پنل مدیریت: هدر + ناوبری دوسطحی (گروه‌ها + تب‌های زیرمجموعه).
 * هر صفحه‌ی بخش، `active` خودش را می‌دهد (بدون نیاز به usePathname).
 * `role` برای پنهان‌کردن تب‌های نیازمند نقش بالاتر (مثل «کاربران») است.
 */
export default function AdminShell({
  active,
  role,
  children,
}: {
  active: AdminTab;
  role?: Role;
  children: React.ReactNode;
}) {
  const activeGroup =
    GROUPS.find((g) => g.tabs.some((t) => t.key === active)) ?? GROUPS[0];
  const session = role ? { uid: "x", email: "", role, exp: 0 } : null;
  const visibleTabs = activeGroup.tabs.filter((t) => {
    const min = "minRole" in t ? t.minRole : undefined;
    return !min || hasRole(session, min);
  });

  return (
    <div className="min-h-dvh bg-bone">
      <header className="sticky top-0 z-10 border-b border-sand bg-bone/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4">
              <Logo />
              <span className="hidden text-caption text-slate sm:inline">پنل مدیریت</span>
            </div>
            <div className="flex items-center gap-2">
              {/* گروه‌های اصلی */}
              <nav aria-label="گروه‌های پنل" className="flex gap-1 overflow-x-auto">
                {GROUPS.map((g) => (
                  <a
                    key={g.key}
                    href={g.tabs[0].href}
                    className={cn(
                      "whitespace-nowrap rounded-full px-3.5 py-1.5 text-caption transition-colors",
                      g.key === activeGroup.key
                        ? "bg-pine text-bone"
                        : "text-slate hover:bg-pine/5 hover:text-pine"
                    )}
                    aria-current={g.key === activeGroup.key ? "page" : undefined}
                  >
                    {g.label}
                  </a>
                ))}
              </nav>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-btn border border-pine/25 px-4 py-2 text-caption text-pine transition-colors hover:bg-pine/5"
                >
                  خروج
                </button>
              </form>
            </div>
          </div>
          {/* تب‌های زیرمجموعه‌ی گروه فعال */}
          {visibleTabs.length > 1 && (
            <nav aria-label="بخش‌های گروه" className="-mb-px flex gap-1 overflow-x-auto">
              {visibleTabs.map((t) => (
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
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
