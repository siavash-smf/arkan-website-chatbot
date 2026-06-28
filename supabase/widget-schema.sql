-- ───────────────────────────────────────────────────────────────
-- آرکان فاز ۲ / M2 — اسکیمای ویجت قابل‌جاسازی
-- در SQL Editor همان پروژه‌ی Supabase اجرا کنید.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.widget_config (
  id              uuid primary key default gen_random_uuid(),
  enabled         boolean not null default true,
  primary_color   text not null default '#143A32',
  position        text not null default 'left',     -- left | right
  welcome_message text not null default 'سلام! من دستیار هوشمند آرکان هستم. چطور می‌توانم درباره‌ی خدمات و رشد کسب‌وکارتان کمک کنم؟',
  launcher_text   text not null default 'گفت‌وگو با مشاور',
  allowed_domains text[] not null default '{}',     -- خالی ⇒ همه‌ی دامنه‌ها مجاز
  updated_at      timestamptz not null default now()
);

alter table public.widget_config enable row level security;

-- یک ردیف پیش‌فرض (فقط اگر خالی باشد)
insert into public.widget_config (enabled)
select true
where not exists (select 1 from public.widget_config);
