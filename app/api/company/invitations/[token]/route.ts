import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// GET /api/company/invitations/[token] — info do convite (para página de aceite)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rows = await sql`
    SELECT ci.id, ci.email, ci.role, ci.accepted_at, c.name as company_name
    FROM company_invitation ci
    JOIN company c ON c.id = ci.company_id
    WHERE ci.token = ${token}
  `
  if (rows.length === 0) return NextResponse.json({ error: "Convite inválido." }, { status: 404 })
  return NextResponse.json({ invitation: rows[0] })
}

// POST /api/company/invitations/[token] — aceitar convite
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Faça login para aceitar o convite." }, { status: 401 })

  const rows = await sql`
    SELECT ci.*, c.name as company_name
    FROM company_invitation ci
    JOIN company c ON c.id = ci.company_id
    WHERE ci.token = ${token} AND ci.accepted_at IS NULL
  `
  if (rows.length === 0) return NextResponse.json({ error: "Convite inválido ou já utilizado." }, { status: 404 })
  const invitation = rows[0]

  // Verificar se o e-mail bate
  if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json({ error: "Este convite foi enviado para outro e-mail." }, { status: 403 })
  }

  // Inserir como membro
  await sql`
    INSERT INTO company_member (company_id, user_id, role)
    VALUES (${invitation.company_id}, ${session.user.id}, ${invitation.role})
    ON CONFLICT (company_id, user_id) DO NOTHING
  `

  // Marcar convite como aceito
  await sql`
    UPDATE company_invitation SET accepted_at = NOW() WHERE id = ${invitation.id}
  `

  return NextResponse.json({ company_name: invitation.company_name })
}
