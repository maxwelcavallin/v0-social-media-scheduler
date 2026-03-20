import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// DELETE /api/company/invitations/[token]/delete
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const adminRow = await sql`
    SELECT c.id as company_id FROM company c
    JOIN company_member cm ON cm.company_id = c.id
    WHERE cm.user_id = ${session.user.id} AND cm.role = 'admin'
    LIMIT 1
  `
  if (adminRow.length === 0) return NextResponse.json({ error: "Sem permissão." }, { status: 403 })

  await sql`
    DELETE FROM company_invitation
    WHERE token = ${token} AND company_id = ${adminRow[0].company_id}
  `
  return NextResponse.json({ ok: true })
}
