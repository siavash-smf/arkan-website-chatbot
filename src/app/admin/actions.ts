"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  createSessionToken,
  getSession,
  canWrite,
  hasRole,
  ROLES,
  type Role,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { logAudit } from "@/lib/audit";
import { getSupabaseAdmin } from "@/lib/supabase";

const LEAD_STATUSES = ["new", "contacted", "scheduled", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/admin",
  maxAge: 60 * 60 * 24 * 30, // ۳۰ روز
};

type AdminUserRow = {
  id: string;
  email: string;
  role: Role;
  password_hash: string | null;
  is_active: boolean;
};

/** آیا هنوز هیچ کاربر ادمینی با رمز ساخته نشده؟ (حالت راه‌اندازی اولیه) */
export async function isBootstrapMode(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return true; // بدون دیتابیس فقط رمز legacy کار می‌کند
  const { count, error } = await supabase
    .from("admin_users")
    .select("id", { count: "exact", head: true })
    .not("password_hash", "is", null);
  if (error) {
    // ستون password_hash هنوز ساخته نشده (SQL اجرا نشده) ⇒ واقعاً حالت راه‌اندازی است.
    if (/password_hash/.test(error.message)) return true;
    // هر خطای دیگر (قطعی، rate limit، …) ⇒ fail-closed: مسیر رمز واحد قدیمی
    // باز نشود تا بعد از راه‌اندازی چندکاربره، backdoor برنگردد.
    return false;
  }
  return (count ?? 0) === 0;
}

/**
 * ورود مدیر: ایمیل + رمز از جدول admin_users.
 * تا وقتی هیچ کاربری ساخته نشده، رمز واحد قدیمی (ADMIN_PASSWORD) هم پذیرفته می‌شود.
 */
export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "رمز عبور را وارد کنید." };

  const supabase = getSupabaseAdmin();
  const bootstrap = await isBootstrapMode();

  if (bootstrap) {
    // حالت راه‌اندازی: فقط رمز واحد قدیمی.
    // ایمیل تایپ‌شده عمداً نادیده گرفته می‌شود تا هویت جعلی وارد نشست/لاگ نشود.
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return { error: "رمز مدیر روی سرور تنظیم نشده است (ADMIN_PASSWORD)." };
    }
    if (password !== expected) {
      return { error: "رمز عبور نادرست است." };
    }
    cookies().set(
      ADMIN_COOKIE,
      createSessionToken({ id: "legacy", email: "legacy-admin", role: "owner" }),
      COOKIE_OPTIONS
    );
    await logAudit(
      { uid: "legacy", email: "legacy-admin", role: "owner", exp: 0 },
      "login",
      "bootstrap"
    );
    redirect("/admin");
  }

  if (!supabase) return { error: "اتصال پایگاه داده برقرار نیست." };
  if (!email) return { error: "ایمیل را وارد کنید." };

  const { data } = await supabase
    .from("admin_users")
    .select("id, email, role, password_hash, is_active")
    .eq("email", email)
    .maybeSingle<AdminUserRow>();

  if (
    !data ||
    !data.is_active ||
    !data.password_hash ||
    !(await verifyPassword(password, data.password_hash))
  ) {
    return { error: "ایمیل یا رمز عبور نادرست است." };
  }

  cookies().set(ADMIN_COOKIE, createSessionToken(data), COOKIE_OPTIONS);
  await supabase
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.id);
  await logAudit({ uid: data.id, email: data.email, role: data.role, exp: 0 }, "login");

  redirect("/admin");
}

/**
 * ساخت اولین کاربر مالک (فقط در حالت راه‌اندازی).
 * ADMIN_PASSWORD نقش «کد راه‌اندازی» را دارد تا هرکسی نتواند مالک بسازد.
 */
