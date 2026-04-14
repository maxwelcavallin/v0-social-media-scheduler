import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  try {
    const rows = await sql`
      SELECT id, text_preview, voice_name, config, created_at
      FROM tts_history
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `
    return NextResponse.json({ history: rows })
  } catch (err: any) {
    console.error("[TTS history GET]", err)
    return NextResponse.json({ error: err.message || "Erro ao buscar histórico" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  try {
    const { id } = await req.json()
    await sql`DELETE FROM tts_history WHERE id = ${id} AND user_id = ${session.user.id}`
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[TTS history DELETE]", err)
    return NextResponse.json({ error: err.message || "Erro ao excluir" }, { status: 500 })
  }
}
