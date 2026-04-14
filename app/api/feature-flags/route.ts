import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  try {
    const rows = await sql`
      SELECT tts_enabled FROM user_feature_flags WHERE user_id = ${session.user.id} LIMIT 1
    `
    return NextResponse.json({
      tts_enabled: rows[0]?.tts_enabled ?? false,
    })
  } catch {
    return NextResponse.json({ tts_enabled: false })
  }
}
