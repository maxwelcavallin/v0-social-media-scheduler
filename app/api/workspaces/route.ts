import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { checkWorkspaceLimit } from "@/lib/plans"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { name, slug } = await request.json()

  if (!name || !slug) {
    return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 })
  }

  // Verificar limite de workspaces do plano
  const wsLimit = await checkWorkspaceLimit(session.user.id)
  if (!wsLimit.allowed) {
    return NextResponse.json(
      { error: `Seu plano gratuito permite apenas ${wsLimit.limit} workspace. Faça upgrade para o plano Pro para criar workspaces ilimitados.`, upgrade: true },
      { status: 403 }
    )
  }

  // Check slug uniqueness
  const existing = await sql`
    SELECT id FROM "organization" WHERE slug = ${slug}
  `
  if (existing.length > 0) {
    return NextResponse.json({ error: "Este identificador já está em uso. Escolha outro." }, { status: 409 })
  }

  try {
    const org = await sql`
      INSERT INTO "organization" (id, name, slug, created_at)
      VALUES (gen_random_uuid()::text, ${name}, ${slug}, NOW())
      RETURNING id, name, slug
    `
    const orgId = org[0].id

    // Add user as owner
    await sql`
      INSERT INTO "member" (id, organization_id, user_id, role, created_at)
      VALUES (gen_random_uuid()::text, ${orgId}, ${session.user.id}, 'owner', NOW())
    `

    return NextResponse.json(org[0])
  } catch (err) {
    console.error("[workspaces] Error creating workspace:", err)
    return NextResponse.json({ error: "Erro ao criar workspace" }, { status: 500 })
  }
}
