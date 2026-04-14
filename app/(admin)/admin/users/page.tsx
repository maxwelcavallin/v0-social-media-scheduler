import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { AdminUsersView } from "@/components/admin/admin-users-view"

export const dynamic = "force-dynamic"
export const metadata = { title: "Usuários | Admin — SocialDog" }

export default async function AdminUsersPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const users = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.created_at,
      u.is_super_admin,
      COALESCE(us.plan, 'free') AS plan,
      us.updated_at AS plan_updated_at,
      c.id AS company_id,
      c.name AS company_name,
      c.document AS company_document,
      cm2.role AS company_role,
      COALESCE(wcount.cnt, 0)::int AS workspace_count,
      COALESCE(uff.tts_enabled, false) AS tts_enabled
    FROM users u
    LEFT JOIN user_subscriptions us ON us.user_id = u.id
    LEFT JOIN user_feature_flags uff ON uff.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT cm.company_id, cm.role FROM company_member cm WHERE cm.user_id = u.id LIMIT 1
    ) cm2 ON true
    LEFT JOIN company c ON c.id = cm2.company_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS cnt
      FROM "organization" o
      JOIN "member" m ON m.organization_id = o.id
      WHERE m.user_id = u.id
    ) wcount ON true
    ORDER BY u.created_at DESC
  `.catch((e: any) => {
    console.error("[v0] admin users query error:", e.message)
    return []
  })

  return <AdminUsersView users={users as any} currentUserId={session.user.id} />
}
