import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { postId } = await params

  // Busca o post original garantindo que pertence ao usuário
  const [post] = await sql`
    SELECT p.id, p.content, p.workspace_id
    FROM posts p
    JOIN workspaces w ON w.id = p.workspace_id
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE p.id = ${postId} AND wm.user_id = ${session.user.id}
    LIMIT 1
  `
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 })

  // Busca mídias e targets do original
  const [media, targets] = await Promise.all([
    sql`
      SELECT url, media_type, order_index
      FROM post_media WHERE post_id = ${postId} ORDER BY order_index ASC
    `,
    sql`
      SELECT social_account_id, post_type
      FROM post_targets WHERE post_id = ${postId}
    `,
  ])

  // Cria o post duplicado como rascunho
  const [newPost] = await sql`
    INSERT INTO posts (content, status, workspace_id, created_at, updated_at)
    VALUES (${post.content}, 'draft', ${post.workspace_id}, NOW(), NOW())
    RETURNING id
  `

  // Duplica mídias
  if (media.length > 0) {
    for (const m of media) {
      await sql`
        INSERT INTO post_media (id, post_id, url, media_type, order_index, created_at)
        VALUES (gen_random_uuid(), ${newPost.id}, ${m.url}, ${m.media_type}, ${m.order_index}, NOW())
      `
    }
  }

  // Duplica targets (contas + tipo de post)
  if (targets.length > 0) {
    for (const t of targets) {
      await sql`
        INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
        VALUES (gen_random_uuid(), ${newPost.id}, ${t.social_account_id}, ${t.post_type}, 'pending', NOW())
      `
    }
  }

  return NextResponse.json({ id: newPost.id }, { status: 201 })
}
