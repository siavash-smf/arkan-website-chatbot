/**
 * فهرست نوع‌دار عملیات‌های audit + لیبل فارسی هرکدام.
 * جدا از audit.ts (که server-only است) تا UI کلاینت هم بتواند لیبل‌ها را import کند.
 * افزودن عملیات جدید = افزودن یک ردیف اینجا؛ typo یا لیبل جاافتاده خطای کامپایل می‌شود.
 */

export const AUDIT_ACTION_LABELS = {
  login: "ورود",
  create_first_owner: "ایجاد اولین مالک",
  admin_user_create: "ساخت کاربر",
  admin_user_role_change: "تغییر نقش",
  admin_user_activate: "فعال‌سازی کاربر",
  admin_user_deactivate: "غیرفعال‌سازی کاربر",
  admin_user_password_reset: "بازنشانی رمز",
  lead_status_change: "تغییر وضعیت لید",
  lead_convert: "تبدیل لید",
  contact_create: "ساخت مخاطب",
  contact_update: "ویرایش مخاطب",
  contact_delete: "حذف مخاطب",
  company_create: "ساخت شرکت",
  company_update: "ویرایش شرکت",
  company_delete: "حذف شرکت",
  deal_create: "ساخت معامله",
  deal_update: "ویرایش معامله",
  deal_stage_change: "تغییر مرحله‌ی معامله",
  deal_delete: "حذف معامله",
  activity_create: "ثبت فعالیت",
  activity_complete: "انجام فعالیت",
  activity_reopen: "بازکردن فعالیت",
  activity_delete: "حذف فعالیت",
  ai_score_lead: "امتیازدهی AI لید",
  ai_summarize_contact: "خلاصه‌سازی AI مخاطب",
  ai_next_action: "پیشنهاد AI اقدام بعدی",
  campaign_create: "ساخت کمپین",
  campaign_delete: "حذف کمپین",
  campaign_send: "ارسال کمپین",
  ai_campaign_email: "تولید AI ایمیل کمپین",
  ai_contract_followup: "پیام AI پیگیری قرارداد",
  ai_blog_suggest: "پیشنهاد AI محتوا",
  contract_create: "ساخت قرارداد",
  contract_update: "ویرایش قرارداد",
  contract_delete: "حذف قرارداد",
  contract_send: "ارسال قرارداد",
  contract_cancel: "لغو قرارداد",
  contract_accept: "تأیید قرارداد توسط کلاینت",
  ai_draft_contract: "پیش‌نویس AI قرارداد",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTION_LABELS;
