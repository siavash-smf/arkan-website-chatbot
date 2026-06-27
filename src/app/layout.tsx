import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// فونت عناوین — استعداد
const estedad = localFont({
  src: [
    { path: "../../public/fonts/Estedad-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Estedad-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Estedad-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Estedad-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-estedad",
  display: "swap",
  preload: true,
});

// فونت بدنه — وزیرمتن
const vazirmatn = localFont({
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: true,
});

const SITE_URL = "https://arkan.co";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "آرکان | مشاور استراتژی و رشد کسب‌وکار",
    template: "%s | آرکان",
  },
  description:
    "آرکان مشاور استراتژی و رشد کسب‌وکار است؛ از استراتژی تا اجرا کنار شما می‌ماند تا رشدی پایدار و قابل‌اندازه‌گیری بسازید. درخواست مشاوره‌ی رایگان.",
  keywords: [
    "مشاوره کسب‌وکار",
    "استراتژی رشد",
    "مشاور مدیریت",
    "رشد پایدار",
    "آرکان",
    "مدل کسب‌وکار",
    "استراتژی برند",
  ],
  authors: [{ name: "آرکان" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: SITE_URL,
    siteName: "آرکان",
    title: "آرکان | مشاور استراتژی و رشد کسب‌وکار",
    description:
      "ستون‌های رشد پایدار. آرکان از استراتژی تا اجرا کنار کسب‌وکار شما می‌ماند. درخواست مشاوره‌ی رایگان.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "آرکان — مشاور استراتژی و رشد کسب‌وکار",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "آرکان | مشاور استراتژی و رشد کسب‌وکار",
    description: "ستون‌های رشد پایدار. درخواست مشاوره‌ی رایگان.",
    images: ["/images/og-image.jpg"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#143A32",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${estedad.variable} ${vazirmatn.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          پرش به محتوای اصلی
        </a>
        {children}
      </body>
    </html>
  );
}
