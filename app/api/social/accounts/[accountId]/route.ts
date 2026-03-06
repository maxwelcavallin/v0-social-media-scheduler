import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { accountId } = await params

  // Verify ownership through workspace membership
  const account = await sql`
    SELECT sa.id FROM social_accounts sa
    JOIN "member" m ON m.organization_id = sa.workspace_id
    WHERE sa.id = ${accountId} AND m.user_id = ${session.user.id}
    LIMIT 1
  `

  if (account.length === 0) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
  }

  await sql`DELETE FROM social_accounts WHERE id = ${accountId}`

  return NextResponse.json({ success: true })
}
