import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { getSession } from "@/lib/session"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const post_id = searchParams.get("post_id")
  const level = searchParams.get("level")
  const limit = Math.min(Number(searchParams.get("limit") || "100"), 500)

  const rows = await sql`
    SELECT id, created_at, level, post_id, queue_id, platform, message, details
    FROM queue_logs
    WHERE
      (${post_id}::uuid IS NULL OR post_id = ${post_id}::uuid)
      AND (${level} IS NULL OR level = ${level})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  return NextResponse.json({ logs: rows })
}

// DELETE — limpa logs antigos (mais de 7 dias)
export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await sql`
    DELETE FROM queue_logs WHERE created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  `
  return NextResponse.json({ deleted: result.length })
}
