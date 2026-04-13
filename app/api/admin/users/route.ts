import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

async function isSuperAdmin(userId: string): Promise<boolean> {
  const rows = await sql`SELECT is_super_admin FROM users WHERE id = ${userId} LIMIT 1`
  return rows[0]?.is_super_admin === true
}

// GET /api/admin/users — lista todos os usuários com plano e empresa
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("q") || ""

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
      (SELECT COUNT(*)::int FROM "organization" o JOIN "member" m ON m.organization_id = o.id WHERE m.user_id = u.id) as workspace_count
    FROM users u
    LEFT JOIN user_subscriptions us ON us.user_id = u.id
    WHERE (
      ${search} = '' OR
      u.name ILIKE ${'%' + search + '%'} OR
      u.email ILIKE ${'%' + search + '%'}
    )
    ORDER BY u.created_at DESC
  `

  return NextResponse.json({ users })
}

// PATCH /api/admin/users — atualiza plano ou senha de um usuário
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const body = await req.json()
  const { userId, plan, newPassword } = body

  if (!userId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 })

  // Alterar senha
  if (newPassword) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Senha deve ter pelo menos 6 caracteres" }, { status: 400 })
    }
    const bcrypt = await import("bcryptjs")
    const hashed = await bcrypt.hash(newPassword, 10)
    await sql`UPDATE users SET password = ${hashed} WHERE id = ${userId}`
    return NextResponse.json({ success: true })
  }

  // Alterar plano
  if (!plan || !["free", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Não é possível alterar seu próprio plano aqui" }, { status: 400 })
  }

  await sql`
    INSERT INTO user_subscriptions (user_id, plan, updated_at)
    VALUES (${userId}, ${plan}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET plan = ${plan}, updated_at = NOW()
  `

  return NextResponse.json({ success: true })
}
