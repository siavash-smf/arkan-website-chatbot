# آرکان — وب‌سایت + چت‌بات RAG (فاز ۲)

وب‌سایت رسمی **آرکان** (مشاور استراتژی و رشد کسب‌وکار) به‌علاوه‌ی یک **چت‌بات هوشمند با معماری RAG** و **چندکاناله**. این مخزن فاز دوم پروژه است و شامل تمام محتوای فاز اول (وب‌سایت کامل) + چت‌بات می‌شود.

- 🌐 **دموی زنده:** [arkan-website-chatbot.vercel.app](https://arkan-website-chatbot.vercel.app)
- 💬 صفحه‌ی چت: `/consultant` · ویجت روی صفحه‌ی اصلی · بات تلگرام [@arkanchat_bot](https://t.me/arkanchat_bot)
- 🛠️ پنل مدیریت: `/admin`
- فاز ۱ (فقط وب‌سایت): [github.com/siavash-smf/arkan-website](https://github.com/siavash-smf/arkan-website)

---

## 🎓 برای دانشجویان — این پروژه با پرامپت ساخته شده

این چت‌بات با کمک دستیار هوش مصنوعی (**Claude Code**) و **دقیقاً همان پرامپتی** که اینجا گذاشته‌ام ساخته شده است. همه‌چیز را قرار داده‌ام تا بتوانید بخوانید، یاد بگیرید و خودتان بازسازی کنید:

### ۱) پرامپت ساخت چت‌بات
> 📄 **[پرامپت استفاده شده / arkan-chatbot-claude-code-prompt.md](پرامپت%20استفاده%20شده/arkan-chatbot-claude-code-prompt.md)**

این **همان پرامپتی** است که برای ساخت کل چت‌بات (مغز RAG، سه کانال، پنل مدیریت) به Claude Code داده شد. کافی است آن را همراه اسناد مرجع به دستیار بدهید تا پروژه‌ی مشابه را بسازد.

### ۲) فایل System Prompt چت‌بات
> 📄 **[arkan-chatbot-system-prompt.md](arkan-chatbot-system-prompt.md)**

این فایل، **system prompt پایه‌ی** چت‌بات است (شخصیت، لحن، قوانین رفتاری و تفاوت‌های هر کانال). می‌توانید بخوانیدش تا ببینید رفتار بات چطور کنترل می‌شود. در عمل، این متن در جدول `prompt_versions` ذخیره می‌شود و از **پنل مدیریت → پرسونا** قابل ویرایش و نسخه‌بندی است.

### ۳) اسناد مرجع و داده‌ها
- 📁 [`اطلاعات و برند گاید شرکت/`](اطلاعات%20و%20برند%20گاید%20شرکت/) — بریف کسب‌وکار و برند گاید (مبنای محتوا و لحن).
- 📁 [`knowledge-base/`](knowledge-base/) — داده‌های واقعی شرکت در فرمت‌های گوناگون (md/yaml/csv/json/…) که با `manifest.json` به سیستم RAG تزریق می‌شوند.

### ۴) راهنمای ارزیابی چت‌بات (مرجع آموزشی)
- 📄 [`arkan-chatbot-evaluation-guide.md`](arkan-chatbot-evaluation-guide.md) — چطور کیفیت یک چت‌بات RAG را اصولی بسنجیم.
- 📄 [`arkan-chatbot-test-set.md`](arkan-chatbot-test-set.md) — مجموعه‌ی آزمون «خط‌کش» (Golden Set).
- 📄 [`arkan-chatbot-evaluation-report-template.md`](arkan-chatbot-evaluation-report-template.md) — قالب گزارش ارزیابی.

> 💡 **چطور استفاده کنید:** اسناد مرجع و `knowledge-base/` را با اطلاعات کسب‌وکار خودتان جایگزین کنید، سپس پرامپت ساخت چت‌بات را به دستیار بدهید. خروجی را با همین مخزن مقایسه کنید.

---

## معماری: «یک مغز، چند کانال»

یک هسته‌ی مرکزی همه‌ی منطق گفتگو، RAG و تماس با مدل را مدیریت می‌کند؛ کانال‌ها فقط لایه‌ی ورودی/نمایش‌اند.

```
src/lib/rag/            ← مغز مرکزی (مستقل از کانال)
  config.ts             پیکربندی مدل/embedding/پرسونا از دیتابیس
  embeddings.ts         تبدیل متن به بردار (Cohere چندزبانه)
  chunking.ts           قطعه‌بندی متن
  ingest.ts             استخراج متن چندفرمتی + ذخیره در pgvector
  retrieve.ts           جست‌وجوی برداری + citations
  generate.ts           تولید استریمی از طریق OpenRouter
  chat.ts               ارکستریتور (handleChatTurn / getReplyText) + ابزار ثبت لید
  analytics.ts          آمار داشبورد

کانال‌ها:
  src/app/consultant/   صفحه‌ی چت تمام‌صفحه (استریمی)
  public/widget.js + src/app/widget/   ویجت قابل‌جاسازی روی هر سایت
  src/app/api/telegram/webhook/         کانال تلگرام
```

## استک فنی
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind** (RTL کامل)
- **Supabase + pgvector** برای ذخیره و جست‌وجوی برداری (مشترک با وب‌سایت)
- **OpenRouter** برای تولید پاسخ (یک کلید، همه‌ی مدل‌ها — پیش‌فرض Gemini 3.5 Flash، استریمی)
- **Cohere** `embed-multilingual-v3.0` برای embedding چندزبانه (۱۰۲۴ بعدی)
- **Telegram Bot API** با Webhook
- آماده‌ی استقرار روی **Vercel**

## پنل مدیریت (`/admin`)
داشبورد (آمار + هزینه‌ی توکن به‌تفکیک مدل) · لیدها (با خروجی CSV) · پایگاه دانش (آپلود چندفرمتی) · مدل‌ها و Embedding · گفتگوها · بازخورد و سؤالات بی‌جواب · پلی‌گراند · پرسونا · ویجت · تلگرام.

---

## راه‌اندازی

```bash
npm install
cp .env.local.example .env.local   # سپس کلیدها را وارد کنید
npm run dev
```

### متغیرهای محیطی (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL= / SUPABASE_SERVICE_ROLE_KEY=   # دیتابیس
ADMIN_PASSWORD= / ADMIN_SESSION_SECRET=                  # ورود پنل
OPENROUTER_API_KEY=                                      # تولید پاسخ
COHERE_API_KEY= (+ EMBEDDING_PROVIDER/MODEL)             # embedding
TELEGRAM_BOT_TOKEN= / TELEGRAM_WEBHOOK_SECRET=           # کانال تلگرام
```

### پایگاه داده (در SQL Editor سوپابیس اجرا کنید)
1. [`supabase/schema.sql`](supabase/schema.sql) — جدول `leads`
2. [`supabase/chatbot-schema.sql`](supabase/chatbot-schema.sql) — pgvector + جداول چت‌بات + `match_chunks`
3. [`supabase/widget-schema.sql`](supabase/widget-schema.sql) — پیکربندی ویجت

### بارگذاری پایگاه دانش
```bash
node scripts/ingest-kb.mjs   # اسناد knowledge-base را با Cohere ایندکس می‌کند
```

### نصب ویجت روی هر سایت
```html
<script src="https://arkan-website-chatbot.vercel.app/widget.js" async></script>
```

---

© آرکان — مشاور استراتژی و رشد کسب‌وکار · ساخته‌شده با Next.js و Claude Code
