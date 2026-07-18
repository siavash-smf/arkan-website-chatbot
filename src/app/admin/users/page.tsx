import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import UsersManager, {
  type AdminUserRow,
  type AuditRow,
} from "@/components/admin/UsersManager";

export const metadata: Metadata = { title: "کاربران", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");
  if (!hasRole(session, "admin")) redirect("/admin");

  const supabase = getSupabaseAdmin();
  let users: AdminUserRow[] = [];
  let audit: AuditRow[] = [];
  let error: string | null = null;

  if (!supabase) {
    error = "اتصال Supabase تنظیم نشده است.";
  } else {
    const [usersRes, auditRes] = await Promise.all([
      supabase
        .from("admin_users")
        .select("id, email, role, is_active, last_login_at, created_at, password_hash")
        .order("created_at"),
      supabase
        .from("audit_log")
        .select("id, actor_email, action, target, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    error = usersRes.error?.message ?? auditRes.error?.message ?? null;
    users = (usersRes.data ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      is_active: u.is_active,
      last_login_at: u.last_login_at,
      created_at: u.created_at,
      has_password: Boolean(u.password_hash),
    }));
    audit = (auditRes.data as AuditRow[]) ?? [];
  }

  return (
    <AdminShell active="users" role={session.role}>
      <UsersManager
        users={users}
        audit={audit}
        error={error}
        isOwner={hasRole(session, "owner")}
        currentUid={session.uid}
      />
    </AdminShell>
  );
}