export async function createFirstOwner(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const setupCode = String(formData.get("setup_code") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return { error: "کد راه‌اندازی روی سرور تنظیم نشده است (ADMIN_PASSWORD)." };
  }
  if (setupCode !== expected) return { error: "کد راه‌اندازی نادرست است." };
  if (!email || !email.includes("@")) return { error: "ایمیل معتبر وارد کنید." };
  if (password.length < 8) return { error: "رمز عبور باید حداقل ۸ کاراکتر باشد." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: "اتصال پایگاه داده برقرار نیست." };
  if (!(await isBootstrapMode())) {
    return { error: "کاربر مالک قبلاً ساخته شده است. از فرم ورود استفاده کنید." };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .upsert(
      { email, role: "owner", password_hash: await hashPassword(password), is_active: true },
      { onConflict: "email" }
    )
    .select("id, email, role")
    .single();

  if (error || !data) return { error: error?.message ?? "ساخت کاربر ناموفق بود." };

  cookies().set(ADMIN_COOKIE, createSessionToken(data), COOKIE_OPTIONS);
  await logAudit({ uid: data.id, email: data.email, role: data.role, exp: 0 }, "create_first_owner");

  redirect("/admin");
}

/** خروج مدیر. */
export async function logout(): Promise<void> {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

/** تغییر وضعیت یک لید (نیازمند نقش با اجازه‌ی نوشتن). */
export async function updateLeadStatus(
  id: string,
  status: LeadStatus
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session) return { ok: false, error: "دسترسی غیرمجاز." };
  if (!canWrite(session)) return { ok: false, error: "نقش شما اجازه‌ی تغییر ندارد." };
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

  await logAudit(session, "lead_status_change", id, { status });
  revalidatePath("/admin");
  return { ok: true };
}

// ── مدیریت کاربران ادمین ─────────────────────────────────────────

type ActionResult = { ok: boolean; error?: string };

/** ساخت کاربر ادمین جدید (فقط admin به بالا؛ ساخت admin/owner فقط توسط owner). */
export async function createAdminUser(
  email: string,
  password: string,
  role: Role
): Promise<ActionResult> {
  const session = getSession();
  if (!hasRole(session, "admin")) return { ok: false, error: "دسترسی غیرمجاز." };
  if (!ROLES.includes(role)) return { ok: false, error: "نقش نامعتبر است." };
  if ((role === "admin" || role === "owner") && !hasRole(session, "owner")) {
    return { ok: false, error: "فقط مالک می‌تواند مدیر یا مالک بسازد." };
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: false, error: "ایمیل معتبر وارد کنید." };
  if (password.length < 8) return { ok: false, error: "رمز عبور باید حداقل ۸ کاراکتر باشد." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال پایگاه داده برقرار نیست." };

  const { error } = await supabase.from("admin_users").insert({
    email: normalized,
    role,
    password_hash: await hashPassword(password),
    is_active: true,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit(session, "admin_user_create", normalized, { role });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** تغییر نقش کاربر (فقط owner). */
export async function updateUserRole(id: string, role: Role): Promise<ActionResult> {
  const session = getSession();
  if (!hasRole(session, "owner")) return { ok: false, error: "فقط مالک می‌تواند نقش تغییر دهد." };
  if (!ROLES.includes(role)) return { ok: false, error: "نقش نامعتبر است." };
  if (session!.uid === id) return { ok: false, error: "نمی‌توانید نقش خودتان را تغییر دهید." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال پایگاه داده برقرار نیست." };

  const { error } = await supabase.from("admin_users").update({ role }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(session, "admin_user_role_change", id, { role });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** فعال/غیرفعال‌کردن کاربر (فقط admin به بالا؛ غیرفعال‌کردن admin/owner فقط توسط owner). */
export async function toggleUserActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = getSession();
  if (!hasRole(session, "admin")) return { ok: false, error: "دسترسی غیرمجاز." };
  if (session!.uid === id) return { ok: false, error: "نمی‌توانید حساب خودتان را غیرفعال کنید." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال پایگاه داده برقرار نیست." };

  // یک admin نتواند owner (یا admin دیگر) را غیرفعال کند و پنل قفل شود
  const { data: target } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", id)
    .maybeSingle<{ role: Role }>();
  if (!target) return { ok: false, error: "کاربر پیدا نشد." };
  if ((target.role === "owner" || target.role === "admin") && !hasRole(session, "owner")) {
    return { ok: false, error: "فقط مالک می‌تواند وضعیت مدیر/مالک را تغییر دهد." };
  }

  const { error } = await supabase
    .from("admin_users")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(session, isActive ? "admin_user_activate" : "admin_user_deactivate", id);
  revalidatePath("/admin/users");
  return { ok: true };
}

/** تنظیم رمز جدید برای کاربر (فقط owner). */
export async function resetUserPassword(id: string, password: string): Promise<ActionResult> {
  const session = getSession();
  if (!hasRole(session, "owner")) return { ok: false, error: "فقط مالک می‌تواند رمز بازنشانی کند." };
  if (password.length < 8) return { ok: false, error: "رمز عبور باید حداقل ۸ کاراکتر باشد." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال پایگاه داده برقرار نیست." };

  const { error } = await supabase
    .from("admin_users")
    .update({ password_hash: await hashPassword(password) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(session, "admin_user_password_reset", id);
  revalidatePath("/admin/users");
  return { ok: true };
}
