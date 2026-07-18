#!/usr/bin/env node
/**
 * بارگذاری داده‌ی نمایشی (دمو) در CRM آرکان — برای ارائه به دانشجویان.
 *
 * چه چیزی ساخته می‌شود:
 *  - ۱۰ شرکت + ۱۴ مخاطب ایرانی خیالی (همه با یادداشت «[داده نمایشی]»)
 *  - ۸ لید نمایشی: ۳ تازه (برای دموی «تبدیل به مخاطب») + ۵ تبدیل‌شده
 *  - ۲ گفتگوی چت‌بات با پیام واقعی‌نما و متصل به مخاطب (برای دموی خلاصه‌سازی AI)
 *  - ۲۱ معامله در همه‌ی مراحل کانبان: ۱۲ باز، ۶ برد (پخش در ۶ ماه برای نمودار درآمد)، ۳ باخت
 *  - ~۲۸ فعالیت: انجام‌شده، معوق (قرمز)، امروز، و آینده + رویدادهای تغییر مرحله
 *
 * اجرا (از ریشه‌ی پروژه):  node scripts/seed-crm-demo.mjs
 * پاک‌سازی:                node scripts/seed-crm-demo.mjs --clean
 *
 * ایمن در برابر اجرای دوباره: اگر شرکت نشانه‌دار دمو موجود باشد، بدون --clean اجرا نمی‌شود.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_TAG = "[داده نمایشی]";

// ── env از .env.local ──
function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  const env = {};
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
    }
  }
  return env;
}
const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const now = Date.now();
const day = 86400000;
const daysAgo = (n) => new Date(now - n * day).toISOString();
const daysAhead = (n) => new Date(now + n * day).toISOString();
const SEED_BY = "demo-seed";

async function insert(table, rows) {
  const { data, error } = await supabase.from(table).insert(rows).select("id");
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.map((r) => r.id);
}

// ── پاک‌سازی داده‌ی دمو ──
async function clean() {
  console.log("🧹 پاک‌سازی داده‌ی نمایشی…");
  // فعالیت‌ها و معاملات با cascade مخاطب پاک می‌شوند؛ ترتیب: لید ← مخاطب ← شرکت ← گفتگو
  await supabase.from("activities").delete().eq("created_by", SEED_BY);
  const { data: demoContacts } = await supabase.from("contacts").select("id").eq("notes", DEMO_TAG);
  if (demoContacts?.length) {
    const ids = demoContacts.map((c) => c.id);
    await supabase.from("leads").delete().in("contact_id", ids); // لیدهای تبدیل‌شده‌ی دمو
    await supabase.from("contacts").delete().in("id", ids);
  }
  await supabase.from("leads").delete().eq("preferred_time", DEMO_TAG);
  await supabase.from("companies").delete().eq("notes", DEMO_TAG);
  const { data: demoConvs } = await supabase
    .from("conversations")
    .select("id")
    .eq("external_user_id", SEED_BY);
  if (demoConvs?.length) {
    await supabase.from("conversations").delete().in("id", demoConvs.map((c) => c.id));
  }
  console.log("✅ داده‌ی نمایشی پاک شد.");
}

async function main() {
  if (process.argv.includes("--clean")) return clean();

  const { data: marker } = await supabase
    .from("companies")
    .select("id")
    .eq("notes", DEMO_TAG)
    .limit(1);
  if (marker?.length) {
    console.log("⚠️ داده‌ی نمایشی از قبل موجود است. برای بارگذاری دوباره اول: node scripts/seed-crm-demo.mjs --clean");
    process.exit(1);
  }

  // ── ۱) شرکت‌ها ──────────────────────────────────────────────────
  console.log("🏢 ساخت شرکت‌ها…");
  const companies = [
    { name: "صنایع غذایی برکت", industry: "تولید مواد غذایی", city: "تهران", size_label: "۵۱-۲۰۰", website: "barakatfood.ir" },
    { name: "پوشاک آنیل", industry: "پوشاک و مد", city: "تهران", size_label: "۱۱-۵۰", website: "anilstyle.ir" },
    { name: "فروشگاه اینترنتی زیوران", industry: "تجارت الکترونیک", city: "تهران", size_label: "۱۱-۵۰", website: "zivaran.com" },
    { name: "کلینیک زیبایی آرنیکا", industry: "سلامت و زیبایی", city: "شیراز", size_label: "۱۱-۵۰" },
    { name: "آموزشگاه زبان روژان", industry: "آموزش", city: "تبریز", size_label: "۱۱-۵۰", website: "rozhanlang.ir" },
    { name: "استارتاپ لجستیک تیزرو", industry: "حمل‌ونقل و لجستیک", city: "تهران", size_label: "۱۱-۵۰", website: "tizro.app" },
    { name: "آژانس دیجیتال مارکتینگ نوند", industry: "تبلیغات و بازاریابی", city: "اصفهان", size_label: "۱-۱۰", website: "navandagency.ir" },
    { name: "تولیدی مبلمان چوبینه", industry: "مبلمان و دکوراسیون", city: "مشهد", size_label: "۵۱-۲۰۰" },
    { name: "زنجیره‌ی کافه دمنوش", industry: "رستوران و کافه", city: "تهران", size_label: "۱۱-۵۰", website: "damnooshcafe.ir" },
    { name: "هلدینگ ساختمانی آبان‌سازه", industry: "ساختمان و املاک", city: "کرج", size_label: "۲۰۰+" },
  ].map((c) => ({ ...c, notes: DEMO_TAG }));
  const companyIds = await insert("companies", companies);
  const co = Object.fromEntries(companies.map((c, i) => [c.name, companyIds[i]]));

  // ── ۲) مخاطبان ──────────────────────────────────────────────────
  console.log("👤 ساخت مخاطبان…");
  const contacts = [
    { full_name: "محمدرضا کریمی", position: "مدیرعامل", phone: "09121234501", email: "karimi@barakatfood.ir", company: "صنایع غذایی برکت", source: "website" },
    { full_name: "الهام رستگار", position: "مدیر بازرگانی", phone: "09121234502", email: "rastegar@barakatfood.ir", company: "صنایع غذایی برکت", source: "manual" },
    { full_name: "نسترن قاسمی", position: "بنیان‌گذار", phone: "09121234503", email: "n.ghasemi@anilstyle.ir", company: "پوشاک آنیل", source: "chatbot" },
    { full_name: "آرش نعمتی", position: "هم‌بنیان‌گذار و مدیر عملیات", phone: "09121234504", email: "arash@zivaran.com", company: "فروشگاه اینترنتی زیوران", source: "website" },
    { full_name: "دکتر شیوا مرادی", position: "مؤسس", phone: "09171234505", email: "dr.moradi@arnika.clinic", company: "کلینیک زیبایی آرنیکا", source: "chatbot" },
    { full_name: "بابک تقی‌زاده", position: "مدیر آموزشگاه", phone: "09141234506", email: "b.taghizadeh@rozhanlang.ir", company: "آموزشگاه زبان روژان", source: "website" },
    { full_name: "سپهر یوسفی", position: "مدیرعامل", phone: "09121234507", email: "sepehr@tizro.app", company: "استارتاپ لجستیک تیزرو", source: "manual" },
    { full_name: "غزل شریفی", position: "مدیر رشد", phone: "09121234508", email: "ghazal@tizro.app", company: "استارتاپ لجستیک تیزرو", source: "manual" },
    { full_name: "امیرحسین صادقی", position: "مدیر آژانس", phone: "09131234509", email: "amir@navandagency.ir", company: "آژانس دیجیتال مارکتینگ نوند", source: "website" },
    { full_name: "حاج قاسم موحدی", position: "مالک", phone: "09151234510", email: null, company: "تولیدی مبلمان چوبینه", source: "manual" },
    { full_name: "لیلا پناهی", position: "مدیر توسعه‌ی شعب", phone: "09121234511", email: "l.panahi@damnooshcafe.ir", company: "زنجیره‌ی کافه دمنوش", source: "chatbot" },
    { full_name: "مهندس فرهاد عظیمی", position: "معاون برنامه‌ریزی", phone: "09121234512", email: "azimi@abansazeh.ir", company: "هلدینگ ساختمانی آبان‌سازه", source: "website" },
    { full_name: "سارا محبی", position: "مدیر فروشگاه آنلاین", phone: "09121234513", email: "sara@anilstyle.ir", company: "پوشاک آنیل", source: "manual" },
    { full_name: "کاوه رحیمی", position: "مشاور سرمایه‌گذار", phone: "09121234514", email: "kaveh.r@gmail.com", company: null, source: "manual" },
  ];
  const contactRows = contacts.map((c) => ({
    full_name: c.full_name,
    position: c.position,
    phone: c.phone,
    email: c.email,
    company_id: c.company ? co[c.company] : null,
    source: c.source,
    notes: DEMO_TAG,
  }));
  const contactIds = await insert("contacts", contactRows);
  const ct = Object.fromEntries(contacts.map((c, i) => [c.full_name, contactIds[i]]));

  // ── ۳) گفتگوهای چت‌بات (برای دموی خلاصه‌سازی AI) ─────────────────
  console.log("💬 ساخت گفتگوهای چت‌بات…");
  const convIds = await insert("conversations", [
    { channel: "widget", external_user_id: SEED_BY, status: "closed", started_at: daysAgo(9), last_at: daysAgo(9) },
    { channel: "web", external_user_id: SEED_BY, status: "closed", started_at: daysAgo(4), last_at: daysAgo(4) },
  ]);
  const conv1 = [
    ["user", "سلام. ما یک برند پوشاک هستیم و فروش حضوری‌مان خوب است ولی فروش آنلاین تقریباً صفر است."],
    ["assistant", "سلام، خوش آمدید. برای اینکه بهتر راهنمایی‌تان کنم، الان فروش آنلاین از چه کانالی انجام می‌شود؟"],
    ["user", "فقط اینستاگرام داریم با حدود ۴۰ هزار فالوور، ولی سفارش‌ها از دایرکت است و خیلی وقت‌گیر و پراکنده."],
    ["assistant", "پس چالش اصلی، تبدیل مخاطب اینستاگرام به فروش ساخت‌یافته است. آیا سایت فروشگاهی دارید؟"],
    ["user", "سایت داریم ولی به‌روز نیست. راستش نمی‌دانیم اول باید سایت را درست کنیم یا تیم فروش استخدام کنیم. بودجه هم محدود است، شاید ماهی ۵۰ میلیون برای این کار."],
    ["assistant", "این دقیقاً از جنس تصمیم‌های استراتژیک است که در متدولوژی «چهار رکن» آرکان بررسی می‌شود. پیشنهاد می‌کنم یک جلسه‌ی مشاوره‌ی رایگان ثبت کنید تا اولویت‌بندی درست انجام شود."],
    ["user", "باشه، من نسترن قاسمی هستم، بنیان‌گذار پوشاک آنیل. شماره‌ام را می‌گذارم، لطفاً هماهنگ کنید."],
  ];
  const conv2 = [
    ["user", "سلام، برای توسعه‌ی شعب جدید کافه سؤال داشتم."],
    ["assistant", "سلام، حتماً. الان چند شعبه دارید و برنامه‌تان چیست؟"],
    ["user", "سه شعبه در تهران داریم که دوتایش سودده است. می‌خواهیم تا دو سال آینده به ۱۰ شعبه برسیم، ولی نمی‌دانیم با سرمایه‌ی خودمان بزنیم یا فرانچایز بدهیم."],
    ["assistant", "تصمیم بین رشد مستقیم و فرانچایز به ساختار مالی، برند و توان عملیاتی شما بستگی دارد. تیم آرکان در فاز شناخت، هر دو سناریو را مدل می‌کند."],
    ["user", "هزینه‌ی همکاری با شما حدوداً چقدر است؟ و چقدر طول می‌کشد؟"],
    ["assistant", "بسته به دامنه‌ی کار متفاوت است و بعد از جلسه‌ی شناخت مشخص می‌شود؛ پروژه‌های توسعه‌ی شبکه معمولاً ۳ تا ۶ ماه زمان می‌برد. مایلید جلسه‌ی رایگان اولیه را ثبت کنم؟"],
    ["user", "بله. لیلا پناهی هستم، مدیر توسعه‌ی شعب دمنوش."],
  ];
  const msgRows = [];
  convIds.forEach((cid, i) => {
    const msgs = i === 0 ? conv1 : conv2;
    const base = i === 0 ? 9 : 4;
    msgs.forEach(([role, content], j) => {
      msgRows.push({
        conversation_id: cid,
        role,
        content,
        created_at: new Date(now - base * day + j * 60000).toISOString(),
      });
    });
  });
  await insert("messages", msgRows);
  // اتصال گفتگو به مخاطب‌های chatbot
  await supabase.from("contacts").update({ conversation_id: convIds[0] }).eq("id", ct["نسترن قاسمی"]);
  await supabase.from("contacts").update({ conversation_id: convIds[1] }).eq("id", ct["لیلا پناهی"]);

  // ── ۴) لیدها ────────────────────────────────────────────────────
  console.log("🎯 ساخت لیدها…");
  // ۳ لید تازه — برای دموی زنده‌ی «امتیازدهی AI» و «تبدیل به مخاطب» سر کلاس
  await insert("leads", [
    {
      full_name: "پریسا نوروزی", phone: "09122234515", email: "parisa.norouzi@gmail.com",
      business_name: "شیرینی‌سرای نوروزی", industry: "قنادی و شیرینی", stage: "در حال رشد",
      challenge: "دو شعبه داریم و تقاضای سفارش آنلاین زیاد شده، ولی هیچ سیستم ثبت سفارش و ارسال نداریم و مشتری‌ها را در واتساپ گم می‌کنیم.",
      status: "new", source: "website", preferred_time: DEMO_TAG,
    },
    {
      full_name: "میلاد جوانمرد", phone: "09352234516", email: null,
      business_name: "باشگاه ورزشی اوج", industry: "ورزش و تناسب اندام", stage: "تثبیت‌شده",
      challenge: "باشگاه پر است ولی حاشیه سود کم شده؛ هزینه‌ها بالا رفته و نمی‌دانیم قیمت‌گذاری اشتباه است یا ساختار هزینه.",
      status: "new", source: "chatbot", preferred_time: DEMO_TAG,
    },
    {
      full_name: "رویا احدی", phone: "09192234517", email: "roya.ahadi@yahoo.com",
      business_name: "گالری صنایع دستی روژین", industry: "صنایع دستی", stage: "ایده",
      challenge: "می‌خواهم صنایع دستی زنان روستای‌مان را صادر کنم ولی نمی‌دانم از کجا شروع کنم.",
      status: "new", source: "website", preferred_time: DEMO_TAG,
    },
  ]);
  // ۵ لید تبدیل‌شده — با امتیاز AI ازپیش‌ثبت‌شده تا چیپ امتیاز دیده شود
  const convertedLeads = [
    { contact: "نسترن قاسمی", business: "پوشاک آنیل", industry: "پوشاک و مد", stage: "در حال رشد", source: "chatbot", conv: convIds[0], score: 82, rationale: "چالش مشخص (تبدیل فالوور به فروش آنلاین)، بودجه‌ی اعلام‌شده و کسب‌وکار فعال با فروش حضوری اثبات‌شده.", ago: 9, status: "scheduled" },
    { contact: "لیلا پناهی", business: "زنجیره‌ی کافه دمنوش", industry: "رستوران و کافه", stage: "تثبیت‌شده", source: "chatbot", conv: convIds[1], score: 88, rationale: "کسب‌وکار سودده با برنامه‌ی رشد روشن (۳ به ۱۰ شعبه) و تصمیم استراتژیک مشخص؛ سیگنال خرید قوی.", ago: 4, status: "contacted" },
    { contact: "محمدرضا کریمی", business: "صنایع غذایی برکت", industry: "تولید مواد غذایی", stage: "تثبیت‌شده", source: "website", conv: null, score: 91, rationale: "شرکت تثبیت‌شده با ۱۵۰ پرسنل و مسئله‌ی استراتژیک ورود به بازار صادرات؛ اطلاعات تماس کامل.", ago: 45, status: "won" },
    { contact: "آرش نعمتی", business: "فروشگاه اینترنتی زیوران", industry: "تجارت الکترونیک", stage: "در حال رشد", source: "website", conv: null, score: 75, rationale: "رشد سریع و درد مشخص در عملیات و انبار؛ نیاز به بررسی توان مالی.", ago: 30, status: "scheduled" },
    { contact: "دکتر شیوا مرادی", business: "کلینیک زیبایی آرنیکا", industry: "سلامت و زیبایی", stage: "در حال رشد", source: "chatbot", conv: null, score: 68, rationale: "علاقه‌مند به برندینگ و جذب بیمار؛ زمان تماس اعلام نشده و فوریت نامشخص.", ago: 21, status: "contacted" },
  ];
  for (const l of convertedLeads) {
    await insert("leads", [{
      full_name: l.contact, phone: "0912000" + Math.floor(1000 + Math.random() * 9000),
      email: null, business_name: l.business, industry: l.industry, stage: l.stage,
      challenge: "ثبت‌شده از مسیر " + (l.source === "chatbot" ? "چت‌بات" : "فرم سایت") + " — " + DEMO_TAG,
      status: l.status, source: l.source, conversation_id: l.conv, preferred_time: DEMO_TAG,
      converted_at: daysAgo(l.ago - 1), contact_id: ct[l.contact],
      ai_score: l.score, ai_score_rationale: l.rationale, ai_scored_at: daysAgo(l.ago),
      created_at: daysAgo(l.ago),
    }]);
  }

  // ── ۵) معاملات ──────────────────────────────────────────────────
  console.log("💼 ساخت معاملات…");
  const M = 1000000;
  const deals = [
    // باز — پخش در ۵ مرحله (stage_entered_at متفاوت برای «روز در مرحله»)
    { title: "مشاوره راه‌اندازی فروش آنلاین — آنیل", contact: "نسترن قاسمی", company: "پوشاک آنیل", stage: "meeting", amount: 180 * M, entered: 2, close: 20 },
    { title: "استراتژی توسعه شعب — دمنوش", contact: "لیلا پناهی", company: "زنجیره‌ی کافه دمنوش", stage: "qualifying", amount: 350 * M, entered: 1, close: 35 },
    { title: "بهینه‌سازی عملیات و انبار — زیوران", contact: "آرش نعمتی", company: "فروشگاه اینترنتی زیوران", stage: "proposal", amount: 240 * M, entered: 6, close: 15 },
    { title: "برندینگ و جذب بیمار — آرنیکا", contact: "دکتر شیوا مرادی", company: "کلینیک زیبایی آرنیکا", stage: "meeting", amount: 120 * M, entered: 9, close: 25 },
    { title: "طرح رشد و فرانچایز — روژان", contact: "بابک تقی‌زاده", company: "آموزشگاه زبان روژان", stage: "new", amount: 90 * M, entered: 3, close: 40 },
    { title: "مشاوره جذب سرمایه سری A — تیزرو", contact: "سپهر یوسفی", company: "استارتاپ لجستیک تیزرو", stage: "negotiation", amount: 420 * M, entered: 12, close: 10 },
    { title: "بازطراحی قیف فروش — نوند", contact: "امیرحسین صادقی", company: "آژانس دیجیتال مارکتینگ نوند", stage: "qualifying", amount: 75 * M, entered: 4, close: 30 },
    { title: "ورود به بازار آنلاین — چوبینه", contact: "حاج قاسم موحدی", company: "تولیدی مبلمان چوبینه", stage: "proposal", amount: 210 * M, entered: 15, close: 12 },
    { title: "استراتژی برند کارفرمایی — آبان‌سازه", contact: "مهندس فرهاد عظیمی", company: "هلدینگ ساختمانی آبان‌سازه", stage: "new", amount: 160 * M, entered: 1, close: 45 },
    { title: "فاز دوم: پیاده‌سازی CRM فروش — برکت", contact: "الهام رستگار", company: "صنایع غذایی برکت", stage: "negotiation", amount: 280 * M, entered: 7, close: 8 },
    { title: "مشاوره سبد سرمایه‌گذاری — رحیمی", contact: "کاوه رحیمی", company: null, stage: "meeting", amount: 60 * M, entered: 5, close: 18 },
    { title: "راه‌اندازی فروش سازمانی — آنیل", contact: "سارا محبی", company: "پوشاک آنیل", stage: "new", amount: 110 * M, entered: 2, close: 50 },
    // برد — پخش در ۶ ماه گذشته برای نمودار درآمد ماهانه
    { title: "استراتژی ورود به صادرات — برکت", contact: "محمدرضا کریمی", company: "صنایع غذایی برکت", stage: "won", amount: 450 * M, won: 12 },
    { title: "فاز شناخت چهار رکن — تیزرو", contact: "سپهر یوسفی", company: "استارتاپ لجستیک تیزرو", stage: "won", amount: 150 * M, won: 40 },
    { title: "بازطراحی مدل درآمدی — روژان", contact: "بابک تقی‌زاده", company: "آموزشگاه زبان روژان", stage: "won", amount: 200 * M, won: 70 },
    { title: "مشاوره برندینگ مجدد — آرنیکا", contact: "دکتر شیوا مرادی", company: "کلینیک زیبایی آرنیکا", stage: "won", amount: 95 * M, won: 100 },
    { title: "طرح تحول دیجیتال — آبان‌سازه", contact: "مهندس فرهاد عظیمی", company: "هلدینگ ساختمانی آبان‌سازه", stage: "won", amount: 380 * M, won: 130 },
    { title: "استراتژی محتوا و فروش — نوند", contact: "امیرحسین صادقی", company: "آژانس دیجیتال مارکتینگ نوند", stage: "won", amount: 85 * M, won: 160 },
    // باخت — با دلیل
    { title: "مشاوره توسعه محصول — زیوران", contact: "آرش نعمتی", company: "فروشگاه اینترنتی زیوران", stage: "lost", amount: 130 * M, lost: 55, reason: "بودجه به پروژه‌ی فنی داخلی اختصاص یافت." },
    { title: "برنامه وفاداری مشتریان — دمنوش", contact: "لیلا پناهی", company: "زنجیره‌ی کافه دمنوش", stage: "lost", amount: 70 * M, lost: 25, reason: "تصمیم به تعویق تا سال مالی بعد." },
    { title: "مشاوره قیمت‌گذاری — چوبینه", contact: "حاج قاسم موحدی", company: "تولیدی مبلمان چوبینه", stage: "lost", amount: 55 * M, lost: 90, reason: "با مشاور محلی ارزان‌تر قرارداد بست." },
  ];
  const dealRows = deals.map((d) => ({
    title: d.title,
    contact_id: ct[d.contact],
    company_id: d.company ? co[d.company] : null,
    stage_key: d.stage,
    status: d.stage === "won" ? "won" : d.stage === "lost" ? "lost" : "open",
    amount_toman: d.amount,
    expected_close: d.close ? daysAhead(d.close).slice(0, 10) : null,
    stage_entered_at: d.won ? daysAgo(d.won) : d.lost ? daysAgo(d.lost) : daysAgo(d.entered ?? 1),
    won_at: d.won ? daysAgo(d.won) : null,
    lost_at: d.lost ? daysAgo(d.lost) : null,
    lost_reason: d.reason ?? null,
    owner_email: "demo@arkan.ir",
    created_at: daysAgo((d.won ?? d.lost ?? d.entered ?? 1) + 10),
  }));
  const dealIds = await insert("deals", dealRows);
  const dl = Object.fromEntries(deals.map((d, i) => [d.title, dealIds[i]]));

  // ── ۶) فعالیت‌ها ────────────────────────────────────────────────
  console.log("📋 ساخت فعالیت‌ها…");
  const A = (contact, deal, type, title, opts = {}) => ({
    contact_id: contact ? ct[contact] : null,
    deal_id: deal ? dl[deal] : null,
    type, title,
    body: opts.body ?? null,
    due_at: opts.due ?? null,
    done_at: opts.done ?? null,
    created_by: SEED_BY,
    created_at: opts.at ?? daysAgo(1),
  });
  await insert("activities", [
    // معوق (قرمز در دمو) 🔴
    A("نسترن قاسمی", "مشاوره راه‌اندازی فروش آنلاین — آنیل", "task", "ارسال پیش‌نویس پروپوزال فروش آنلاین", { due: daysAgo(2), at: daysAgo(5), body: "قرار بود تا آخر هفته ارسال شود." }),
    A("آرش نعمتی", "بهینه‌سازی عملیات و انبار — زیوران", "call", "تماس پیگیری نظر تیم فنی درباره پروپوزال", { due: daysAgo(1), at: daysAgo(4) }),
    // امروز 🟡
    A("سپهر یوسفی", "مشاوره جذب سرمایه سری A — تیزرو", "meeting", "جلسه نهایی مذاکره قرارداد", { due: new Date(now + 3 * 3600000).toISOString(), at: daysAgo(3), body: "دفتر تیزرو — با حضور هم‌بنیان‌گذار." }),
    // آینده
    A("لیلا پناهی", "استراتژی توسعه شعب — دمنوش", "meeting", "جلسه شناخت اولیه (چهار رکن)", { due: daysAhead(2), at: daysAgo(1) }),
    A("دکتر شیوا مرادی", "برندینگ و جذب بیمار — آرنیکا", "call", "تماس هماهنگی بازدید از کلینیک", { due: daysAhead(4), at: daysAgo(2) }),
    A("مهندس فرهاد عظیمی", null, "task", "آماده‌سازی پرسشنامه شناخت برند کارفرمایی", { due: daysAhead(6), at: daysAgo(1) }),
    A("بابک تقی‌زاده", "طرح رشد و فرانچایز — روژان", "meeting", "جلسه معارفه و ارائه متدولوژی", { due: daysAhead(8), at: daysAgo(1) }),
    // انجام‌شده ✅
    A("نسترن قاسمی", "مشاوره راه‌اندازی فروش آنلاین — آنیل", "meeting", "جلسه مشاوره اولیه رایگان", { due: daysAgo(6), done: daysAgo(6), at: daysAgo(8), body: "نیاز اصلی: راه‌اندازی فروشگاه آنلاین + ساختار تیم فروش. بودجه ماهانه ~۵۰ میلیون." }),
    A("محمدرضا کریمی", "استراتژی ورود به صادرات — برکت", "meeting", "جلسه ارائه گزارش نهایی فاز استراتژی", { due: daysAgo(13), done: daysAgo(13), at: daysAgo(20) }),
    A("سپهر یوسفی", "مشاوره جذب سرمایه سری A — تیزرو", "call", "تماس اولیه و ارزیابی آمادگی جذب سرمایه", { done: daysAgo(11), at: daysAgo(11) }),
    A("آرش نعمتی", "بهینه‌سازی عملیات و انبار — زیوران", "meeting", "بازدید از انبار مرکزی", { due: daysAgo(9), done: daysAgo(9), at: daysAgo(14), body: "گلوگاه اصلی: چیدمان انبار و نبود بارکد. گزارش بازدید ثبت شد." }),
    A("الهام رستگار", "فاز دوم: پیاده‌سازی CRM فروش — برکت", "call", "تماس هماهنگی جلسه دمو", { done: daysAgo(3), at: daysAgo(3) }),
    A("حاج قاسم موحدی", "ورود به بازار آنلاین — چوبینه", "note", "یادداشت جلسه حضوری مشهد", { at: daysAgo(10), body: "ترجیح می‌دهد پسرش (مدیر فروش) هم در جلسات باشد. نگران هزینه‌ی مارکتینگ دیجیتال است." }),
    A("امیرحسین صادقی", null, "note", "معرفی‌شده توسط مشتری قبلی (برکت)", { at: daysAgo(35), body: "آقای کریمی معرفی کرده — اعتماد اولیه بالا." }),
    A("کاوه رحیمی", "مشاوره سبد سرمایه‌گذاری — رحیمی", "call", "تماس شناخت اولیه", { done: daysAgo(5), at: daysAgo(5) }),
    A("غزل شریفی", null, "task", "افزودن به خبرنامه ماهانه رشد", { done: daysAgo(2), at: daysAgo(6) }),
    A("سارا محبی", "راه‌اندازی فروش سازمانی — آنیل", "note", "سرنخ فروش سازمانی (B2B)", { at: daysAgo(2), body: "درخواست از طرف خانم قاسمی مطرح شد — یونیفرم سازمانی برای دو شرکت." }),
    // رویدادهای تغییر مرحله (تایم‌لاین)
    A("محمدرضا کریمی", "استراتژی ورود به صادرات — برکت", "stage_change", "انتقال به مرحله‌ی «بسته‌شده (موفق)»", { at: daysAgo(12) }),
    A("سپهر یوسفی", "مشاوره جذب سرمایه سری A — تیزرو", "stage_change", "انتقال به مرحله‌ی «مذاکره»", { at: daysAgo(12) }),
    A("آرش نعمتی", "بهینه‌سازی عملیات و انبار — زیوران", "stage_change", "انتقال به مرحله‌ی «ارسال پروپوزال»", { at: daysAgo(6) }),
    A("لیلا پناهی", "برنامه وفاداری مشتریان — دمنوش", "stage_change", "انتقال به مرحله‌ی «بسته‌شده (ناموفق)»", { at: daysAgo(25), body: "دلیل شکست: تصمیم به تعویق تا سال مالی بعد." }),
  ]);

  console.log("\n✅ داده‌ی نمایشی با موفقیت بارگذاری شد:");
  console.log("   ۱۰ شرکت · ۱۴ مخاطب · ۸ لید (۳ تازه برای دموی تبدیل) · ۲ گفتگوی چت‌بات");
  console.log("   ۲۱ معامله (۱۲ باز، ۶ برد، ۳ باخت) · ۲۲ فعالیت (معوق/امروز/آینده/انجام‌شده)");
  console.log("\n   پاک‌سازی بعد از دمو:  node scripts/seed-crm-demo.mjs --clean");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
