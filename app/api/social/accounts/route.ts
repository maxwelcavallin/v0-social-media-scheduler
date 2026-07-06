import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { getUserCompany } from "@/lib/company"

// GET /api/social/accounts
// Lista o POOL GLOBAL de contas conectadas da EMPRESA do usuário logado.
// Usado na Visão Geral, onde a conexão de contas passa a viver. As contas ficam
// disponíveis para qualquer workspace (atual ou futuro) selecionar depois.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const company = await getUserCompany(session.user.id)
  if (!company) return NextResponse.json({ accounts: [], company: null })

  const pool = await sql`
    SELECT id, platform, external_id, page_id, name, username, picture_url, source, updated_at
    FROM connected_accounts
    WHERE company_id = ${company.id}
    ORDER BY platform ASC, name ASC
  `

  const accounts = pool.map((a: any) => ({
    id: a.id,
    platform: a.platform as "facebook" | "instagram",
    externalId: a.external_id,
    pageId: a.page_id,
    name: a.name,
    username: a.username,
    pictureUrl: a.picture_url,
    source: a.source as "facebook" | "instagram_direct",
  }))

  return NextResponse.json({ accounts, company: { id: company.id, name: company.name } })
}
