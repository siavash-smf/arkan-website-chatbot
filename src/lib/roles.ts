/**
 * نقش‌های پنل مدیریت — جدا از auth.ts (که server-only است)
 * تا کامپوننت‌های کلاینت هم بتوانند لیبل‌ها و رتبه‌ها را import کنند.
 */

export const ROLES = ["owner", "admin", "editor", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "مالک",
  admin: "مدیر",
  editor: "ویرایشگر",
  operator: "اپراتور",
  viewer: "بیننده",
};
