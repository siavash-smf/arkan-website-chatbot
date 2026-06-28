import { NextResponse, type NextRequest } from "next/server";

/**
 * برای مسیر /widget هدر CSP frame-ancestors را بر اساس «دامنه‌های مجاز» تنظیم می‌کند
 * تا ویجت فقط روی سایت‌های تأییدشده قابل‌جاسازی باشد. لیست خالی ⇒ همه‌ی دامنه‌ها مجاز.
 */
export const config = { matcher: ["/widget"] };

let cache: { domains: string[]; ts: number } | null = null;

async function getAllowedDomains(): Promise<string[]> {
  if (cache && Date.now() - cache.ts < 60_000) return cache.domains;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return [];
    const res = await fetch(`${url}/rest/v1/widget_config?select=allowed_domains&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const rows = await res.json();
    const domains: string[] = Array.isArray(rows) && rows[0]?.allowed_domains ? rows[0].allowed_domains : [];
    cache = { domains, ts: Date.now() };
    return domains;
  } catch {
    return [];
  }
}

export async function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  const domains = await getAllowedDomains();
  const ancestors = domains.length ? ["'self'", ...domains].join(" ") : "*";
  res.headers.set("Content-Security-Policy", `frame-ancestors ${ancestors}`);
  return res;
}
