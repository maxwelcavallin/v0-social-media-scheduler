import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// DELETE /api/posts/[postId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { postId } = await params

  // Check ownership via workspace membership
  const owned = await sql`
    SELECT p.id FROM posts p
    JOIN "organization" o ON o.id = p.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    WHERE p.id = ${postId} AND m.user_id = ${session.user.id}
    LIMIT 1
  `
  if (owned.length === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

  await sql`DELETE FROM post_media WHERE post_id = ${postId}`
  await sql`DELETE FROM post_targets WHERE post_id = ${postId}`
  await sql`DELETE FROM post_queue WHERE post_id = ${postId}`
  await sql`DELETE FROM posts WHERE id = ${postId}`

  return NextResponse.json({ success: true })
}

// PATCH /api/posts/[postId] — edit content, scheduledAt, accountIds
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { postId } = await params
  const body = await request.json()
  const { content, scheduledAt, accountIds, postType, media, coverMedia, scheduleType } = body

  const owned = await sql`
    SELECT p.id, p.status FROM posts p
    JOIN "organization" o ON o.id = p.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    WHERE p.id = ${postId} AND m.user_id = ${session.user.id}
    LIMIT 1
  `
  if (owned.length === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  if (owned[0].status === "published") {
    return NextResponse.json({ error: "Posts publicados não podem ser editados" }, { status: 400 })
  }

  // Convert scheduledAt from Brasília to UTC
  let finalScheduledAt: string | null = null
  if (scheduledAt) {
    const hasTz = /[Z+\-]\d{2}:\d{2}$/.test(scheduledAt) || scheduledAt.endsWith("Z")
    finalScheduledAt = hasTz ? new Date(scheduledAt).toISOString() : new Date(`${scheduledAt}-03:00`).toISOString()
  }

  // Determinar novo status baseado no scheduleType
  const newStatus = scheduleType === "draft"
    ? "draft"
    : scheduleType === "scheduled" && finalScheduledAt
    ? "scheduled"
    : owned[0].status // manter status atual se não especificado

  await sql`
    UPDATE posts
    SET content = ${content || ""},
        scheduled_at = ${finalScheduledAt},
        status = ${newStatus},
        post_type = ${postType || "feed"},
        updated_at = NOW()
    WHERE id = ${postId}
  `

  // Atualizar mídia se fornecida
  if (media !== undefined) {
    await sql`DELETE FROM post_media WHERE post_id = ${postId}`
    if (media && media.length > 0) {
      for (let i = 0; i < media.length; i++) {
        const m = media[i]
        await sql`
          INSERT INTO post_media (id, post_id, url, media_type, order_index, created_at)
          VALUES (gen_random_uuid(), ${postId}, ${m.url}, ${m.type || "image"}, ${i}, NOW())
        `
      }
    }
    // Capa do reel salva com order_index = -1
    if (coverMedia?.url) {
      await sql`
        INSERT INTO post_media (id, post_id, url, media_type, order_index, created_at)
        VALUES (gen_random_uuid(), ${postId}, ${coverMedia.url}, 'image', -1, NOW())
        ON CONFLICT DO NOTHING
      `
    }
  }

  // Update targets: se accountIds foi enviado, recriar; caso contrário, só atualizar post_type
  if (accountIds && accountIds.length > 0) {
    await sql`DELETE FROM post_targets WHERE post_id = ${postId}`
    await sql`DELETE FROM post_queue WHERE post_id = ${postId}`
    for (const accountId of accountIds) {
      await sql`
        INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
        VALUES (gen_random_uuid(), ${postId}, ${accountId}, ${postType || "feed"}, 'pending', NOW())
      `
    }
    if (finalScheduledAt && newStatus === "scheduled") {
      await sql`
        INSERT INTO post_queue (post_id, scheduled_at, status, attempts, max_attempts)
        VALUES (${postId}, ${finalScheduledAt}, 'pending', 0, 3)
      `
    }
  } else if (postType) {
    // Sem novos accountIds — apenas sincroniza o post_type nos targets existentes
    await sql`
      UPDATE post_targets SET post_type = ${postType} WHERE post_id = ${postId}
    `
  }
    if (finalScheduledAt) {
      await sql`
        INSERT INTO post_queue (post_id, scheduled_at, status, attempts, max_attempts)
        VALUES (${postId}, ${finalScheduledAt}, 'pending', 0, 3)
      `
    }
  }

  return NextResponse.json({ success: true })
}

// PATCH cancel: /api/posts/[postId]/cancel
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { postId } = await params

  const owned = await sql`
    SELECT p.id FROM posts p
    JOIN "organization" o ON o.id = p.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    WHERE p.id = ${postId} AND m.user_id = ${session.user.id} AND p.status = 'scheduled'
    LIMIT 1
  `
  if (owned.length === 0) return NextResponse.json({ error: "Post não encontrado ou não agendado" }, { status: 404 })

  await sql`UPDATE posts SET status = 'draft', scheduled_at = NULL, updated_at = NOW() WHERE id = ${postId}`
  await sql`DELETE FROM post_queue WHERE post_id = ${postId}`

  return NextResponse.json({ success: true })
}
