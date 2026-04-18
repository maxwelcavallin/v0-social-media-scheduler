import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// Verifica que o caller é admin da mesma empresa que o target user
async function verifyAdmin(callerId: string, targetUserId: string) {
  const rows = await sql`
    SELECT cm.company_id
    FROM company_member cm
    WHERE cm.user_id = ${callerId} AND cm.role = 'admin'
    AND EXISTS (
      SELECT 1 FROM company_member cm2
      WHERE cm2.user_id = ${targetUserId} AND cm2.company_id = cm.company_id
    )
    LIMIT 1
  `
  return rows[0]?.company_id ?? null
}

// PATCH — adicionar ou remover o user de um workspace específico
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { userId } = await params
  const { workspace_id, action } = await req.json() // action: "add" | "remove"

  if (!workspace_id || !["add", "remove"].includes(action)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  }

  const companyId = await verifyAdmin(session.user.id, userId)
  if (!companyId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  // Confirmar que o workspace pertence à empresa
  const wsCheck = await sql`
    SELECT o.id FROM "organization" o
    JOIN "member" m ON m.organization_id = o.id
    JOIN company_member cm ON cm.user_id = m.user_id AND cm.company_id = ${companyId}
    WHERE o.id = ${workspace_id}
    LIMIT 1
  `
  if (!wsCheck[0]) return NextResponse.json({ error: "Workspace não pertence à empresa" }, { status: 403 })

  if (action === "add") {
    await sql`
      INSERT INTO "member" (organization_id, user_id, role)
      VALUES (${workspace_id}, ${userId}, 'member')
      ON CONFLICT (organization_id, user_id) DO NOTHING
    `
  } else {
    await sql`
      DELETE FROM "member"
      WHERE organization_id = ${workspace_id} AND user_id = ${userId}
    `
  }

  return NextResponse.json({ success: true })
}

// DELETE — remover o user completamente da empresa e de todos os workspaces
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { userId } = await params

  // Não pode remover a si mesmo
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Você não pode remover a si mesmo" }, { status: 400 })
  }

  const companyId = await verifyAdmin(session.user.id, userId)
  if (!companyId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  // Remover de todos os workspaces da empresa
  await sql`
    DELETE FROM "member"
    WHERE user_id = ${userId}
    AND organization_id IN (
      SELECT o.id FROM "organization" o
      JOIN "member" m ON m.organization_id = o.id
      JOIN company_member cm ON cm.user_id = m.user_id AND cm.company_id = ${companyId}
      GROUP BY o.id
    )
  `

  // Remover da empresa
  await sql`
    DELETE FROM company_member
    WHERE user_id = ${userId} AND company_id = ${companyId}
  `

  return NextResponse.json({ success: true })
}
