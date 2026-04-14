import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

async function isSuperAdmin(userId: string) {
  const rows = await sql`SELECT is_super_admin FROM users WHERE id = ${userId} LIMIT 1`
  return rows[0]?.is_super_admin === true
}

// GET — lista flags de um usuário específico
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 })

  const rows = await sql`SELECT flag, enabled FROM user_feature_flags WHERE user_id = ${userId}`
  const flags: Record<string, boolean> = {}
  for (const row of rows) flags[row.flag] = row.enabled
  return NextResponse.json({ flags: { tts_enabled: flags["tts"] ?? false } })
}

// PATCH — atualiza uma flag de um usuário
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { userId, flag, value } = await req.json()
  if (!userId || !flag || typeof value !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }

  // Mapeia nome da flag do frontend para o valor EAV no banco
  const flagMap: Record<string, string> = { tts_enabled: "tts" }
  const dbFlag = flagMap[flag]
  if (!dbFlag) {
    return NextResponse.json({ error: "Flag inválida" }, { status: 400 })
  }

  // Upsert EAV — conflict em (user_id, flag)
  await sql`
    INSERT INTO user_feature_flags (user_id, flag, enabled, updated_at)
    VALUES (${userId}, ${dbFlag}, ${value}, NOW())
    ON CONFLICT (user_id, flag)
    DO UPDATE SET enabled = ${value}, updated_at = NOW()
  `

  return NextResponse.json({ success: true })
}
