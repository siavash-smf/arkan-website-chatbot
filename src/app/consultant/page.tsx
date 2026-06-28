import type { Metadata } from "next";
import ChatPanel from "@/components/chat/ChatPanel";

export const metadata: Metadata = {
  title: "گفت‌وگو با مشاور آرکان",
  description:
    "از دستیار هوشمند آرکان درباره‌ی خدمات، متدولوژی چهار رکن و فرایند همکاری بپرسید و مسیر رشد کسب‌وکارتان را روشن کنید.",
};

export const dynamic = "force-dynamic";

export default function ConsultantPage() {
  return <ChatPanel />;
}
