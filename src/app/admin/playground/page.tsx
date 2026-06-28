import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import Playground from "@/components/admin/Playground";

export const metadata: Metadata = { title: "پلی‌گراند", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// مهلت اجرای سرور‌اکشن‌های این صفحه (تولید پاسخ مدل ممکن است چند ثانیه طول بکشد)
export const maxDuration = 60;

export default function PlaygroundPage() {
  if (!isAuthed()) redirect("/admin/login");
  return (
    <AdminShell active="playground">
      <Playground />
    </AdminShell>
  );
}
