import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "ورود مدیر",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  // اگر از قبل واردشده، مستقیم به پنل
  if (isAuthed()) redirect("/admin");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bone px-5 py-16">
      <LoginForm />
    </main>
  );
}
