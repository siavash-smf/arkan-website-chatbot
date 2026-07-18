-- ───────────────────────────────────────────────────────────────
-- آرکان — اسکیمای کمپین‌های ایمیلی CRM
-- این فایل را در SQL Editor پروژه‌ی Supabase اجرا کنید (بعد از crm-schema.sql).
-- کمپین = یک سگمنت از مخاطبان/لیدها + برای هر گیرنده یک ایمیل
-- شخصی‌سازی‌شده با AI که ادمین قبل از ارسال بازبینی می‌کند (human-in-the-loop).
-- ارسال با Resend (اختیاری — بدون کلید، پیش‌نویس‌ها قابل کپی هستند).
-- ───────────────────────────────────────────────────────────────

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  segment_key text not null,                    -- کلید سگمنت تعریف‌شده در کد
  goal        text,                             -- هدف کمپین (به AI داده می‌شود)
  status      text not null default 'draft',    -- draft | sent
  created_by  text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.campaign_emails (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id  uuid references public.contacts(id) on delete set null,
  lead_id     uuid references public.leads(id) on delete set null,
  to_name     text not null,
  to_email    text not null,
  context     jsonb,                            -- زمینه‌ی شخصی‌سازی (چالش، وضعیت، …)
  subject     text,
  body_text   text,
  status      text not null default 'pending',  -- pending | ready | skipped | sent | failed
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists campaign_emails_campaign_idx on public.campaign_emails (campaign_id);

alter table public.campaigns       enable row level security;
alter table public.campaign_emails enable row level security;
