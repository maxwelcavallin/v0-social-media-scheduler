import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const { workspaceId, content, postType, scheduleType, scheduledAt, accountIds, media } = body

  if (!workspaceId || !accountIds || accountIds.length === 0) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }

  // Verify workspace access
  const membership = await sql`
    SELECT id FROM "member"
    WHERE "organizationId" = ${workspaceId} AND "userId" = ${session.user.id}
    LIMIT 1
  `
  if (membership.length === 0) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const status = scheduleType === "now" ? "draft" : "scheduled"
  const finalScheduledAt = scheduleType === "scheduled" ? scheduledAt : null

  try {
    // Create post
    const post = await sql`
      INSERT INTO posts (id, workspace_id, content, status, scheduled_at, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), ${workspaceId}, ${content}, ${status}, ${finalScheduledAt}, ${session.user.id}, NOW(), NOW())
      RETURNING id
    `
    const postId = post[0].id

    // Save media
    if (media && media.length > 0) {
      for (let i = 0; i < media.length; i++) {
        const m = media[i]
        const mediaType = m.type === "video" ? "video" : "image"
        await sql`
          INSERT INTO post_media (id, post_id, media_url, media_type, mime_type, order_index, created_at)
          VALUES (gen_random_uuid(), ${postId}, ${m.url}, ${mediaType}, ${m.name}, ${i}, NOW())
        `
      }
    }

    // Create post targets for each account
    for (const accountId of accountIds) {
      const target = await sql`
        INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
        VALUES (gen_random_uuid(), ${postId}, ${accountId}, ${postType}, 'pending', NOW())
        RETURNING id
      `
      const targetId = target[0].id

      // Add to queue
      const queueScheduledAt = finalScheduledAt || new Date().toISOString()
      await sql`
        INSERT INTO post_queue (id, post_target_id, scheduled_at, status, attempts, max_attempts, created_at)
        VALUES (gen_random_uuid(), ${targetId}, ${queueScheduledAt}, 'pending', 0, 3, NOW())
      `
    }

    // If publishing now, trigger the queue processor
    if (scheduleType === "now") {
      // Fire-and-forget — the queue will process immediately
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/queue/process`, {
        method: "POST",
        headers: { "x-queue-secret": process.env.QUEUE_SECRET || "" },
      }).catch(() => {})
    }

    return NextResponse.json({ id: postId })
  } catch (err) {
    console.error("[posts] Error creating post:", err)
    return NextResponse.json({ error: "Erro ao criar post" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const workspaceId = searchParams.get("workspaceId")
  const month = searchParams.get("month") // YYYY-MM format

  let posts

  if (workspaceId && month) {
    const [year, monthNum] = month.split("-")
    const startDate = `${year}-${monthNum}-01`
    const endDate = new Date(parseInt(year), parseInt(monthNum), 1).toISOString().split("T")[0]
    posts = await sql`
      SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
        o.id as workspace_id, o.name as workspace_name,
        ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
        ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
        COUNT(DISTINCT pm.id)::int as media_count
      FROM posts p
      JOIN "organization" o ON o.id = p.workspace_id
      JOIN "member" m ON m."organizationId" = o.id
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
      LEFT JOIN post_media pm ON pm.post_id = p.id
      WHERE m."userId" = ${session.user.id}
        AND p.workspace_id = ${workspaceId}
        AND p.scheduled_at >= ${startDate}
        AND p.scheduled_at < ${endDate}
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `
  } else if (workspaceId) {
    posts = await sql`
      SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
        o.id as workspace_id, o.name as workspace_name,
        ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
        ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
        COUNT(DISTINCT pm.id)::int as media_count
      FROM posts p
      JOIN "organization" o ON o.id = p.workspace_id
      JOIN "member" m ON m."organizationId" = o.id
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
      LEFT JOIN post_media pm ON pm.post_id = p.id
      WHERE m."userId" = ${session.user.id}
        AND p.workspace_id = ${workspaceId}
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `
  } else if (month) {
    const [year, monthNum] = month.split("-")
    const startDate = `${year}-${monthNum}-01`
    const endDate = new Date(parseInt(year), parseInt(monthNum), 1).toISOString().split("T")[0]
    posts = await sql`
      SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
        o.id as workspace_id, o.name as workspace_name,
        ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
        ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
        COUNT(DISTINCT pm.id)::int as media_count
      FROM posts p
      JOIN "organization" o ON o.id = p.workspace_id
      JOIN "member" m ON m."organizationId" = o.id
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
      LEFT JOIN post_media pm ON pm.post_id = p.id
      WHERE m."userId" = ${session.user.id}
        AND p.scheduled_at >= ${startDate}
        AND p.scheduled_at < ${endDate}
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `
  } else {
    posts = await sql`
      SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
        o.id as workspace_id, o.name as workspace_name,
        ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
        ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
        COUNT(DISTINCT pm.id)::int as media_count
      FROM posts p
      JOIN "organization" o ON o.id = p.workspace_id
      JOIN "member" m ON m."organizationId" = o.id
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
      LEFT JOIN post_media pm ON pm.post_id = p.id
      WHERE m."userId" = ${session.user.id}
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `
  }

  return NextResponse.json(posts)
}
