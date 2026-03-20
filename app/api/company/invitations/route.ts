import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// GET /api/company/invitations — lista convites pendentes
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const rows = await sql`
    SELECT ci.id, ci.email, ci.role, ci.created_at, ci.accepted_at,
      u.name as invited_by_name
    FROM company_invitation ci
    JOIN company_member cm ON cm.company_id = ci.company_id
    JOIN users u ON u.id = ci.invited_by
    WHERE cm.user_id = ${session.user.id} AND cm.role = 'admin'
      AND ci.accepted_at IS NULL
    ORDER BY ci.created_at DESC
  `
  return NextResponse.json({ invitations: rows })
}

// POST /api/company/invitations — enviar convite
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { email, role = "member" } = body

  if (!email?.trim()) {
    return NextResponse.json({ error: "E-mail obrigatório." }, { status: 400 })
  }

  // Verificar que é admin
  const adminRow = await sql`
    SELECT c.id as company_id FROM company c
    JOIN company_member cm ON cm.company_id = c.id
    WHERE cm.user_id = ${session.user.id} AND cm.role = 'admin'
    LIMIT 1
  `
  if (adminRow.length === 0) return NextResponse.json({ error: "Sem permissão." }, { status: 403 })
  const companyId = adminRow[0].company_id

  // Verificar se o usuário já é membro
  const alreadyMember = await sql`
    SELECT cm.id FROM company_member cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.company_id = ${companyId} AND u.email = ${email.toLowerCase()}
  `
  if (alreadyMember.length > 0) {
    return NextResponse.json({ error: "Este usuário já é membro da empresa." }, { status: 400 })
  }

  // Upsert convite
  const [invitation] = await sql`
    INSERT INTO company_invitation (company_id, email, role, invited_by)
    VALUES (${companyId}, ${email.toLowerCase()}, ${role}, ${session.user.id})
    ON CONFLICT (company_id, email) DO UPDATE
      SET role = EXCLUDED.role, token = gen_random_uuid()::text, accepted_at = NULL, created_at = NOW()
    RETURNING *
  `

  // TODO: enviar e-mail com convite (implementar com provedor de e-mail)
  // Por ora, retornamos o token para exibição manual
  return NextResponse.json({ invitation }, { status: 201 })
}
