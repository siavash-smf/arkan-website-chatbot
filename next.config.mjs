/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // PDF پروپوزال/قرارداد به‌صورت base64 به سرور‌اکشن ارسال می‌شود (سقف پیش‌فرض ۱ مگابایت است).
    // زیر ۴٫۵ مگابایتِ Vercel می‌ماند؛ خود PDF در lib/documents/pdf.ts زیر ۲٫۹ مگابایت نگه داشته می‌شود.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
