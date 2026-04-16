import sql from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// GET /api/review/[token] — busca dados do post para a página pública
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const [post] = await sql`
    SELECT
      p.id,
      p.content,
      p.status,
      p.review_status,
      p.review_notes,
      p.review_at,
      p.scheduled_at,
      p.created_at,
      sa.account_name,
      sa.account_username,
      sa.profile_picture_url,
      sa.platform,
      COALESCE(MAX(pt.post_type), p.post_type) AS post_type,
      COALESCE(
        json_agg(
          json_build_object('url', pm.url, 'media_type', pm.media_type, 'order_index', pm.order_index)
          ORDER BY pm.order_index
        ) FILTER (WHERE pm.id IS NOT NULL),
        '[]'
      ) AS media
    FROM posts p
    LEFT JOIN post_media pm ON pm.post_id = p.id
    LEFT JOIN post_targets pt ON pt.post_id = p.id
    LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
    WHERE p.review_token = ${token}
    GROUP BY p.id, sa.account_name, sa.account_username, sa.profile_picture_url, sa.platform
    LIMIT 1
  `

  if (!post) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 })

  return NextResponse.json(post)
}

// POST /api/review/[token] — aprovador envia decisão (sem auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await request.json()
  const { decision, notes } = body // decision: 'approved' | 'needs_changes'

  if (!decision || !["approved", "needs_changes"].includes(decision)) {
    return NextResponse.json({ error: "Decisão inválida" }, { status: 400 })
  }

  const [post] = await sql`
    SELECT id FROM posts WHERE review_token = ${token} LIMIT 1
  `
  if (!post) return NextResponse.json({ error: "Link inválido" }, { status: 404 })

  await sql`
    UPDATE posts
    SET
      review_status = ${decision},
      review_notes = ${notes ?? null},
      review_at = NOW(),
      updated_at = NOW()
    WHERE review_token = ${token}
  `

  return NextResponse.json({ success: true })
}
