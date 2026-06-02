import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

/** PATCH — ativa ou desativa permissão MCP para uma conta social */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { accountId } = await params
  const { mcp_allowed } = await req.json()

  if (typeof mcp_allowed !== "boolean") {
    return NextResponse.json({ error: "mcp_allowed deve ser boolean" }, { status: 400 })
  }

  const rows = await sql`
    UPDATE social_accounts
    SET mcp_allowed = ${mcp_allowed}, updated_at = NOW()
    WHERE id = ${accountId}
    RETURNING id, mcp_allowed
  `
  if (!rows[0]) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })

  return NextResponse.json({ account: rows[0] })
}
