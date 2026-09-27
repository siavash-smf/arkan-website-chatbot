-- ───────────────────────────────────────────────────────────────
-- آرکان — ساخت اسکیمای arkan (اولین فایل؛ فقط یک بار اجرا کنید)
--
-- همه‌ی جدول‌های آرکان در اسکیمای arkan ساخته می‌شوند، نه public.
-- دلیل: دیتابیس می‌تواند با پروژه‌های دیگر مشترک باشد (مثلاً چند پروژه‌ی دانشجویی
-- روی یک Supabase رایگان) و نام جدول‌هایی مثل leads یا contracts تداخل نکند.
-- کلاینت اپ و اسکریپت‌ها با db: { schema: "arkan" } ساخته می‌شوند.
--
-- ⚠️ بعد از اجرای این فایل، در داشبورد Supabase این کار را هم بکنید:
--    Project Settings → Data API → Exposed schemas → «arkan» را اضافه و ذخیره کنید.
--    بدون آن، API جدول‌های arkan را نمی‌بیند و هر درخواست با خطای
--    «The schema must be one of the following: public, …» برمی‌گردد.
-- ───────────────────────────────────────────────────────────────

create schema if not exists arkan;

-- فقط کلید سرور (service_role) به اسکیما دسترسی دارد؛ RLS بدون policy
-- روی همه‌ی جدول‌ها، کلیدهای anon و authenticated را بسته نگه می‌دارد.
grant usage on schema arkan to service_role;

-- هر جدول، sequence و تابعی که از این به بعد در arkan ساخته شود، خودکار برای
-- service_role باز است. بدون این خط، هر جدول تازه یک grant دستی لازم دارد.
alter default privileges in schema arkan grant all on tables to service_role;
alter default privileges in schema arkan grant all on sequences to service_role;
alter default privileges in schema arkan grant execute on functions to service_role;
