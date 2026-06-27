"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, makeSessionToken, isAuthed } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const LEAD_STATUSES = ["new", "contacted", "scheduled", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** ورود مدیر: بررسی رمز و تنظیم کوکی نشست. */
export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { error: "رمز مدیر روی سرور تنظیم نشده است (ADMIN_PASSWORD)." };
  }
  if (!password || password !== expected) {
    return { error: "رمز عبور نادرست است." };
  }

  cookies().set(ADMIN_COOKIE, makeSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 30, // ۳۰ روز
  });

  redirect("/admin");
}

/** خروج مدیر. */
export async function logout(): Promise<void> {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

/** تغییر وضعیت یک لید (فقط برای مدیر احرازشده). */
export async function updateLeadStatus(
  id: string,
  status: LeadStatus
): Promise<{ ok: boolean; error?: string }> {
  if (!isAuthed()) {
    return { ok: false, error: "دسترسی غیرمجاز." };
  }
  if (!LEAD_STATUSES.includes(status)) {
    return { ok: false, error: "وضعیت نامعتبر است." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "اتصال پایگاه داده برقرار نیست." };
  }

  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin");
  return { ok: true };
}
