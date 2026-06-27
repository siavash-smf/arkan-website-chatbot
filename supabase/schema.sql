-- ───────────────────────────────────────────────────────────────
-- آرکان — اسکیمای جدول leads (درخواست‌های مشاوره)
-- این فایل را در SQL Editor پروژه‌ی Supabase اجرا کنید.
-- پایگاه داده‌ی مشترک با فاز بعدی (چت‌بات) خواهد بود.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz not null    default now(),
  full_name      text        not null,
  phone          text        not null,
  email          text,
  business_name  text        not null,
  industry       text,
  stage          text        not null,
  challenge      text        not null,
  preferred_time text,
  status         text        not null    default 'new'
);

-- ایندکس برای مرتب‌سازی پنل مدیریت بر اساس زمان
create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- فعال‌سازی RLS. درج از سمت سرور با کلید SERVICE_ROLE انجام می‌شود که
-- RLS را دور می‌زند؛ بنابراین هیچ پالیسی عمومی برای insert/select لازم نیست
-- و داده‌ها از دسترسی عمومی محفوظ می‌مانند.
alter table public.leads enable row level security;

-- (اختیاری) اگر بعداً خواستید از سمت کلاینت با anon key درج کنید،
-- می‌توانید پالیسی محدود زیر را فعال کنید:
--
-- create policy "allow anon insert leads"
--   on public.leads for insert
--   to anon
--   with check (true);
