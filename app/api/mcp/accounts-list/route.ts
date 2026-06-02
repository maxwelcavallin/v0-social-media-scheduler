import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

/** GET — lista contas sociais de um workspace para a tela de configuração MCP */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId")
  if (!organizationId) return NextResponse.json({ error: "organizationId obrigatório" }, { status: 400 })

  const accounts = await sql`
    SELECT id, platform, account_name, account_username, mcp_allowed, is_active
    FROM social_accounts
    WHERE workspace_id = ${organizationId}
      AND platform IN ('instagram', 'facebook')
    ORDER BY platform, account_name
  `
  return NextResponse.json({ accounts })
}
