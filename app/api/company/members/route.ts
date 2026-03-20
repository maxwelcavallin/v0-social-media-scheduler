import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// GET /api/company/members — lista membros da empresa
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const rows = await sql`
    SELECT cm.id, cm.role, cm.joined_at,
      u.id as user_id, u.name, u.email
    FROM company_member cm
    JOIN users u ON u.id = cm.user_id
    JOIN company_member my_cm ON my_cm.company_id = cm.company_id
    WHERE my_cm.user_id = ${session.user.id}
    ORDER BY cm.joined_at ASC
  `
  return NextResponse.json({ members: rows })
}

// DELETE /api/company/members — remover membro (apenas admin)
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { user_id } = body

  // Verificar admin
  const adminRow = await sql`
    SELECT c.id as company_id, c.owner_id FROM company c
    JOIN company_member cm ON cm.company_id = c.id
    WHERE cm.user_id = ${session.user.id} AND cm.role = 'admin'
    LIMIT 1
  `
  if (adminRow.length === 0) return NextResponse.json({ error: "Sem permissão." }, { status: 403 })

  // Não pode remover o owner
  if (adminRow[0].owner_id === user_id) {
    return NextResponse.json({ error: "Não é possível remover o administrador principal." }, { status: 400 })
  }

  await sql`
    DELETE FROM company_member
    WHERE company_id = ${adminRow[0].company_id} AND user_id = ${user_id}
  `
  return NextResponse.json({ ok: true })
}
