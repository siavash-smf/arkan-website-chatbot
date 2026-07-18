-- ───────────────────────────────────────────────────────────────
-- آرکان — اسکیمای ماژول قراردادها (تکمیل CRM)
-- این فایل را در SQL Editor پروژه‌ی Supabase اجرا کنید (بعد از crm-schema.sql).
-- قرارداد از روی معامله/مخاطب ساخته می‌شود، متن آن Markdown است،
-- و با «لینک اشتراک» توکن‌دار برای کلاینت ارسال و به‌صورت آنلاین تأیید می‌شود.
-- RLS فعال بدون policy ⇒ دسترسی فقط از سرور با service-role
-- (صفحه‌ی عمومی قرارداد هم سمت سرور با توکن غیرقابل‌حدس رندر می‌شود).
-- ───────────────────────────────────────────────────────────────

create table if not exists public.contracts (
  id               uuid primary key default gen_random_uuid(),
  contract_no      text not null,                  -- مثل AR-1404-007
  title            text not null,
  deal_id          uuid references public.deals(id) on delete set null,
  contact_id       uuid not null references public.contacts(id) on delete cascade,
  company_id       uuid references public.companies(id) on delete set null,
  body_md          text not null,                  -- متن قرارداد (Markdown)
  amount_toman     bigint not null default 0,
  start_date       date,
  duration_label   text,                           -- مثل «۳ ماه»
  status           text not null default 'draft',  -- draft | sent | viewed | accepted | canceled
  share_token      uuid not null default gen_random_uuid(),  -- لینک عمومی: /contract/<token>
  sent_at          timestamptz,
  viewed_at        timestamptz,                    -- اولین بازدید کلاینت
  accepted_at      timestamptz,
  accepted_by_name text,                           -- نام تأییدکننده (امضای ساده‌ی آنلاین)
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists contracts_contact_idx on public.contracts (contact_id, created_at desc);
create index if not exists contracts_token_idx   on public.contracts (share_token);

alter table public.contracts enable row level security;
