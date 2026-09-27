-- ───────────────────────────────────────────────────────────────
-- آرکان — اسکیمای پروپوزال‌ها (مرحله‌ی قبل از قرارداد)
-- این فایل را در SQL Editor پروژه‌ی Supabase اجرا کنید (بعد از contracts-schema.sql).
-- برخلاف فایل‌های قدیمی، این فایل از اول با اسکیمای arkan نوشته شده و idempotent است.
--
-- جریان: پروپوزال در /admin/crm/proposals ساخته می‌شود ← PDF در مرورگر ساخته و
-- با ایمیل ارسال می‌شود ← کلاینت در /proposal/<token> بسته را انتخاب و تأیید می‌کند
-- یا درخواست تغییر می‌دهد ← پروپوزال تأییدشده به قرارداد تبدیل می‌شود.
--
-- RLS فعال بدون policy ⇒ دسترسی فقط از سرور با service-role (مثل بقیه‌ی جدول‌ها).
-- ───────────────────────────────────────────────────────────────

create table if not exists arkan.proposals (
  id               uuid primary key default gen_random_uuid(),
  proposal_no      text not null unique,             -- مثل AP-1405-003

  -- ارتباط با CRM (اختیاری: پروپوزال را می‌شود کاملاً دستی هم نوشت)
  contact_id       uuid references arkan.contacts(id)  on delete set null,
  deal_id          uuid references arkan.deals(id)     on delete set null,

  -- مشخصات کلاینت (همیشه روی خود پروپوزال ذخیره می‌شود تا سند مستقل بماند)
  client_name      text not null,
  client_email     text not null,
  client_company   text,
  client_phone     text,

  -- متن پیشنهاد
  title            text not null,
  intro            text,                               -- خلاصه‌ی پیشنهاد
  understanding    jsonb not null default '[]'::jsonb, -- string[]  درک ما از وضعیت شما
  goals            jsonb not null default '[]'::jsonb, -- string[]  اهداف همکاری
  phases           jsonb not null default '[]'::jsonb, -- {title,detail,duration}[]
  deliverables     jsonb not null default '[]'::jsonb, -- string[]
  methodology      text,                               -- روش کار و همراهی
  timeline_note    text,
  exclusions       jsonb not null default '[]'::jsonb, -- string[]  خارج از دامنه
  assumptions      jsonb not null default '[]'::jsonb, -- string[]
  why_us           jsonb not null default '[]'::jsonb, -- string[]
  next_steps       jsonb not null default '[]'::jsonb, -- string[]
  terms_note       text,

  -- مبلغ: یک تا سه بسته که کلاینت یکی را انتخاب می‌کند (به تومان)
  options          jsonb not null default '[]'::jsonb, -- {id,name,tagline,price,recommended,features[],paymentNote,durationNote}[]
  valid_until      date,

  -- چرخه‌ی عمر
  status           text not null default 'draft'
                     check (status in ('draft','sent','viewed','approved','changes_requested','declined','converted','canceled')),
  view_token       uuid not null unique default gen_random_uuid(),  -- لینک عمومی: /proposal/<token>
  revision         integer not null default 1,
  sent_at          timestamptz,
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  view_count       integer not null default 0,
  responded_at     timestamptz,
  selected_option  text,                               -- شناسه‌ی بسته‌ای که کلاینت انتخاب کرد
  responder_name   text,
  responder_ip     text,
  contract_id      uuid references arkan.contracts(id) on delete set null,

  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists proposals_created_idx on arkan.proposals (created_at desc);
create index if not exists proposals_status_idx  on arkan.proposals (status);
create index if not exists proposals_contact_idx on arkan.proposals (contact_id);

-- رشته‌ی گفتگو درباره‌ی پروپوزال: یادداشت‌های کلاینت و پاسخ‌های ما
create table if not exists arkan.proposal_comments (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references arkan.proposals(id) on delete cascade,
  author       text not null check (author in ('client','admin')),
  body         text not null,
  revision     integer not null default 1,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists proposal_comments_idx on arkan.proposal_comments (proposal_id, created_at);

alter table arkan.proposals         enable row level security;
alter table arkan.proposal_comments enable row level security;

-- ⚠️ اسکیمای arkan «دسترسی پیش‌فرض» (default privileges) ندارد؛ جدول تازه بدون این grant
-- حتی برای کلید سرور هم بسته است و اپ خطای «permission denied for table» می‌گیرد.
-- فقط service_role: اپ از هیچ نقش دیگری استفاده نمی‌کند.
grant all on arkan.proposals, arkan.proposal_comments to service_role;

-- ── ارتقای جدول قراردادها ─────────────────────────────────────────
-- قراردادی که از پروپوزال ساخته شده، به منبعش اشاره می‌کند
alter table arkan.contracts
  add column if not exists proposal_id uuid references arkan.proposals(id) on delete set null;
-- IP تأییدکننده، کنار نام و زمان — همان شواهد امضای ساده‌ی آنلاین
alter table arkan.contracts add column if not exists accepted_ip text;
-- زمان ارسال نسخه‌ی تأییدشده برای طرفین (تا دوباره فرستاده نشود)
alter table arkan.contracts add column if not exists accepted_copy_sent_at timestamptz;

-- PostgREST فهرست جدول‌ها را کش می‌کند؛ بدون این، API تا چند دقیقه جدول تازه را نمی‌شناسد
notify pgrst, 'reload schema';
