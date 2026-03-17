import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// POST /api/posts/[postId]/publish
// Promotes a draft to "publishing" (now) or "scheduled"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { postId } = await params
  const body = await request.json()
  const { scheduleType, scheduledAt, accountIds } = body

  // Verify ownership and that it's a draft
  const owned = await sql`
    SELECT p.id, p.workspace_id FROM posts p
    JOIN "organization" o ON o.id = p.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    WHERE p.id = ${postId} AND m.user_id = ${session.user.id} AND p.status = 'draft'
    LIMIT 1
  `
  if (owned.length === 0) {
    return NextResponse.json({ error: "Rascunho não encontrado" }, { status: 404 })
  }

  const workspaceId = owned[0].workspace_id

  // Convert scheduledAt from Brasília to UTC if provided
  let finalScheduledAt: string | null = null
  if (scheduleType === "scheduled" && scheduledAt) {
    const hasTz = /[Z+\-]\d{2}:\d{2}$/.test(scheduledAt) || scheduledAt.endsWith("Z")
    finalScheduledAt = hasTz
      ? new Date(scheduledAt).toISOString()
      : new Date(`${scheduledAt}-03:00`).toISOString()
  }

  const publishNow = scheduleType === "now"

  // If accountIds provided, update post_targets
  if (accountIds && accountIds.length > 0) {
    await sql`DELETE FROM post_targets WHERE post_id = ${postId}`
    for (const accountId of accountIds) {
      await sql`
        INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
        SELECT gen_random_uuid(), ${postId}, ${accountId}, COALESCE(post_type, 'feed'), 'pending', NOW()
        FROM post_targets WHERE post_id = ${postId} LIMIT 1
      `
    }
  }

  // Ensure there are targets
  const targets = await sql`
    SELECT pt.id, pt.post_type, sa.platform, sa.page_id, sa.account_id, sa.access_token
    FROM post_targets pt
    JOIN social_accounts sa ON sa.id = pt.social_account_id
    WHERE pt.post_id = ${postId}
  `

  if (targets.length === 0) {
    return NextResponse.json({ error: "Nenhuma conta vinculada a este rascunho. Selecione uma conta antes de publicar." }, { status: 400 })
  }

  if (publishNow) {
    // Update to publishing and enqueue immediately
    await sql`
      UPDATE posts SET status = 'publishing', scheduled_at = NULL, updated_at = NOW() WHERE id = ${postId}
    `
    // Update all targets to pending for immediate processing
    await sql`UPDATE post_targets SET status = 'pending' WHERE post_id = ${postId}`

    // Insert into queue with scheduled_at = NOW() so cron picks it up immediately
    await sql`DELETE FROM post_queue WHERE post_id = ${postId}`
    await sql`
      INSERT INTO post_queue (id, post_id, scheduled_at, status, attempts, max_attempts, created_at, updated_at)
      VALUES (gen_random_uuid(), ${postId}, NOW(), 'pending', 0, 3, NOW(), NOW())
    `
  } else {
    // Schedule for later
    await sql`
      UPDATE posts SET status = 'scheduled', scheduled_at = ${finalScheduledAt}, updated_at = NOW() WHERE id = ${postId}
    `
    await sql`UPDATE post_targets SET status = 'pending' WHERE post_id = ${postId}`
    await sql`DELETE FROM post_queue WHERE post_id = ${postId}`
    await sql`
      INSERT INTO post_queue (id, post_id, scheduled_at, status, attempts, max_attempts, created_at, updated_at)
      VALUES (gen_random_uuid(), ${postId}, ${finalScheduledAt}, 'pending', 0, 3, NOW(), NOW())
    `
  }

  return NextResponse.json({ success: true, status: publishNow ? "publishing" : "scheduled" })
}
