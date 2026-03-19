import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH_API = "https://graph.facebook.com/v22.0"

// ─── publish helpers (inline, no HTTP hop) ───────────────────────────────────

async function publishToFacebook(item: {
  access_token: string
  page_id: string
  content: string
  media_urls: string[] | null
  media_types: string[] | null
}): Promise<string> {
  const { access_token, page_id, content, media_urls, media_types } = item

  if (!media_urls || media_urls.length === 0) {
    const res = await fetch(`${GRAPH_API}/${page_id}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content, access_token }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.id
  }

  if (media_urls.length === 1) {
    const isVideo = media_types?.[0] === "video"
    const res = await fetch(`${GRAPH_API}/${page_id}/${isVideo ? "videos" : "photos"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [isVideo ? "file_url" : "url"]: media_urls[0],
        caption: content,
        access_token,
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.id || data.post_id
  }

  // Carousel
  const photoIds: string[] = []
  for (const url of media_urls) {
    const r = await fetch(`${GRAPH_API}/${page_id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, published: false, access_token }),
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    photoIds.push(d.id)
  }

  const feedRes = await fetch(`${GRAPH_API}/${page_id}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: content,
      attached_media: photoIds.map((id) => ({ media_fbid: id })),
      access_token,
    }),
  })
  const feedData = await feedRes.json()
  if (feedData.error) throw new Error(feedData.error.message)
  return feedData.id
}

async function publishToInstagram(item: {
  access_token: string
  account_id: string
  content: string
  media_urls: string[] | null
  media_types: string[] | null
  post_type: string
  cover_url?: string | null
}): Promise<string> {
  const { access_token, account_id, content, media_urls, media_types, post_type, cover_url } = item

  if (!media_urls || media_urls.length === 0) throw new Error("Instagram requer mídia")

  if (media_urls.length === 1) {
    const isStory = post_type === "story"
    const isReel = post_type === "reel"
    const isVideo = media_types?.[0] === "video" || isReel

    // Determine media_type correctly for Instagram Graph API
    let mediaType: string
    if (isReel) mediaType = "REELS"
    else if (isStory) mediaType = "STORIES"
    else if (isVideo) mediaType = "VIDEO"
    else mediaType = "IMAGE"

    const containerBody: Record<string, string | boolean> = {
      media_type: mediaType,
      access_token,
    }
    if (isVideo) {
      containerBody.video_url = media_urls[0]
    } else {
      containerBody.image_url = media_urls[0]
    }
    if (!isStory && content) {
      containerBody.caption = content
    }
    // Reel cover image — Instagram accepts cover_url for REELS
    if (isReel && cover_url) {
      containerBody.cover_url = cover_url
    }

    const containerRes = await fetch(`${GRAPH_API}/${account_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    })
    const containerData = await containerRes.json()
    if (containerData.error) {
      throw new Error(`Erro ao criar container: ${containerData.error.message} [${containerData.error.code}]`)
    }

    // Poll until ready — videos take longer than images
    const maxPoll = isVideo ? 30 : 8
    const pollInterval = isVideo ? 4000 : 1500
    let lastStatusCode = ""
    for (let i = 0; i < maxPoll; i++) {
      await new Promise((r) => setTimeout(r, pollInterval))
      const statusRes = await fetch(
        `${GRAPH_API}/${containerData.id}?fields=status_code,status&access_token=${access_token}`
      )
      const statusData = await statusRes.json()
      lastStatusCode = statusData.status_code
      if (lastStatusCode === "FINISHED") break
      if (lastStatusCode === "ERROR") {
        throw new Error(`Instagram rejeitou a mídia: ${statusData.status || "erro desconhecido"}`)
      }
    }
    if (lastStatusCode && lastStatusCode !== "FINISHED") {
      throw new Error(`Tempo esgotado aguardando processamento (status: ${lastStatusCode})`)
    }

    const publishRes = await fetch(`${GRAPH_API}/${account_id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerData.id, access_token }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) throw new Error(publishData.error.message)
    return publishData.id
  }

  // Carousel
  const itemIds: string[] = []
  for (const url of media_urls) {
    const r = await fetch(`${GRAPH_API}/${account_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token }),
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    itemIds.push(d.id)
  }
  const carouselRes = await fetch(`${GRAPH_API}/${account_id}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: itemIds.join(","),
      caption: content,
      access_token,
    }),
  })
  const carouselData = await carouselRes.json()
  if (carouselData.error) throw new Error(carouselData.error.message)

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const statusRes = await fetch(`${GRAPH_API}/${carouselData.id}?fields=status_code&access_token=${access_token}`)
    const statusData = await statusRes.json()
    if (statusData.status_code === "FINISHED") break
    if (statusData.status_code === "ERROR") throw new Error("Falha ao processar carousel no Instagram")
  }

  const publishRes = await fetch(`${GRAPH_API}/${account_id}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carouselData.id, access_token }),
  })
  const publishData = await publishRes.json()
  if (publishData.error) throw new Error(publishData.error.message)
  return publishData.id
}

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
      INSERT INTO posts (id, workspace_id, content, status, scheduled_at, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), ${workspaceId}, ${content}, ${postStatus}, ${finalScheduledAt}, ${session.user.id}, NOW(), NOW())
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

    // Drafts have no targets and are never published — return early
    if (isDraft) {
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
      ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
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
