import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * پیکربندی ویجت قابل‌جاسازی — از دیتابیس خوانده می‌شود تا از پنل قابل تغییر باشد.
 */
export type WidgetConfig = {
  enabled: boolean;
  primary_color: string;
  position: "left" | "right";
  welcome_message: string;
  launcher_text: string;
  allowed_domains: string[];
};

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  enabled: true,
  primary_color: "#143A32",
  position: "left",
  welcome_message:
    "سلام! من دستیار هوشمند آرکان هستم. چطور می‌توانم درباره‌ی خدمات و رشد کسب‌وکارتان کمک کنم؟",
  launcher_text: "گفت‌وگو با مشاور",
  allowed_domains: [],
};

export async function getWidgetConfig(): Promise<WidgetConfig> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return DEFAULT_WIDGET_CONFIG;
  const { data } = await supabase
    .from("widget_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_WIDGET_CONFIG;
  return { ...DEFAULT_WIDGET_CONFIG, ...data } as WidgetConfig;
}

/** ساخت مقدار frame-ancestors برای CSP بر اساس دامنه‌های مجاز (خالی ⇒ همه). */
export function frameAncestorsValue(domains: string[]): string {
  if (!domains || domains.length === 0) return "*";
  // 'self' + دامنه‌های مجاز
  return ["'self'", ...domains].join(" ");
}
