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

  const rows = await sql`SELECT * FROM user_feature_flags WHERE user_id = ${userId} LIMIT 1`
  return NextResponse.json({ flags: rows[0] ?? { user_id: userId, tts_enabled: false } })
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

  const allowedFlags = ["tts_enabled"]
  if (!allowedFlags.includes(flag)) {
    return NextResponse.json({ error: "Flag inválida" }, { status: 400 })
  }

  // Upsert — cria ou atualiza a linha de flags do usuário
  if (flag === "tts_enabled") {
    await sql`
      INSERT INTO user_feature_flags (user_id, tts_enabled, updated_at)
      VALUES (${userId}, ${value}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET tts_enabled = ${value}, updated_at = NOW()
    `
  }

  return NextResponse.json({ success: true })
}
