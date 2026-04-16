import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { checkPostsThisMonth } from "@/lib/plans"
import { publishToFacebook, publishToInstagram } from "@/lib/publish"

// ─── POST /api/posts ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const { workspaceId, content, postType, scheduleType, scheduledAt, accountIds, media, coverMedia } = body

  const isDraft = scheduleType === "draft"
  // Drafts don't require accounts — all other types do
  if (!workspaceId || (!isDraft && (!accountIds || accountIds.length === 0))) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }

  // Verificar limite de posts do plano (rascunhos não contam)
  if (!isDraft) {
    const postLimit = await checkPostsThisMonth(session.user.id, workspaceId)
    if (!postLimit.allowed) {
      return NextResponse.json(
        { error: `Você atingiu o limite de ${postLimit.limit} posts/mês do plano gratuito (${postLimit.current} usados). Faça upgrade para o Pro para posts ilimitados.`, upgrade: true },
        { status: 403 }
      )
    }
  }

  const membership = await sql`
    SELECT id FROM "member"
    WHERE organization_id = ${workspaceId} AND user_id = ${session.user.id}
    LIMIT 1
  `
  if (membership.length === 0) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  // scheduledAt comes as "YYYY-MM-DDTHH:mm" in Brasília time (UTC-3)
  let finalScheduledAt: string | null = null
  if (scheduleType === "scheduled" && scheduledAt) {
    const hasTz = /[Z+\-]\d{2}:\d{2}$/.test(scheduledAt) || scheduledAt.endsWith("Z")
    finalScheduledAt = hasTz
      ? new Date(scheduledAt).toISOString()
      : new Date(`${scheduledAt}-03:00`).toISOString()
  }

  const publishNow = scheduleType === "now"
  const postStatus = isDraft ? "draft" : publishNow ? "publishing" : "scheduled"

  try {
    const post = await sql`
      INSERT INTO posts (id, workspace_id, content, status, post_type, scheduled_at, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), ${workspaceId}, ${content}, ${postStatus}, ${postType || "feed"}, ${finalScheduledAt}, ${session.user.id}, NOW(), NOW())
      RETURNING id
    `
    const postId = post[0].id

    // Save media
    const savedMediaUrls: string[] = []
    const savedMediaTypes: string[] = []
    if (media && media.length > 0) {
      for (let i = 0; i < media.length; i++) {
        const m = media[i]
        const mediaType = m.type === "video" ? "video" : "image"
        await sql`
          INSERT INTO post_media (id, post_id, url, media_type, order_index, created_at)
          VALUES (gen_random_uuid(), ${postId}, ${m.url}, ${mediaType}, ${i}, NOW())
        `
        savedMediaUrls.push(m.url)
        savedMediaTypes.push(mediaType)
      }
    }

    // Save reel cover as media_type = 'image' with order_index = -1 (negative index identifies it as cover)
    if (coverMedia?.url) {
      await sql`
        INSERT INTO post_media (id, post_id, url, media_type, order_index, created_at)
        VALUES (gen_random_uuid(), ${postId}, ${coverMedia.url}, 'image', -1, NOW())
      `
    }

    // Drafts: create post_targets if accounts were selected, then return early
    if (isDraft) {
      if (accountIds && accountIds.length > 0) {
        for (const accountId of accountIds) {
          await sql`
            INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
            VALUES (gen_random_uuid(), ${postId}, ${accountId}, ${postType || "feed"}, 'pending', NOW())
          `
        }
      }
      return NextResponse.json({ id: postId, status: "draft" })
    }

    // Create post_targets and collect account info for immediate publishing
    const targets: Array<{
      targetId: string
      accountId: string
      platform: string
      pageId: string
      accountIdMeta: string
      accessToken: string
    }> = []

    for (const accountId of accountIds) {
      const targetResult = await sql`
        INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
        VALUES (gen_random_uuid(), ${postId}, ${accountId}, ${postType}, 'pending', NOW())
        RETURNING id
      `
      const targetId = targetResult[0].id

      const account = await sql`
        SELECT platform, page_id, account_id, access_token
        FROM social_accounts WHERE id = ${accountId} LIMIT 1
      `
      if (account.length > 0) {
        targets.push({
          targetId,
          accountId,
          platform: account[0].platform,
          pageId: account[0].page_id,
          accountIdMeta: account[0].account_id,
          accessToken: account[0].access_token,
        })
      }
    }

    if (publishNow) {
      // ── Publish immediately inline ─────────────────────────────────────────
      const publishErrors: string[] = []

      for (const target of targets) {
        try {
          let platformPostId: string | null = null

          if (target.platform === "facebook") {
            platformPostId = await publishToFacebook({
              access_token: target.accessToken,
              page_id: target.pageId,
              content,
              media_urls: savedMediaUrls.length > 0 ? savedMediaUrls : null,
              media_types: savedMediaTypes.length > 0 ? savedMediaTypes : null,
            })
          } else if (target.platform === "instagram") {
            platformPostId = await publishToInstagram({
              access_token: target.accessToken,
              account_id: target.accountIdMeta,
              page_id: target.pageId,
              content,
              media_urls: savedMediaUrls.length > 0 ? savedMediaUrls : null,
              media_types: savedMediaTypes.length > 0 ? savedMediaTypes : null,
              cover_url: coverMedia?.url ?? null,
              post_type: postType,
            })
          }

          await sql`
            UPDATE post_targets
            SET status = 'published', platform_post_id = ${platformPostId}
            WHERE id = ${target.targetId}
          `
        } catch (err: any) {
          const errMsg = err?.message || String(err)
          console.error(`[posts] publish failed for ${target.platform}:`, errMsg)
          publishErrors.push(`${target.platform}: ${errMsg}`)
          await sql`
            UPDATE post_targets SET status = 'failed', error_message = ${errMsg}
            WHERE id = ${target.targetId}
          `
        }
      }

      const allFailed = publishErrors.length === targets.length
      await sql`
        UPDATE posts
        SET status = ${allFailed ? "failed" : "published"},
            published_at = ${allFailed ? null : new Date().toISOString()},
            error_message = ${publishErrors.length > 0 ? publishErrors.join("; ") : null},
            updated_at = NOW()
        WHERE id = ${postId}
      `

      if (allFailed) {
        return NextResponse.json({ id: postId, errors: publishErrors }, { status: 207 })
      }
      return NextResponse.json({ id: postId, status: "published" })
    } else {
      // ── Add to queue for scheduled publishing ──────────────────────────────
      await sql`
        INSERT INTO post_queue (id, post_id, scheduled_at, status, attempts, max_attempts, created_at)
        VALUES (gen_random_uuid(), ${postId}, ${finalScheduledAt}, 'pending', 0, 3, NOW())
      `
      return NextResponse.json({ id: postId, status: "scheduled" })
    }
  } catch (err: any) {
    console.error("[posts] Error:", err)
    return NextResponse.json(
      { error: err?.message || "Erro inesperado ao criar post" },
      { status: 500 }
    )
  }
}

