import sql from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// GET /api/review-batches/[token] — busca todos os posts do lote (público, sem auth)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const [batch] = await sql`
    SELECT id, title FROM review_batches WHERE token = ${token} LIMIT 1
  `
  if (!batch) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 })

  const posts = await sql`
    SELECT
      p.id,
      p.content,
      p.status,
      p.scheduled_at,
      p.post_type,
      rbp.position,
      rbp.review_status,
      rbp.review_notes,
      rbp.review_at,
      -- Conta via post_targets (posts publicados/agendados)
      -- Fallback: primeira conta Instagram do workspace, depois Facebook
      COALESCE(
        MAX(CASE WHEN sa_t.platform = 'instagram' THEN sa_t.account_username END),
        MAX(CASE WHEN sa_t.platform = 'facebook'  THEN sa_t.account_username END),
        MAX(CASE WHEN sa_w.platform = 'instagram' THEN sa_w.account_username END),
        MAX(CASE WHEN sa_w.platform = 'facebook'  THEN sa_w.account_username END)
      ) AS account_username,
      COALESCE(
        MAX(CASE WHEN sa_t.platform = 'instagram' THEN sa_t.account_name END),
        MAX(CASE WHEN sa_t.platform = 'facebook'  THEN sa_t.account_name END),
        MAX(CASE WHEN sa_w.platform = 'instagram' THEN sa_w.account_name END),
        MAX(CASE WHEN sa_w.platform = 'facebook'  THEN sa_w.account_name END)
      ) AS account_name,
      COALESCE(
        MAX(CASE WHEN sa_t.platform = 'instagram' THEN sa_t.profile_picture_url END),
        MAX(CASE WHEN sa_t.platform = 'facebook'  THEN sa_t.profile_picture_url END),
        MAX(CASE WHEN sa_w.platform = 'instagram' THEN sa_w.profile_picture_url END),
        MAX(CASE WHEN sa_w.platform = 'facebook'  THEN sa_w.profile_picture_url END)
      ) AS profile_picture_url,
      COALESCE(
        MAX(CASE WHEN sa_t.platform = 'instagram' THEN sa_t.platform END),
        MAX(CASE WHEN sa_t.platform = 'facebook'  THEN sa_t.platform END),
        MAX(CASE WHEN sa_w.platform = 'instagram' THEN sa_w.platform END),
        MAX(CASE WHEN sa_w.platform = 'facebook'  THEN sa_w.platform END)
      ) AS platform,
      COALESCE(
        json_agg(
          json_build_object('url', pm.url, 'media_type', pm.media_type, 'order_index', pm.order_index)
          ORDER BY pm.order_index
        ) FILTER (WHERE pm.id IS NOT NULL),
        '[]'
      ) AS media
    FROM review_batch_posts rbp
    JOIN posts p ON p.id = rbp.post_id::uuid
    -- Contas via post_targets (rascunhos com conta já selecionada)
    LEFT JOIN post_targets pt       ON pt.post_id = p.id
    LEFT JOIN social_accounts sa_t  ON sa_t.id = pt.social_account_id
    -- Fallback: qualquer conta do workspace (para rascunhos sem target ainda)
    LEFT JOIN social_accounts sa_w  ON sa_w.workspace_id = p.workspace_id
    LEFT JOIN post_media pm ON pm.post_id = p.id
    WHERE rbp.batch_id = ${batch.id}
    GROUP BY p.id, p.content, p.status, p.scheduled_at, p.post_type, rbp.position, rbp.review_status, rbp.review_notes, rbp.review_at
    ORDER BY rbp.position ASC
  `

  return NextResponse.json({ title: batch.title, posts })
}

// POST /api/review-batches/[token] — aprova/solicita ajuste em um post do lote (público, sem auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await request.json()
  const { postId, decision, notes } = body as {
    postId: string
    decision: "approved" | "needs_changes"
    notes?: string
  }

  if (!postId || !decision || !["approved", "needs_changes"].includes(decision)) {
    return NextResponse.json({ error: "postId e decision são obrigatórios" }, { status: 400 })
  }

  const [batch] = await sql`
    SELECT id FROM review_batches WHERE token = ${token} LIMIT 1
  `
  if (!batch) return NextResponse.json({ error: "Link inválido" }, { status: 404 })

  await sql`
    UPDATE review_batch_posts
    SET review_status = ${decision}, review_notes = ${notes ?? null}, review_at = NOW()
    WHERE batch_id = ${batch.id} AND post_id = ${postId}
  `

  // Atualiza também o status no post original para visibilidade na plataforma
  await sql`
    UPDATE posts
    SET review_status = ${decision}, review_notes = ${notes ?? null}, review_at = NOW(), updated_at = NOW()
    WHERE id = ${postId}::uuid
  `

  return NextResponse.json({ success: true })
}
