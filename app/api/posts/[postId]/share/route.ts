import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

// POST /api/posts/[postId]/share — gera ou retorna token de revisão
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { postId } = await params

  const owned = await sql`
    SELECT p.id, p.review_token FROM posts p
    JOIN "organization" o ON o.id = p.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    WHERE p.id = ${postId} AND m.user_id = ${session.user.id}
    LIMIT 1
  `
  if (owned.length === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

  // Reutiliza token existente ou gera novo
  let token = owned[0].review_token
  if (!token) {
    token = randomBytes(24).toString("hex")
    await sql`
      UPDATE posts
      SET review_token = ${token}, review_status = 'in_review', updated_at = NOW()
      WHERE id = ${postId}
    `
  } else {
    await sql`
      UPDATE posts
      SET review_status = 'in_review', updated_at = NOW()
      WHERE id = ${postId}
    `
  }

  const baseUrl = request.nextUrl.origin
  return NextResponse.json({ token, url: `${baseUrl}/review/${token}` })
}
