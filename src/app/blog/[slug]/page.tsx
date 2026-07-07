import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { getPublishedPostBySlug, readingMinutes } from "@/lib/blog";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) return { title: "مقاله پیدا نشد" };

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      locale: "fa_IR",
      title: post.metaTitle || post.title,
      description: post.metaDescription,
    },
  };
}

function faDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) notFound();

  const html = await marked.parse(post.contentMd);
  const dateIso = post.publishedAt ?? post.createdAt;

  // داده‌ی ساختاریافته — مقاله + پرسش‌های متداول (برای نتایج غنی گوگل)
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    datePublished: dateIso,
    author: { "@type": "Organization", name: "آرکان" },
    publisher: { "@type": "Organization", name: "آرکان" },
  };
  const faqJsonLd =
    post.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <Header />
      <main id="main" className="bg-bone">
        {/* سرصفحه‌ی مقاله */}
        <header className="border-b border-sand bg-bone pb-8 pt-32 sm:pt-36">
          <Container className="max-w-3xl">
            <nav className="mb-6 text-caption text-slate" aria-label="مسیر">
              <a href="/blog" className="transition-colors hover:text-pine">
                بلاگ
              </a>
              <span className="mx-2" aria-hidden="true">/</span>
              <span className="text-ink/70">{post.title}</span>
            </nav>
            <h1 className="font-heading text-[1.75rem] font-bold leading-tight text-pine sm:text-h1">
              {post.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-slate">
              <time className="nums">{faDate(dateIso)}</time>
              <span aria-hidden="true">·</span>
              <span className="nums">{toFa(readingMinutes(post.contentMd))} دقیقه مطالعه</span>
            </div>
          </Container>
        </header>

        {/* بدنه‌ی مقاله */}
        <Container className="max-w-3xl py-12">
          <article
            className="prose-arkan"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* کلیدواژه‌ها */}
          {post.keywords.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2 border-t border-sand pt-6">
              {post.keywords.map((k) => (
                <span key={k} className="rounded-full bg-sand px-3 py-1 text-caption text-pine">
                  {k}
                </span>
              ))}
            </div>
          )}

          {/* پرسش‌های متداول */}
          {post.faq.length > 0 && (
            <section className="mt-12 rounded-card border border-sand bg-white p-7 shadow-soft sm:p-8">
              <h2 className="mb-5 font-heading text-h3 font-semibold text-pine">
                پرسش‌های متداول
              </h2>
              <div className="divide-y divide-sand">
                {post.faq.map((f) => (
                  <details key={f.question} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink transition-colors group-open:text-pine [&::-webkit-details-marker]:hidden">
                      {f.question}
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-brass transition-transform duration-200 group-open:rotate-180"
                      >
                        ▾
                      </span>
                    </summary>
                    <p className="mt-3 leading-8 text-slate">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* دعوت به مشاوره */}
          <aside className="mt-12 rounded-card bg-pine p-8 text-center text-bone shadow-soft sm:p-10">
            <h2 className="font-heading text-h3 font-semibold text-bone">
              وضعیت کسب‌وکار شما فرق دارد؟
            </h2>
            <p className="mx-auto mt-3 max-w-md leading-8 text-bone/80">
              در تماس اولیه‌ی رایگان، وضعیت شما را می‌شنویم و قدم بعدی را روشن می‌کنیم.
              در ۲۴ ساعت کاری با شما تماس می‌گیریم.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="/#consultation"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-btn bg-bone px-6 font-medium text-pine transition-colors hover:bg-white"
              >
                درخواست مشاوره
              </a>
              <a
                href="/consultant"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-btn border border-bone/30 px-6 font-medium text-bone transition-colors hover:border-brass hover:text-brass"
              >
                گفت‌وگو با مشاور هوشمند
              </a>
            </div>
          </aside>

          {/* بازگشت */}
          <div className="mt-10 text-center">
            <Button as="a" href="/blog" variant="secondary" size="md">
              بازگشت به بلاگ
            </Button>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
