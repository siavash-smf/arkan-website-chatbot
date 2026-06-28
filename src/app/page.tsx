import Script from "next/script";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import Pillars from "@/components/Pillars";
import Process from "@/components/Process";
import Credibility from "@/components/Credibility";
import ConsultationForm from "@/components/ConsultationForm";
import Footer from "@/components/Footer";

// داده‌ی ساختاریافته برای SEO (سازمان مشاوره)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "آرکان",
  alternateName: "Arkan — Business Strategy & Growth Advisory",
  description:
    "مشاور استراتژی و رشد کسب‌وکار؛ از استراتژی تا اجرا کنار کسب‌وکارهای کوچک و متوسط.",
  url: "https://arkan.co",
  email: "info@arkan.co",
  telephone: "+98-21-88000000",
  foundingDate: "2017",
  areaServed: "IR",
  address: {
    "@type": "PostalAddress",
    addressLocality: "تهران",
    addressCountry: "IR",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main id="main">
        <Hero />
        <Services />
        <Pillars />
        <Process />
        <Credibility />
        <ConsultationForm />
      </main>
      <Footer />
      {/* ویجت چت آرکان روی خود سایت */}
      <Script src="/widget.js" strategy="afterInteractive" />
    </>
  );
}
