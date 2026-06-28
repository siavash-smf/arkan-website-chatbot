import { getWidgetConfig } from "@/lib/rag/widget";

export const runtime = "nodejs";

// پیکربندی ظاهری ویجت — عمومی (هر سایت میزبان می‌تواند بخواند). دامنه‌های مجاز برنگردانده می‌شوند.
export async function GET() {
  const cfg = await getWidgetConfig();
  return Response.json(
    {
      enabled: cfg.enabled,
      primary_color: cfg.primary_color,
      position: cfg.position,
      launcher_text: cfg.launcher_text,
      welcome_message: cfg.welcome_message,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
