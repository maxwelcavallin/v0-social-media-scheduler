import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const rows = await sql`
    SELECT id, text_preview, voice_name, config, created_at
    FROM tts_history
    WHERE user_id = ${session.user.id}
    ORDER BY created_at DESC
    LIMIT 50
  `
  return NextResponse.json({ history: rows })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await req.json()
  await sql`DELETE FROM tts_history WHERE id = ${id} AND user_id = ${session.user.id}`
  return NextResponse.json({ success: true })
}
