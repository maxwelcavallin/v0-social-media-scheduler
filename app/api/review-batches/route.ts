import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

// POST /api/review-batches — cria um lote de revisão com múltiplos posts
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await request.json()
  const { postIds, workspaceId, title } = body as {
    postIds: string[]
    workspaceId: string
    title?: string
  }

  if (!postIds?.length || !workspaceId) {
    return NextResponse.json({ error: "postIds e workspaceId são obrigatórios" }, { status: 400 })
  }

  try {
    // Verifica que todos os posts pertencem ao workspace do usuário
    const owned = await sql`
      SELECT id FROM posts
      WHERE id = ANY(${postIds}::text[])
        AND workspace_id = ${workspaceId}
        AND status = 'draft'
    `
    if (owned.length !== postIds.length) {
      return NextResponse.json(
        { error: "Um ou mais posts não encontrados ou não são rascunhos" },
        { status: 400 }
      )
    }

    const token = randomBytes(24).toString("hex")

    // Cria o lote
    const [batch] = await sql`
      INSERT INTO review_batches (workspace_id, token, title, created_by)
      VALUES (${workspaceId}, ${token}, ${title ?? null}, ${session.user.id})
      RETURNING id, token
    `

    // Cria os vínculos com posição ordenada
    for (let i = 0; i < postIds.length; i++) {
      await sql`
        INSERT INTO review_batch_posts (batch_id, post_id, position, review_status)
        VALUES (${batch.id}, ${postIds[i]}, ${i}, 'in_review')
      `
    }

    // Marca os posts como in_review
    await sql`
      UPDATE posts
      SET review_status = 'in_review', updated_at = NOW()
      WHERE id = ANY(${postIds}::text[])
    `

    const baseUrl = request.nextUrl.origin
    return NextResponse.json({
      token: batch.token,
      url: `${baseUrl}/review/batch/${batch.token}`,
    })
  } catch (err: any) {
    console.error("[v0] review-batches error:", err?.message)
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 })
  }
}
