"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { leadSchema, type SubmitResult, type LeadFieldErrors, type LeadInput } from "@/lib/validation";

/**
 * سرور‌اکشن ثبت درخواست مشاوره.
 * ۱) اعتبارسنجی سمت سرور با همان اسکیمای کلاینت.
 * ۲) درج در جدول leads در Supabase (در صورت تنظیم متغیرهای محیطی).
 * ۳) فالبک امن: اگر Supabase پیکربندی نشده باشد، درخواست لاگ می‌شود تا فرم همچنان کار کند.
 * ۴) قلاب اختیاری اطلاع‌رسانی ایمیل (کامنت‌گذاری‌شده).
 */
export async function submitLead(input: LeadInput): Promise<SubmitResult> {
  // ۱) اعتبارسنجی سرور
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: LeadFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof LeadInput;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const data = parsed.data;

  // ردیف آماده‌ی درج — هماهنگ با اسکیمای جدول leads
  const row = {
    full_name: data.full_name,
    phone: data.phone,
    email: data.email || null,
    business_name: data.business_name,
    industry: data.industry || null,
    stage: data.stage,
    challenge: data.challenge,
    preferred_time: data.preferred_time || null,
    status: "new" as const,
  };

  // ۲) درج در Supabase
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { error } = await supabase.from("leads").insert(row);
    if (error) {
      console.error("[submitLead] خطای درج در Supabase:", error.message);
      return {
        ok: false,
        formError: "در ثبت درخواست خطایی رخ داد. لطفاً دوباره تلاش کنید یا با ما تماس بگیرید.",
      };
    }
  } else {
    // ۳) فالبک: تا زمان تنظیم کلیدهای Supabase، درخواست را لاگ می‌کنیم
    console.warn(
      "[submitLead] Supabase پیکربندی نشده — درخواست لاگ شد (فالبک):\n",
      JSON.stringify(row, null, 2)
    );
  }

  // ۴) اطلاع‌رسانی ایمیل (اختیاری) — هنگام آماده‌بودن Resend از کامنت خارج کنید:
  //
  //   if (process.env.RESEND_API_KEY) {
  //     await fetch("https://api.resend.com/emails", {
  //       method: "POST",
  //       headers: {
  //         Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         from: "آرکان <noreply@arkan.co>",
  //         to: "info@arkan.co",
  //         subject: `درخواست مشاوره‌ی جدید — ${row.business_name}`,
  //         text: `${row.full_name} (${row.phone})\nچالش: ${row.challenge}`,
  //       }),
  //     }).catch((e) => console.error("[submitLead] خطای ارسال ایمیل:", e));
  //   }

  return { ok: true };
}
