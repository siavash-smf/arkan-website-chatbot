import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Reveal from "@/components/ui/Reveal";
import { listPublishedPosts, readingMinutes } from "@/lib/blog";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "بلاگ",
  description:
    "یادداشت‌ها و راهنماهای عملی آرکان درباره‌ی استراتژی، ساختار، بازار و اجرا — برای مدیرانی که می‌خواهند درست رشد کنند.",
  alternates: { canonical: "/blog" },
};

function faDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();
  const [featured, ...rest] = posts;

  return (
    <>
      <Header />
      <main id="main">
        {/* سرصفحه‌ی بلاگ — پس‌زمینه‌ی استخوانی، تمرکز روی متن */}
        <section className="scroll-mt-24 bg-bone pb-4 pt-32 sm:pt-36">
          <Container>
            <Reveal className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 text-caption font-medium text-brass">
                <span className="h-px w-6 bg-brass" aria-hidden="true" />
                بلاگ آرکان
              </p>
              <h1 className="text-[2rem] font-bold leading-tight text-pine sm:text-h1">
                یادداشت‌هایی برای رشد پایدار
              </h1>
              <p className="mt-4 text-body text-slate">
                راهنماهای عملی درباره‌ی استراتژی، ساختار، بازار و اجرا — کوتاه، صریح و
                قابل‌استفاده در تصمیم‌های واقعی کسب‌وکار شما.
              </p>
            </Reveal>
          </Container>
        </section>

        <section className="bg-bone pb-24 pt-10">
          <Container>
            {posts.length === 0 ? (
              <div className="rounded-card border border-sand bg-white p-12 text-center shadow-soft">
                <p className="font-heading text-h3 font-semibold text-pine">
                  به‌زودی اینجا می‌نویسیم
                </p>
                <p className="mx-auto mt-3 max-w-md text-body text-slate">
                  اولین یادداشت‌های آرکان در راه‌اند. تا آن‌وقت، اگر سؤالی درباره‌ی رشد
                  کسب‌وکارتان دارید، در تماس اولیه‌ی رایگان پاسخ می‌گیرید.
                </p>
                <a
                  href="/#consultation"
                  className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-pine px-6 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark"
                >
                  درخواست مشاوره
                </a>
              </div>
            ) : (
              <>
                {/* مقاله‌ی شاخص (جدیدترین) */}
                {featured && (
                  <Reveal>
                    <a
                      href={`/blog/${featured.slug}`}
                      className="group block overflow-hidden rounded-card border border-sand bg-white shadow-soft transition-shadow duration-300 hover:shadow-soft-md"
                    >
                      <div className="grid md:grid-cols-5">
                        {/* نوار تصویری تزئینی برند (بدون تصویر واقعی — الگوی چهار رکن) */}
                        <div
                          className="relative hidden min-h-[200px] items-end overflow-hidden bg-pine p-7 md:col-span-2 md:flex"
                          aria-hidden="true"
                        >
                          <div className="flex items-end gap-2.5">
                            <span className="block w-2.5 rounded-full bg-bone/80" style={{ height: "38%" }} />
                            <span className="block w-2.5 rounded-full bg-bone/80" style={{ height: "70%" }} />
                            <span className="block w-2.5 rounded-full bg-brass" style={{ height: "90%" }} />
                            <span className="block w-2.5 rounded-full bg-bone/80" style={{ height: "52%" }} />
                          </div>
                          <span className="absolute inset-x-7 bottom-7 hidden" />
                        </div>

                        <div className="p-7 sm:p-9 md:col-span-3">
                          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-slate">
                            <span className="inline-flex items-center gap-1.5 font-medium text-brass">
                              جدیدترین یادداشت
                            </span>
                            {featured.publishedAt && (
                              <time className="nums">{faDate(featured.publishedAt)}</time>
                            )}
                            <span className="nums">
                              {toFa(readingMinutes(featured.contentMd))} دقیقه مطالعه
                            </span>
                          </div>
                          <h2 className="font-heading text-[1.4rem] font-bold leading-snug text-pine transition-colors group-hover:text-pine-dark sm:text-h3">
                            {featured.title}
                          </h2>
                          <p className="mt-3 line-clamp-3 text-body leading-8 text-slate">
                            {featured.excerpt}
                          </p>
                          <span className="mt-5 inline-flex items-center gap-2 text-[0.95rem] font-medium text-pine">
                            خواندن مقاله
                            <span aria-hidden="true" className="transition-transform group-hover:-translate-x-1">
                              ←
                            </span>
                          </span>
                        </div>
                      </div>
                    </a>
                  </Reveal>
                )}

                {/* بقیه‌ی مقاله‌ها */}
                {rest.length > 0 && (
                  <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((post, i) => (
                      <Reveal key={post.id} delay={i * 70}>
                        <a
                          href={`/blog/${post.slug}`}
                          className="group flex h-full flex-col rounded-card border border-sand bg-white p-7 shadow-soft transition-shadow duration-300 hover:shadow-soft-md"
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-slate">
                            {post.publishedAt && (
                              <time className="nums">{faDate(post.publishedAt)}</time>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="nums">
                              {toFa(readingMinutes(post.contentMd))} دقیقه
                            </span>
                          </div>
                          <h3 className="font-heading text-[1.15rem] font-semibold leading-snug text-pine transition-colors group-hover:text-pine-dark">
                            {post.title}
                          </h3>
                          <p className="mt-3 line-clamp-3 flex-1 text-[0.95rem] leading-7 text-slate">
                            {post.excerpt}
                          </p>
                          {post.keywords.length > 0 && (
                            <div className="mt-5 flex flex-wrap gap-2">
                              {post.keywords.slice(0, 2).map((k) => (
                                <span
                                  key={k}
                                  className="rounded-full bg-sand px-3 py-1 text-caption text-pine"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          )}
                        </a>
                      </Reveal>
                    ))}
                  </div>
                )}
              </>
            )}
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
