import "server-only";
import { generateText } from "ai";
import { z } from "zod";
import { getOpenRouter, isOpenRouterConfigured } from "@/lib/rag/generate";
import { getModelConfig } from "@/lib/rag/config";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * ویژگی‌های AI ماژول CRM — همان OpenRouter و مدل فعال چت‌بات.
 * خروجی‌ها JSON با اعتبارسنجی zod؛ یک بار retry روی خطای parse.
 */

const NOT_CONFIGURED = "کلید OpenRouter تنظیم نشده است (OPENROUTER_API_KEY).";
const NO_DB = "اتصال پایگاه داده برقرار نیست.";

async function generateJson<T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: string
): Promise<T> {
  const openrouter = getOpenRouter();
  const config = await getModelConfig("web");

  async function attempt(extraHint?: string): Promise<T> {
    const { text } = await generateText({
      model: openrouter(config.active_model),
      system:
        system +
        "\n\nخروجی را فقط به‌صورت یک شیء JSON معتبر برگردان؛ بدون هیچ متن اضافه، بدون code fence." +
        (extraHint ? `\n${extraHint}` : ""),
      prompt,
      temperature: 0.2,
      // مدل‌های reasoning (مثل Gemini 3.5) بخش زیادی از بودجه را صرف استدلال می‌کنند
      // (حتی با effort=low حدود ~۵۰۰ توکن)؛ سقف پایین ⇒ JSON نیمه‌کاره و خطای parse.
      maxOutputTokens: 2000,
    });
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    return schema.parse(JSON.parse(cleaned));
  }

  try {
    return await attempt();
  } catch {
    return attempt("تلاش قبلی JSON نامعتبر بود؛ این بار دقیقاً مطابق ساختار خواسته‌شده پاسخ بده.");
  }
}

// ── امتیازدهی لید ────────────────────────────────────────────────

const scoreSchema = z.object({
  score: z.number().min(0).max(100),
  rationale: z.string().min(1),
});

export async function scoreLead(leadId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isOpenRouterConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: NO_DB };

  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, full_name, business_name, industry, stage, challenge, preferred_time, source, email")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !lead) return { ok: false, error: error?.message ?? "لید پیدا نشد." };

  try {
    const result = await generateJson(
      scoreSchema,
      `تو کارشناس ارزیابی سرنخ فروش (Lead Scoring) شرکت مشاوره‌ی کسب‌وکار «آرکان» هستی.
آرکان به کسب‌وکارهای ایرانی خدمات مشاوره‌ی استراتژی و رشد می‌فروشد؛ مشتری ایده‌آل کسب‌وکاری فعال با چالش مشخص و آمادگی سرمایه‌گذاری روی مشاوره است.
به لید امتیازی از ۰ تا ۱۰۰ بده (۱۰۰ = آماده‌ی خرید). معیارها: جدی‌بودن چالش، مرحله‌ی کسب‌وکار (در حال رشد/تثبیت‌شده ارزشمندتر از ایده)، کامل‌بودن اطلاعات تماس، و اعلام زمان تماس.
ساختار خروجی: {"score": عدد، "rationale": "توضیح کوتاه فارسی (حداکثر دو جمله)"}`,
      JSON.stringify({
        نام: lead.full_name,
        کسب‌وکار: lead.business_name,
        حوزه: lead.industry,
        مرحله: lead.stage,
        چالش: lead.challenge,
        زمان_تماس: lead.preferred_time,
        منبع: lead.source,
        ایمیل_دارد: Boolean(lead.email),
      })
    );

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        ai_score: Math.round(result.score),
        ai_score_rationale: result.rationale,
        ai_scored_at: new Date().toISOString(),
      })
      .eq("id", leadId);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `امتیازدهی ناموفق بود: ${(e as Error).message}` };
  }
}

// ── خلاصه‌سازی گفتگوی چت‌بات در پروفایل مخاطب ────────────────────

