import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * پیکربندی مغز RAG از دیتابیس خوانده می‌شود تا از پنل قابل تغییر باشد.
 * اگر دیتابیس/ردیف موجود نبود، مقادیر پیش‌فرض امن برگردانده می‌شوند.
 */

export type EmbeddingConfig = {
  provider: string; // cohere | openai | google | voyage
  model: string;
  dimensions: number;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
  reranker_enabled: boolean;
  reranker_model: string | null;
};

export type ModelConfig = {
  channel: string;
  provider: string; // openrouter
  active_model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  fallback_model: string | null;
};

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: "cohere",
  model: "embed-multilingual-v3.0",
  dimensions: 1024,
  chunk_size: 500,
  chunk_overlap: 50,
  top_k: 5,
  similarity_threshold: 0.3,
  reranker_enabled: false,
  reranker_model: null,
};

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  channel: "web",
  provider: "openrouter",
  active_model: "google/gemini-3.5-flash",
  temperature: 0.4,
  max_tokens: 800,
  top_p: 1,
  fallback_model: "google/gemini-2.5-flash",
};

// پرسونای پیش‌فرض (همتای ردیف seed در chatbot-schema.sql)
export const DEFAULT_SYSTEM_PROMPT = `تو دستیار هوشمند «آرکان» هستی؛ آرکان یک شرکت مشاور استراتژی و رشد کسب‌وکار در تهران است.

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
- پاسخ‌ها فارسی، کوتاه و خوانا باشند.`;

export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return DEFAULT_EMBEDDING_CONFIG;
  const { data } = await supabase
    .from("embedding_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_EMBEDDING_CONFIG;
  return { ...DEFAULT_EMBEDDING_CONFIG, ...data } as EmbeddingConfig;
}

export async function getModelConfig(channel = "web"): Promise<ModelConfig> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return DEFAULT_MODEL_CONFIG;
  const { data } = await supabase
    .from("model_config")
    .select("*")
    .eq("channel", channel)
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_MODEL_CONFIG;
  return { ...DEFAULT_MODEL_CONFIG, ...data } as ModelConfig;
}

export async function getActivePrompt(): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return DEFAULT_SYSTEM_PROMPT;
  const { data } = await supabase
    .from("prompt_versions")
    .select("content")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.content || DEFAULT_SYSTEM_PROMPT;
}
