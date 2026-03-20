import sql from "@/lib/db"

export type Plan = "free" | "pro"

export const PLAN_LIMITS = {
  free: {
    workspaces: 1,
    socialAccounts: 2,
    postsPerMonth: 30,
  },
  pro: {
    workspaces: Infinity,
    socialAccounts: Infinity,
    postsPerMonth: Infinity,
  },
} as const

export async function getUserPlan(userId: string): Promise<Plan> {
  const rows = await sql`
    SELECT plan FROM user_subscriptions
    WHERE user_id = ${userId} AND status = 'active'
    LIMIT 1
  `
  return (rows[0]?.plan as Plan) ?? "free"
}

export async function checkWorkspaceLimit(userId: string): Promise<{ allowed: boolean; plan: Plan; current: number; limit: number }> {
  const plan = await getUserPlan(userId)
  const limit = PLAN_LIMITS[plan].workspaces
  if (limit === Infinity) return { allowed: true, plan, current: 0, limit: Infinity }

  const rows = await sql`
    SELECT COUNT(*)::int as count
    FROM "organization" o
    JOIN "member" m ON m.organization_id = o.id
    WHERE m.user_id = ${userId}
  `
  const current = rows[0]?.count ?? 0
  return { allowed: current < limit, plan, current, limit }
}

export async function checkSocialAccountLimit(userId: string, workspaceId: string): Promise<{ allowed: boolean; plan: Plan; current: number; limit: number }> {
  const plan = await getUserPlan(userId)
  const limit = PLAN_LIMITS[plan].socialAccounts
  if (limit === Infinity) return { allowed: true, plan, current: 0, limit: Infinity }

  // No plano free, o limite é global (total de contas do usuário, não por workspace)
  const rows = await sql`
    SELECT COUNT(*)::int as count
    FROM social_accounts sa
    JOIN "organization" o ON o.id = sa.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    WHERE m.user_id = ${userId} AND sa.is_active = true
  `
  const current = rows[0]?.count ?? 0
  return { allowed: current < limit, plan, current, limit }
}

export async function checkPostsThisMonth(userId: string, workspaceId: string): Promise<{ allowed: boolean; plan: Plan; current: number; limit: number }> {
  const plan = await getUserPlan(userId)
  const limit = PLAN_LIMITS[plan].postsPerMonth
  if (limit === Infinity) return { allowed: true, plan, current: 0, limit: Infinity }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  // Conta posts do mês corrente de todos os workspaces do usuário
  const rows = await sql`
    SELECT COUNT(*)::int as count
    FROM posts p
    JOIN "organization" o ON o.id = p.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    WHERE m.user_id = ${userId}
      AND p.created_at >= ${monthStart}
      AND p.created_at < ${monthEnd}
      AND p.status != 'draft'
  `
  const current = rows[0]?.count ?? 0
  return { allowed: current < limit, plan, current, limit }
}