export async function summarizeConversation(
  contactId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isOpenRouterConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: NO_DB };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, conversation_id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "مخاطب پیدا نشد." };
  if (!contact.conversation_id) {
    return { ok: false, error: "گفتگویی از چت‌بات به این مخاطب متصل نیست." };
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", contact.conversation_id)
    .in("role", ["user", "assistant"])
    .order("created_at")
    .limit(60);
  if (!messages?.length) return { ok: false, error: "پیامی در این گفتگو ثبت نشده است." };

  const transcript = messages
    .map((m) => `${m.role === "user" ? "کاربر" : "دستیار"}: ${m.content}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: getOpenRouter()((await getModelConfig("web")).active_model),
      system: `تو دستیار CRM شرکت مشاوره‌ی «آرکان» هستی. گفتگوی چت‌بات با مشتری بالقوه را برای پرونده‌ی او خلاصه کن.
خروجی: ۳ تا ۵ بولت کوتاه فارسی (هر بولت با «- » شروع شود) شامل: نیازها و دغدغه‌های اصلی، وضعیت کسب‌وکار، و سیگنال‌های خرید یا موانع. فقط بولت‌ها؛ بدون مقدمه.`,
      prompt: `مخاطب: ${contact.full_name}\n\nمتن گفتگو:\n${transcript}`,
      temperature: 0.3,
      // سهم reasoning مدل هم از همین سقف کم می‌شود (نگاه کنید به generateJson)
      maxOutputTokens: 2000,
    });
    if (!text.trim()) return { ok: false, error: "مدل خلاصه‌ای تولید نکرد." };

    const { error: updateError } = await supabase
      .from("contacts")
      .update({ ai_summary: text.trim(), ai_summary_at: new Date().toISOString() })
      .eq("id", contactId);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `خلاصه‌سازی ناموفق بود: ${(e as Error).message}` };
  }
}

// ── ایمیل شخصی‌سازی‌شده‌ی کمپین ───────────────────────────────────

const campaignEmailSchema = z.object({
  subject: z.string().min(3),
  body: z.string().min(50),
});

export async function generateCampaignEmail(input: {
  toName: string;
  context: Record<string, unknown>;
  campaignGoal: string | null;
}): Promise<{ ok: boolean; subject?: string; body?: string; error?: string }> {
  if (!isOpenRouterConfigured()) return { ok: false, error: NOT_CONFIGURED };
  try {
    const result = await generateJson(
      campaignEmailSchema,
      `تو کارشناس ارتباط با مشتری شرکت مشاوره‌ی کسب‌وکار «آرکان» هستی. یک ایمیل کوتاه، گرم و کاملاً شخصی‌سازی‌شده به فارسی بنویس.
اصول:
- به وضعیت و چالش خاص همین گیرنده اشاره کن؛ متن عمومی و تبلیغاتی ممنوع.
- لحن: محترمانه با «شما»، بدون اغراق، بدون وعده‌ی تضمینی.
- حداکثر ۱۲۰ کلمه + یک دعوت به اقدام مشخص (مثلاً جلسه‌ی مشاوره‌ی رایگان).
- امضای پایان: «با احترام — تیم مشاوره‌ی آرکان».
ساختار خروجی: {"subject": "موضوع کوتاه جذاب", "body": "متن ایمیل"}`,
      JSON.stringify({
        گیرنده: input.toName,
        زمینه: input.context,
        هدف_کمپین: input.campaignGoal ?? "دعوت به جلسه‌ی مشاوره‌ی رایگان",
      })
    );
    return { ok: true, subject: result.subject, body: result.body };
  } catch (e) {
    return { ok: false, error: `تولید ایمیل ناموفق بود: ${(e as Error).message}` };
  }
}

// ── پیام پیگیری قرارداد ──────────────────────────────────────────

export async function generateContractFollowup(input: {
  clientName: string;
  companyName: string | null;
  contractTitle: string;
  contractNo: string;
  status: string; // sent | viewed
  daysWaiting: number;
  shareUrl: string;
}): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (!isOpenRouterConfigured()) return { ok: false, error: NOT_CONFIGURED };
  try {
    const { text } = await generateText({
      model: getOpenRouter()((await getModelConfig("web")).active_model),
      system: `تو مسئول پیگیری قراردادهای شرکت مشاوره‌ی «آرکان» هستی. یک پیام پیگیری کوتاه و مؤدبانه به فارسی بنویس که ادمین بتواند مستقیم برای کارفرما بفرستد (ایمیل یا پیام).
اصول: بدون فشار و طلبکاری؛ یادآوری ملایم + اعلام آمادگی برای پاسخ به سؤال یا اصلاح مفاد + لینک قرارداد. حداکثر ۹۰ کلمه. فقط متن پیام را برگردان.`,
      prompt: JSON.stringify({
        کارفرما: input.clientName,
        شرکت: input.companyName,
        قرارداد: input.contractTitle,
        شماره: input.contractNo,
        وضعیت: input.status === "viewed" ? "دیده ولی تأیید نکرده" : "هنوز باز نکرده",
        روزهای_انتظار: input.daysWaiting,
        لینک: input.shareUrl,
      }),
      temperature: 0.4,
      maxOutputTokens: 2000,
    });
    if (!text.trim()) return { ok: false, error: "مدل پیامی تولید نکرد." };
    return { ok: true, text: text.trim() };
  } catch (e) {
    return { ok: false, error: `تولید پیام ناموفق بود: ${(e as Error).message}` };
  }
}

// ── پیشنهاد محتوای بلاگ برای پیگیری لید ──────────────────────────

const blogSuggestSchema = z.object({
  slug: z.string().min(1),
  message: z.string().min(20),
});

export async function suggestBlogContent(input: {
  leadName: string;
  business: string | null;
  challenge: string | null;
  posts: Array<{ slug: string; title: string; excerpt: string; keywords: string[] }>;
}): Promise<{ ok: boolean; slug?: string; message?: string; error?: string }> {
  if (!isOpenRouterConfigured()) return { ok: false, error: NOT_CONFIGURED };
  if (!input.posts.length) return { ok: false, error: "پست منتشرشده‌ای در بلاگ نیست." };
  try {
    const result = await generateJson(
      blogSuggestSchema,
      `تو کارشناس پرورش سرنخ (lead nurturing) شرکت مشاوره‌ی «آرکان» هستی. از بین پست‌های بلاگ، مرتبط‌ترین را با چالش این لید انتخاب کن و یک پیام کوتاه دوستانه (حداکثر ۶۰ کلمه، فارسی، با «شما») بنویس که ادمین همراه لینک پست برای او بفرستد. در پیام به چالش خودش اشاره کن و بگو چرا این مطلب به دردش می‌خورد.
ساختار خروجی: {"slug": "اسلاگ پست انتخابی از لیست", "message": "متن پیام بدون لینک"}`,
      JSON.stringify({
        لید: { نام: input.leadName, کسب‌وکار: input.business, چالش: input.challenge },
        پست‌ها: input.posts,
      })
    );
    if (!input.posts.some((p) => p.slug === result.slug)) {
      return { ok: false, error: "مدل پست نامعتبری انتخاب کرد؛ دوباره تلاش کنید." };
    }
    return { ok: true, slug: result.slug, message: result.message };
  } catch (e) {
    return { ok: false, error: `پیشنهاد محتوا ناموفق بود: ${(e as Error).message}` };
  }
}

// ── پیش‌نویس متن قرارداد ─────────────────────────────────────────

export async function draftContractBody(context: {
  clientName: string;
  companyName: string | null;
  dealTitle: string | null;
  amountToman: number;
  durationLabel: string | null;
  challenge: string | null;
  aiSummary: string | null;
  currentBody: string;
}): Promise<{ ok: boolean; body?: string; error?: string }> {
  if (!isOpenRouterConfigured()) return { ok: false, error: NOT_CONFIGURED };

  try {
    const { text } = await generateText({
      model: getOpenRouter()((await getModelConfig("web")).active_model),
      system: `تو کارشناس حقوقی-بازرگانی شرکت مشاوره‌ی کسب‌وکار «آرکان» هستی. متن قرارداد خدمات مشاوره را به فارسی رسمی و به‌صورت Markdown تنظیم کن.
الزامات:
- ساختار ماده‌بندی‌شده با تیترهای «## ماده N — عنوان» (حدود ۸ تا ۱۲ ماده): طرفین، موضوع (متناسب با نیاز مشخص این کارفرما)، مدت، مبلغ و شرایط پرداخت مرحله‌ای، تعهدات طرفین، محرمانگی، فسخ، حل اختلاف.
- موضوع قرارداد و تعهدات را با توجه به شناخت مشتری شخصی‌سازی کن؛ متن عمومی ننویس.
- متدولوژی «چهار رکن» آرکان (شناخت، استراتژی، اجرا، پایش) را در شرح خدمات بگنجان.
- فقط متن Markdown قرارداد را برگردان؛ بدون مقدمه، بدون code fence، بدون عنوان اصلی (H1).`,
      prompt: JSON.stringify({
        کارفرما: context.clientName,
        شرکت: context.companyName,
        موضوع_معامله: context.dealTitle,
        مبلغ_تومان: context.amountToman,
        مدت: context.durationLabel,
        چالش_اعلام‌شده: context.challenge,
        شناخت_مشتری: context.aiSummary,
        متن_فعلی_برای_بهبود: context.currentBody.slice(0, 3000),
      }),
      temperature: 0.4,
      maxOutputTokens: 4000, // متن بلند + سهم reasoning مدل
    });
    const body = text.trim().replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "");
    if (body.length < 200) return { ok: false, error: "مدل متن کاملی تولید نکرد؛ دوباره تلاش کنید." };
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: `تولید پیش‌نویس ناموفق بود: ${(e as Error).message}` };
  }
}

// ── پیشنهاد اقدام بعدی برای معامله ───────────────────────────────

const nextActionSchema = z.object({
  action: z.string().min(1),
  reason: z.string().min(1),
});

export async function nextBestAction(dealId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isOpenRouterConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: NO_DB };

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, title, stage_key, status, amount_toman, stage_entered_at, expected_close, contact:contacts(full_name, ai_summary), stage:pipeline_stages(label_fa)"
    )
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return { ok: false, error: "معامله پیدا نشد." };

  const { data: activities } = await supabase
    .from("activities")
    .select("type, title, body, done_at, due_at, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(5);

  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.stage_entered_at).getTime()) / 86400000
  );
  const contact = deal.contact as unknown as { full_name: string; ai_summary: string | null } | null;
  const stage = deal.stage as unknown as { label_fa: string } | null;

  try {
    const result = await generateJson(
      nextActionSchema,
      `تو مشاور فروش شرکت مشاوره‌ی کسب‌وکار «آرکان» هستی. برای معامله‌ی جاری، بهترین اقدام بعدی مشخص و عملی را پیشنهاد بده (مثل تماس پیگیری، ارسال پروپوزال، تنظیم جلسه).
ساختار خروجی: {"action": "اقدام مشخص در یک جمله", "reason": "دلیل کوتاه در یک جمله"} — هر دو فارسی.`,
      JSON.stringify({
        عنوان: deal.title,
        مرحله: stage?.label_fa ?? deal.stage_key,
        روز_در_مرحله: daysInStage,
        مبلغ_تومان: deal.amount_toman,
        تاریخ_بستن_موردانتظار: deal.expected_close,
        مخاطب: contact?.full_name,
        خلاصه_شناخت_مشتری: contact?.ai_summary,
        فعالیت‌های_اخیر: (activities ?? []).map((a) => ({
          نوع: a.type,
          عنوان: a.title,
          انجام‌شده: Boolean(a.done_at),
        })),
      })
    );

    const { error: updateError } = await supabase
      .from("deals")
      .update({
        ai_next_action: `پیشنهاد: ${result.action}\nدلیل: ${result.reason}`,
        ai_next_action_at: new Date().toISOString(),
      })
      .eq("id", dealId);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `تولید پیشنهاد ناموفق بود: ${(e as Error).message}` };
  }
}
