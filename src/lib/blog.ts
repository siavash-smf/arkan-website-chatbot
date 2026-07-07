import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * لایه‌ی خواندن بلاگ — پست‌ها در دیتابیس «سیستم مولتی‌ایجنت» (فاز ۳) ساخته و
 * منتشر می‌شوند و این سایت فقط آن‌ها را می‌خواند و نمایش می‌دهد.
 *
 * برای همین یک کلاینت جداگانه با متغیرهای BLOG_SUPABASE_* داریم (مستقل از
 * دیتابیس leads/چت‌بات این سایت). فقط سمت سرور استفاده می‌شود.
 * اگر تنظیم نشده باشد، فهرست خالی برمی‌گردد تا سایت بدون خطا کار کند.
 */

export type BlogFaq = { question: string; answer: string };

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  contentMd: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  faq: BlogFaq[];
  publishedAt: string | null;
  createdAt: string;
};

function getBlogClient(): SupabaseClient | null {
  const url = process.env.BLOG_SUPABASE_URL;
  const key = process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function fromRow(r: any): BlogPost {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt ?? "",
    contentMd: r.content_md ?? "",
    metaTitle: r.meta_title ?? r.title,
    metaDescription: r.meta_description ?? "",
    keywords: r.keywords ?? [],
    faq: r.faq ?? [],
    publishedAt: r.published_at,
    createdAt: r.created_at,
  };
}

export function isBlogConfigured(): boolean {
  return Boolean(process.env.BLOG_SUPABASE_URL && process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY);
}

export async function listPublishedPosts(): Promise<BlogPost[]> {
  const client = getBlogClient();
  if (!client) return [];
  const { data, error } = await client
    .from("posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[blog] خواندن پست‌ها ناموفق بود:", error.message);
    return [];
  }
  return (data ?? []).map(fromRow);
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  const client = getBlogClient();
  if (!client) return null;
  const { data } = await client
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data ? fromRow(data) : null;
}

/** تخمین زمان مطالعه (حدود ۲۰۰ کلمه در دقیقه برای فارسی) */
export function readingMinutes(contentMd: string): number {
  return Math.max(1, Math.round(contentMd.split(/\s+/).length / 200));
}
