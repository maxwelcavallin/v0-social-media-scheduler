import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { getUserPlan, PLAN_LIMITS, checkWorkspaceLimit, checkSocialAccountLimit, checkPostsThisMonth } from "@/lib/plans"
import sql from "@/lib/db"
import { PlansView } from "@/components/plans/plans-view"

export default async function PlansPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [plan, wsUsage, accUsage, postsUsage] = await Promise.all([
    getUserPlan(session.user.id),
    checkWorkspaceLimit(session.user.id),
    checkSocialAccountLimit(session.user.id, ""),
    checkPostsThisMonth(session.user.id, ""),
  ])

  // Contar workspaces atuais
  const wsCount = await sql`
    SELECT COUNT(*)::int as count FROM "organization" o
    JOIN "member" m ON m.organization_id = o.id
    WHERE m.user_id = ${session.user.id}
  `
  const accCount = await sql`
    SELECT COUNT(*)::int as count FROM social_accounts sa
    JOIN "organization" o ON o.id = sa.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    WHERE m.user_id = ${session.user.id} AND sa.is_active = true
  `

  return (
    <PlansView
      currentPlan={plan}
      usage={{
        workspaces: { current: wsCount[0].count, limit: PLAN_LIMITS[plan].workspaces },
        socialAccounts: { current: accCount[0].count, limit: PLAN_LIMITS[plan].socialAccounts },
        postsThisMonth: { current: postsUsage.current, limit: PLAN_LIMITS[plan].postsPerMonth },
      }}
    />
  )
}
