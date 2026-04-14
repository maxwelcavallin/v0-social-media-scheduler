import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { AdminUsersView } from "@/components/admin/admin-users-view"

export const dynamic = "force-dynamic"
export const metadata = { title: "Usuários | Admin — SocialDog" }

export default async function AdminUsersPage() {
  const session = await getSession()

  const users = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.created_at,
      u.is_super_admin,
      COALESCE(us.plan, 'free') as plan,
      us.updated_at as plan_updated_at,
      (SELECT c.id FROM company c JOIN company_member cm ON cm.company_id = c.id WHERE cm.user_id = u.id LIMIT 1) as company_id,
      (SELECT c.name FROM company c JOIN company_member cm ON cm.company_id = c.id WHERE cm.user_id = u.id LIMIT 1) as company_name,
      (SELECT c.document FROM company c JOIN company_member cm ON cm.company_id = c.id WHERE cm.user_id = u.id LIMIT 1) as company_document,
      (SELECT cm.role FROM company_member cm WHERE cm.user_id = u.id LIMIT 1) as company_role,
      (SELECT COUNT(*)::int FROM "organization" o JOIN "member" m ON m.organization_id = o.id WHERE m.user_id = u.id) as workspace_count,
      COALESCE(uff.tts_enabled, false) as tts_enabled
    FROM users u
    LEFT JOIN user_subscriptions us ON us.user_id = u.id
    LEFT JOIN user_feature_flags uff ON uff.user_id = u.id
    ORDER BY u.created_at DESC
  `

  return <AdminUsersView users={users as any} currentUserId={session!.user.id} />
}
