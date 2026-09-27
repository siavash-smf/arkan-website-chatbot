-- ───────────────────────────────────────────────────────────────
-- آرکان — ارتقای چت‌بات
-- بعد از همه‌ی اسکریپت‌های قبلی، در SQL Editor همان پروژه‌ی Supabase اجرا کنید.
-- اجرای چندباره بی‌خطر است (idempotent).
--
-- اسکیما: همه‌ی جدول‌های آرکان در اسکیمای «arkan» هستند (00-arkan-schema.sql)،
-- نه public — چون دیتابیس می‌تواند با پروژه‌های دیگر مشترک باشد و کلاینت هم با
-- db: { schema: "arkan" } ساخته می‌شود (src/lib/supabase.ts).
-- ───────────────────────────────────────────────────────────────

-- ── ۱) بودجه‌ی توکن ──────────────────────────────────────────────
-- ۸۰۰ توکن کم است: توکن‌های reasoning از همین بودجه خرج می‌شوند و
-- پاسخ وسط جمله قطع می‌شود. ۲۰۰۰ حداقل امن است.
alter table arkan.model_config alter column max_tokens set default 2000;
update arkan.model_config set max_tokens = 2000 where max_tokens < 2000;

-- ── ۲) ردیف پیکربندی برای هر کانال ───────────────────────────────
-- چت‌بات با channel واقعی کوئری می‌زند؛ بدون این ردیف‌ها ویجت و تلگرام
-- به مقادیر هاردکد کد می‌افتادند و تنظیمات پنل روی‌شان اثری نداشت.
insert into arkan.model_config (channel, active_model, fallback_model, max_tokens)
select 'widget', 'google/gemini-3.5-flash', 'google/gemini-2.5-flash', 2000
where not exists (select 1 from arkan.model_config where channel = 'widget');

insert into arkan.model_config (channel, active_model, fallback_model, max_tokens)
select 'telegram', 'google/gemini-3.5-flash', 'google/gemini-2.5-flash', 2000
where not exists (select 1 from arkan.model_config where channel = 'telegram');

-- ── ۳) سؤال‌های پیشنهادی ویجت ────────────────────────────────────
alter table arkan.widget_config
  add column if not exists suggested_questions text[] not null default '{}';

update arkan.widget_config
set suggested_questions = array[
  'آرکان دقیقاً چه کمکی به کسب‌وکار من می‌کند؟',
  'متدولوژی «چهار رکن» چیست؟',
  'هزینه و مدت بسته‌های مشاوره چقدر است؟',
  'برای شروع همکاری باید چه کار کنم؟'
]
where suggested_questions = '{}';

-- ── ۴) تحویل به انسان (escalation) ───────────────────────────────
-- ستون status از قبل مقدار needs_human را می‌پذیرفت ولی هیچ‌جا ست نمی‌شد.
alter table arkan.conversations add column if not exists escalated_at      timestamptz;
alter table arkan.conversations add column if not exists escalation_reason text;
alter table arkan.conversations add column if not exists contact_hint      text;

create index if not exists conversations_status_idx
  on arkan.conversations (status, last_at desc);

-- ── ۵) سؤال‌های بی‌پاسخ (شکاف‌های پایگاه دانش) ────────────────────
create table if not exists arkan.unanswered_questions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references arkan.conversations(id) on delete set null,
  channel         text not null default 'web',
  question        text not null,
  top_similarity  real,                       -- بهترین شباهت یافت‌شده (null یعنی هیچ)
  resolved        boolean not null default false,
  created_at      timestamptz not null default now()
);
alter table arkan.unanswered_questions enable row level security;
create index if not exists unanswered_questions_created_idx
  on arkan.unanswered_questions (resolved, created_at desc);

-- ── ۶) تنظیمات رفتاری چت‌بات (تک‌ردیفی) ──────────────────────────
create table if not exists arkan.chat_settings (
  id                        uuid primary key default gen_random_uuid(),
  -- سقف مصرف
  rate_limit_per_minute     int  not null default 20,
  max_messages_per_conv     int  not null default 40,
  -- تحویل به انسان
  handoff_enabled           boolean not null default true,
  handoff_message           text not null default 'درخواست شما برای گفت‌وگو با همکاران آرکان ثبت شد. تیم ما در اولین فرصت کاری با شما تماس می‌گیرد.',
  -- ساعات کاری
  office_hours_enabled      boolean not null default false,
  office_hours_start        text not null default '09:00',
  office_hours_end          text not null default '18:00',
  office_days               int[] not null default '{0,1,2,3,4}',  -- ۰=شنبه … ۶=جمعه
  offline_message           text not null default 'الان خارج از ساعت کاری آرکان هستیم. من پاسخ می‌دهم، ولی برای پیگیری انسانی، اولین روز کاری با شما تماس می‌گیریم.',
  -- محافظ‌ها
  injection_guard_enabled   boolean not null default true,
  pii_masking_enabled       boolean not null default true,
  -- خلاصه‌ی خودکار
  summary_enabled           boolean not null default true,
  summary_every_n_messages  int  not null default 6,
  updated_at                timestamptz not null default now()
);
alter table arkan.chat_settings enable row level security;

insert into arkan.chat_settings (id)
select gen_random_uuid()
where not exists (select 1 from arkan.chat_settings);

-- ── ۷) rate limit پایدار ─────────────────────────────────────────
-- نسخه‌ی درون‌حافظه‌ای روی Vercel بی‌اثر است (هر instance مپ خودش را دارد).
create table if not exists arkan.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);
alter table arkan.rate_limits enable row level security;

-- شمارنده‌ی اتمیک: مقدار جدید شمارنده در پنجره‌ی جاری را برمی‌گرداند.
create or replace function arkan.bump_rate_limit(
  p_key text,
  p_window_seconds int default 60
)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  -- نام مستعار لازم است: داخل ON CONFLICT نمی‌توان جدول را با نام اسکیما ارجاع داد.
  insert into arkan.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count        = case
                         when rl.window_start < now() - make_interval(secs => p_window_seconds)
                         then 1
                         else rl.count + 1
                       end,
        window_start = case
                         when rl.window_start < now() - make_interval(secs => p_window_seconds)
                         then now()
                         else rl.window_start
                       end
  returning rl.count into v_count;

  return v_count;
end;
$$;

-- ── ۸) دسترسی نقش سرویس + بارگذاری مجدد اسکیمای PostgREST ────────
-- روی نصب self-hosted، جدول‌های تازه‌ساخته‌شده به‌صورت خودکار برای
-- service_role مجاز نمی‌شوند و کش اسکیمای PostgREST هم به‌روز نمی‌شود.
grant usage on schema arkan to service_role;
grant all on arkan.unanswered_questions to service_role;
grant all on arkan.chat_settings        to service_role;
grant all on arkan.rate_limits          to service_role;
grant execute on function arkan.bump_rate_limit(text, int) to service_role;

notify pgrst, 'reload schema';

-- پاک‌سازی ردیف‌های کهنه (اختیاری؛ هر وقت خواستید دستی اجرا کنید)
-- delete from arkan.rate_limits where window_start < now() - interval '1 day';
