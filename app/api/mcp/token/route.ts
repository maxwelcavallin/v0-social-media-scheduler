import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { randomBytes } from "crypto"

/** GET — retorna o token existente do workspace */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId")
  if (!organizationId) return NextResponse.json({ error: "organizationId obrigatório" }, { status: 400 })

  const rows = await sql`
    SELECT id, token, created_at, last_used_at FROM mcp_tokens WHERE organization_id = ${organizationId}
  `
  return NextResponse.json({ token: rows[0] ?? null })
}

/** POST — gera (ou regenera) o Bearer Token do workspace */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { organizationId } = await req.json()
  if (!organizationId) return NextResponse.json({ error: "organizationId obrigatório" }, { status: 400 })

  const token = `mcp_${randomBytes(32).toString("hex")}`

  const rows = await sql`
    INSERT INTO mcp_tokens (organization_id, token, created_by)
    VALUES (${organizationId}, ${token}, ${session.user.id})
    ON CONFLICT (organization_id) DO UPDATE SET token = ${token}, created_by = ${session.user.id}, created_at = NOW(), last_used_at = NULL
    RETURNING id, token, created_at
  `
  return NextResponse.json({ token: rows[0] })
}

/** DELETE — revoga o Bearer Token do workspace */
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { organizationId } = await req.json()
  if (!organizationId) return NextResponse.json({ error: "organizationId obrigatório" }, { status: 400 })

  await sql`DELETE FROM mcp_tokens WHERE organization_id = ${organizationId}`
  return NextResponse.json({ success: true })
}
