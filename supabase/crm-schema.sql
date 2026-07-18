-- ───────────────────────────────────────────────────────────────
-- آرکان فاز ۴ — اسکیمای CRM
-- این فایل را در SQL Editor پروژه‌ی Supabase (همان دیتابیس سایت) اجرا کنید.
-- شامل: شرکت‌ها، مخاطبان، مراحل پایپ‌لاین، معاملات، فعالیت‌ها،
--        گسترش leads (تبدیل + امتیاز AI)، فعال‌سازی admin_users و audit_log.
-- جریان کلاسیک CRM: لید ← تبدیل ← مخاطب/شرکت/معامله.
-- RLS فعال است؛ دسترسی فقط از سرور با service-role (مثل بقیه‌ی جداول).
-- ───────────────────────────────────────────────────────────────

-- ── شرکت‌ها ─────────────────────────────────────────────────────
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  industry   text,
  website    text,
  city       text,
  size_label text,                                 -- مثل «۱-۱۰»، «۱۱-۵۰»
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── مخاطبان ─────────────────────────────────────────────────────
create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies(id) on delete set null,
  full_name       text not null,
  phone           text,
  email           text,
  position        text,                            -- سمت در شرکت
  source          text not null default 'manual',  -- website | chatbot | manual
  lead_id         uuid references public.leads(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  ai_summary      text,                            -- خلاصه‌ی AI از گفتگوی چت‌بات
  ai_summary_at   timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists contacts_company_idx on public.contacts (company_id);
create index if not exists contacts_created_idx on public.contacts (created_at desc);

-- ── مراحل پایپ‌لاین (config-driven، نه enum) ─────────────────────
create table if not exists public.pipeline_stages (
  key      text primary key,
  label_fa text not null,
  position int  not null,
  is_won   boolean not null default false,
  is_lost  boolean not null default false
);
insert into public.pipeline_stages (key, label_fa, position, is_won, is_lost) values
  ('new',         'جدید',              1, false, false),
  ('qualifying',  'در حال بررسی',      2, false, false),
  ('meeting',     'جلسه مشاوره',       3, false, false),
  ('proposal',    'ارسال پروپوزال',    4, false, false),
  ('negotiation', 'مذاکره',            5, false, false),
  ('won',         'بسته‌شده (موفق)',   6, true,  false),
  ('lost',        'بسته‌شده (ناموفق)', 7, false, true)
on conflict (key) do nothing;

-- ── معاملات ─────────────────────────────────────────────────────
create table if not exists public.deals (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  contact_id        uuid not null references public.contacts(id) on delete cascade,
  company_id        uuid references public.companies(id) on delete set null,
  stage_key         text not null default 'new' references public.pipeline_stages(key),
  status            text not null default 'open', -- open | won | lost (خودکار از مرحله)
  amount_toman      bigint not null default 0,
  expected_close    date,
  stage_entered_at  timestamptz not null default now(), -- برای «روز در مرحله»
  won_at            timestamptz,
  lost_at           timestamptz,
  lost_reason       text,
  owner_email       text,                          -- کارشناس مسئول
  ai_next_action    text,                          -- پیشنهاد اقدام بعدی AI
  ai_next_action_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists deals_stage_idx      on public.deals (stage_key);
create index if not exists deals_contact_idx    on public.deals (contact_id);
create index if not exists deals_status_won_idx on public.deals (status, won_at);

-- ── فعالیت‌ها (تماس/جلسه/یادداشت/وظیفه + رویدادهای سیستمی) ───────
create table if not exists public.activities (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id    uuid references public.deals(id) on delete cascade,
  type       text not null,                        -- call | meeting | note | task | stage_change
  title      text not null,
  body       text,
  due_at     timestamptz,                          -- فقط برای task/meeting
  done_at    timestamptz,
  created_by text,                                 -- ایمیل کاربر ادمین
  created_at timestamptz not null default now()
);
create index if not exists activities_contact_idx on public.activities (contact_id, created_at desc);
create index if not exists activities_deal_idx    on public.activities (deal_id, created_at desc);
create index if not exists activities_due_idx     on public.activities (due_at) where done_at is null;

-- ── گسترش leads: تبدیل + امتیازدهی AI ───────────────────────────
alter table public.leads add column if not exists converted_at       timestamptz;
alter table public.leads add column if not exists contact_id         uuid references public.contacts(id) on delete set null;
alter table public.leads add column if not exists ai_score           int;  -- ۰ تا ۱۰۰
alter table public.leads add column if not exists ai_score_rationale text;
alter table public.leads add column if not exists ai_scored_at       timestamptz;

-- ── فعال‌سازی admin_users (احراز هویت چندکاربره) ─────────────────
alter table public.admin_users add column if not exists password_hash text;
alter table public.admin_users add column if not exists is_active     boolean not null default true;
alter table public.admin_users add column if not exists last_login_at timestamptz;

-- ── گسترش audit_log ─────────────────────────────────────────────
alter table public.audit_log add column if not exists actor_email text;
alter table public.audit_log add column if not exists details     jsonb;

-- ── فعال‌سازی RLS روی جداول جدید (بدون policy ⇒ فقط service-role) ─
alter table public.companies       enable row level security;
alter table public.contacts        enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals           enable row level security;
alter table public.activities      enable row level security;

-- ───────────────────────────────────────────────────────────────
-- (اختیاری — کامنت‌شده) تبدیل انبوه لیدهای موجود به مخاطب.
-- مسیر توصیه‌شده تبدیل تکی از پنل است تا جریان کلاسیک Lead → Convert
-- به دانشجویان نشان داده شود؛ این بلوک فقط برای پرکردن سریع دموی کلاس.
-- ───────────────────────────────────────────────────────────────
-- with converted as (
--   insert into public.contacts (full_name, phone, email, source, lead_id, conversation_id, notes)
--   select full_name, phone, email, coalesce(source, 'website'), id, conversation_id, challenge
--   from public.leads
--   where converted_at is null
--   returning id, lead_id
-- )
-- update public.leads l
-- set converted_at = now(), contact_id = c.id
-- from converted c
-- where l.id = c.lead_id;
