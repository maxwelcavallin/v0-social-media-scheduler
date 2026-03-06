import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { name, slug } = await request.json()
  if (!name || !slug) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })

  // Verify ownership
  const membership = await sql`
    SELECT id FROM "member"
    WHERE "organizationId" = ${workspaceId} AND "userId" = ${session.user.id}
    LIMIT 1
  `
  if (membership.length === 0)
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  // Check slug uniqueness (exclude current)
  const existing = await sql`
    SELECT id FROM "organization" WHERE slug = ${slug} AND id != ${workspaceId}
  `
  if (existing.length > 0)
    return NextResponse.json({ error: "Este identificador já está em uso." }, { status: 409 })

  await sql`
    UPDATE "organization" SET name = ${name}, slug = ${slug} WHERE id = ${workspaceId}
  `

  return NextResponse.json({ success: true })
}