// ─── GET /api/posts ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const workspaceId = searchParams.get("workspaceId")
  const month = searchParams.get("month")

  let posts

  const baseSelect = sql`
    SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
      o.id as workspace_id, o.name as workspace_name,
      ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
      COALESCE(ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.post_type IS NOT NULL), ARRAY[p.post_type]) as post_types,
      COUNT(DISTINCT pm.id)::int as media_count
    FROM posts p
    JOIN "organization" o ON o.id = p.workspace_id
    JOIN "member" m ON m.organization_id = o.id
    LEFT JOIN post_targets pt ON pt.post_id = p.id
    LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
    LEFT JOIN post_media pm ON pm.post_id = p.id
  `

  if (workspaceId && month) {
    const [year, monthNum] = month.split("-")
    const startDate = `${year}-${monthNum}-01`
    const endDate = new Date(parseInt(year), parseInt(monthNum), 1).toISOString().split("T")[0]
    posts = await sql`
      ${baseSelect}
      WHERE m.user_id = ${session.user.id} AND p.workspace_id = ${workspaceId}
        AND p.scheduled_at >= ${startDate} AND p.scheduled_at < ${endDate}
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `
  } else if (workspaceId) {
    posts = await sql`
      ${baseSelect}
      WHERE m.user_id = ${session.user.id} AND p.workspace_id = ${workspaceId}
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `
  } else if (month) {
    const [year, monthNum] = month.split("-")
    const startDate = `${year}-${monthNum}-01`
    const endDate = new Date(parseInt(year), parseInt(monthNum), 1).toISOString().split("T")[0]
    posts = await sql`
      ${baseSelect}
      WHERE m.user_id = ${session.user.id}
        AND p.scheduled_at >= ${startDate} AND p.scheduled_at < ${endDate}
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `
  } else {
    posts = await sql`
      ${baseSelect}
      WHERE m.user_id = ${session.user.id}
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `
  }

  return NextResponse.json(posts)
}
