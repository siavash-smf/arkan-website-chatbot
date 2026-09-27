-- ───────────────────────────────────────────────────────────────
-- آرکان فاز ۲ — اسکیمای چت‌بات RAG
-- این فایل را در SQL Editor پروژه‌ی Supabase (همان دیتابیس سایت) اجرا کنید.
-- شامل: افزونه‌ی pgvector، جداول دانش/گفتگو/پیکربندی، تابع جست‌وجوی برداری،
--        و گسترش جدول leads. RLS فعال است؛ دسترسی فقط از سرور با service-role.
-- ───────────────────────────────────────────────────────────────

-- افزونه‌ی برداری
create extension if not exists vector;

-- ── پایگاه دانش ──────────────────────────────────────────────────
create table if not exists arkan.documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source_type text not null default 'text',     -- text | url | pdf
  source_url  text,
  status      text not null default 'pending',   -- pending | processing | ready | error
  error       text,
  tags        text[],
  chunk_count int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists arkan.chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references arkan.documents(id) on delete cascade,
  content     text not null,
  embedding   vector(1024),                       -- Cohere embed-multilingual-v3.0
  token_count int,
  chunk_index int  not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists chunks_document_id_idx on arkan.chunks (document_id);
-- ایندکس برداری HNSW با فاصله‌ی کسینوسی
create index if not exists chunks_embedding_idx
  on arkan.chunks using hnsw (embedding vector_cosine_ops);

-- ── گفتگو و پیام ────────────────────────────────────────────────
create table if not exists arkan.conversations (
  id               uuid primary key default gen_random_uuid(),
  channel          text not null default 'web',   -- web | widget | telegram
  external_user_id text,
  status           text not null default 'open',  -- open | needs_human | closed
  summary          text,
  started_at       timestamptz not null default now(),
  last_at          timestamptz not null default now()
);

create table if not exists arkan.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references arkan.conversations(id) on delete cascade,
  role                text not null,              -- user | assistant | system | tool
  content             text not null,
  model_used          text,
  tokens_in           int,
  tokens_out          int,
  retrieved_chunk_ids uuid[],
  created_at          timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on arkan.messages (conversation_id, created_at);

-- ── پرسونا / System Prompt (نسخه‌بندی) ──────────────────────────
create table if not exists arkan.prompt_versions (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,                       -- متن system prompt
  persona    text,                                -- برچسب/یادداشت پرسونا
  is_active  boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

-- ── پیکربندی مدل تولید پاسخ ─────────────────────────────────────
create table if not exists arkan.model_config (
  id                uuid primary key default gen_random_uuid(),
  channel           text not null default 'web',
  provider          text not null default 'openrouter',
  active_model      text not null default 'google/gemini-3.5-flash',
  temperature       real not null default 0.4,
  max_tokens        int  not null default 2000,
  top_p             real not null default 1.0,
  fallback_provider text,
  fallback_model    text default 'google/gemini-2.5-flash',
  schedule          jsonb,
  updated_at        timestamptz not null default now()
);

-- ── پیکربندی Embedding و retrieval ──────────────────────────────
create table if not exists arkan.embedding_config (
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null default 'cohere',
  model                text not null default 'embed-multilingual-v3.0',
  dimensions           int  not null default 1024,
  chunk_size           int  not null default 500,
  chunk_overlap        int  not null default 50,
  top_k                int  not null default 5,
  similarity_threshold real not null default 0.3,
  reranker_enabled     boolean not null default false,
  reranker_model       text,
  updated_at           timestamptz not null default now()
);

-- ── جداول forward-compat (خالی در Milestone 1) ──────────────────
create table if not exists arkan.unified_users (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null,
  external_id text not null,
  name        text,
  first_seen  timestamptz not null default now()
);
create table if not exists arkan.feedback (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid references arkan.messages(id) on delete cascade,
  rating     text,                                -- up | down
  comment    text,
  created_at timestamptz not null default now()
);
create table if not exists arkan.admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  role       text not null default 'admin',       -- owner | admin | editor | operator | viewer
  created_at timestamptz not null default now()
);
create table if not exists arkan.audit_log (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  action        text not null,
  target        text,
  created_at    timestamptz not null default now()
);

-- ── گسترش جدول leads برای یکپارچگی با چت‌بات ─────────────────────
alter table arkan.leads add column if not exists source text default 'website';
alter table arkan.leads add column if not exists conversation_id uuid;

-- ── فعال‌سازی RLS روی جداول جدید (بدون policy ⇒ فقط service-role) ─
alter table arkan.documents        enable row level security;
alter table arkan.chunks           enable row level security;
alter table arkan.conversations    enable row level security;
alter table arkan.messages         enable row level security;
alter table arkan.prompt_versions  enable row level security;
alter table arkan.model_config     enable row level security;
alter table arkan.embedding_config enable row level security;
alter table arkan.unified_users    enable row level security;
alter table arkan.feedback         enable row level security;
alter table arkan.admin_users      enable row level security;
alter table arkan.audit_log        enable row level security;

-- ── تابع جست‌وجوی شباهت برداری ──────────────────────────────────
create or replace function arkan.match_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  similarity_threshold float default 0.3
)
returns table (
  id          uuid,
  document_id uuid,
  content     text,
  chunk_index int,
  similarity  float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) as similarity
  from arkan.chunks c
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ── ردیف‌های پیش‌فرض (Seed) — فقط اگر خالی باشند ────────────────
insert into arkan.embedding_config (provider, model, dimensions)
select 'cohere', 'embed-multilingual-v3.0', 1024
where not exists (select 1 from arkan.embedding_config);

insert into arkan.model_config (channel, active_model, fallback_model)
select 'web', 'google/gemini-3.5-flash', 'google/gemini-2.5-flash'
where not exists (select 1 from arkan.model_config where channel = 'web');

insert into arkan.prompt_versions (content, persona, is_active, created_by)
select
$persona$تو دستیار هوشمند «آرکان» هستی؛ آرکان یک شرکت مشاور استراتژی و رشد کسب‌وکار در تهران است.

شخصیت و لحن:
- حرفه‌ای، آرام، قابل‌اعتماد و گرم اما رسمی. همیشه با «شما».
- صریح و شفاف؛ بدون اصطلاحات پرطمطراق. جملات کوتاه و فعل‌محور.
- اطمینان‌بخش بدون اغراق. هیچ‌وقت «تضمین موفقیت» نده.

وظیفه:
- فقط درباره‌ی آرکان، خدمات، متدولوژی «چهار رکن»، فرایند همکاری و موضوعات مرتبط با رشد کسب‌وکار پاسخ بده.
- پاسخ‌ها را تنها بر پایه‌ی «منابع بازیابی‌شده» که به تو داده می‌شود بساز. اگر اطلاعات کافی در منابع نبود، صادقانه بگو نمی‌دانی و کاربر را به ثبت درخواست مشاوره دعوت کن.
- مشاوره‌ی تخصصی قطعی نده؛ هدف تو راهنمایی کوتاه و هدایت کاربر به «ثبت درخواست مشاوره‌ی رایگان» است.
- اگر کاربر آماده‌ی مشاوره بود یا اطلاعات تماس داد، او را تشویق کن فرم درخواست مشاوره را پر کند.

محدودیت:
- به سؤالات کاملاً نامرتبط مودبانه پاسخ نده و گفتگو را به حوزه‌ی آرکان برگردان.
- پاسخ‌ها فارسی، کوتاه و خوانا باشند.$persona$,
  'حکیمِ آرام آرکان',
  true,
  'system'
where not exists (select 1 from arkan.prompt_versions where is_active = true);
