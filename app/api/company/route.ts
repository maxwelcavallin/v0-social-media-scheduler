import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// GET /api/company — retorna a empresa do usuário logado
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const rows = await sql`
    SELECT c.id, c.name, c.document, c.document_type, c.owner_id, c.created_at,
      cm.role
    FROM company c
    JOIN company_member cm ON cm.company_id = c.id
    WHERE cm.user_id = ${session.user.id}
    LIMIT 1
  `
  if (rows.length === 0) return NextResponse.json({ company: null })
  return NextResponse.json({ company: rows[0] })
}

// POST /api/company — cria empresa (onboarding) e vincula workspaces existentes
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  // Verificar se o usuário já tem empresa
  const existing = await sql`
    SELECT c.id FROM company c
    JOIN company_member cm ON cm.company_id = c.id
    WHERE cm.user_id = ${session.user.id}
    LIMIT 1
  `
  if (existing.length > 0) {
    return NextResponse.json({ error: "Você já possui uma empresa cadastrada." }, { status: 400 })
  }

  const body = await req.json()
  const { name, document, document_type } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome da empresa é obrigatório." }, { status: 400 })
  }

  // Criar empresa
  const [company] = await sql`
    INSERT INTO company (name, document, document_type, owner_id)
    VALUES (${name.trim()}, ${document || null}, ${document_type || null}, ${session.user.id})
    RETURNING *
  `

  // Inserir owner como admin
  await sql`
    INSERT INTO company_member (company_id, user_id, role)
    VALUES (${company.id}, ${session.user.id}, 'admin')
  `

  // Vincular workspaces existentes do usuário a esta empresa
  await sql`
    UPDATE "organization" o
    SET company_id = ${company.id}
    FROM "member" m
    WHERE m.organization_id = o.id
      AND m.user_id = ${session.user.id}
      AND o.company_id IS NULL
  `

  return NextResponse.json({ company }, { status: 201 })
}

// PATCH /api/company — atualiza dados fiscais
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { name, document, document_type } = body

  // Verificar que é admin
  const rows = await sql`
    SELECT c.id FROM company c
    JOIN company_member cm ON cm.company_id = c.id
    WHERE cm.user_id = ${session.user.id} AND cm.role = 'admin'
    LIMIT 1
  `
  if (rows.length === 0) return NextResponse.json({ error: "Sem permissão." }, { status: 403 })

  const [updated] = await sql`
    UPDATE company
    SET name = COALESCE(${name || null}, name),
        document = ${document ?? null},
        document_type = ${document_type ?? null}
    WHERE id = ${rows[0].id}
    RETURNING *
  `
  return NextResponse.json({ company: updated })
}
