import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"

const GRAPH_API = "https://graph.facebook.com/v22.0"

// Allow up to 300s for processing scheduled posts (videos take time)
export const maxDuration = 300

// GET — called by Vercel Cron every 5 minutes
// Vercel sends: Authorization: Bearer <CRON_SECRET>
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return processQueue()
}

// POST — called internally after immediate posts (kept for backwards compat)
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-queue-secret")
  if (secret !== (process.env.QUEUE_SECRET || "postflow-queue")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return processQueue()
}

async function processQueue() {
  // Fetch pending queue entries whose scheduled time has arrived
  // Each queue entry corresponds to one post, which may have multiple targets
  const pendingItems = await sql`
    SELECT
      pq.id        AS queue_id,
      pq.post_id,
      pq.attempts,
      pq.max_attempts,
      p.content,
      p.workspace_id,
      ARRAY_AGG(pm.url        ORDER BY pm.order_index) FILTER (WHERE pm.id IS NOT NULL AND pm.order_index >= 0) AS media_urls,
      ARRAY_AGG(pm.media_type ORDER BY pm.order_index) FILTER (WHERE pm.id IS NOT NULL AND pm.order_index >= 0) AS media_types,
      MAX(pm.url) FILTER (WHERE pm.order_index = -1) AS cover_url
    FROM post_queue pq
    JOIN posts p ON p.id = pq.post_id
    LEFT JOIN post_media pm ON pm.post_id = p.id
    WHERE pq.status IN ('pending', 'processing')
      AND pq.scheduled_at <= NOW()
      AND pq.attempts < pq.max_attempts
    GROUP BY pq.id, pq.post_id, pq.attempts, pq.max_attempts, p.content, p.workspace_id
    -- cover_url is derived from MAX aggregate, no need in GROUP BY
    LIMIT 10
  `

  if (pendingItems.length === 0) {
    return NextResponse.json({ processed: 0, results: [] })
  }

  const results = []

  for (const item of pendingItems) {
    // Mark as processing immediately to prevent double-execution
    await sql`
      UPDATE post_queue
      SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
      WHERE id = ${item.queue_id}
    `

    // Fetch all pending targets for this post
    const targets = await sql`
      SELECT
        pt.id           AS target_id,
        pt.post_type,
        pt.status       AS target_status,
        sa.platform,
        sa.account_id,
        sa.page_id,
        sa.access_token
      FROM post_targets pt
      JOIN social_accounts sa ON sa.id = pt.social_account_id
      WHERE pt.post_id = ${item.post_id}
        AND pt.status = 'pending'
    `

    const errors: string[] = []

    for (const target of targets) {
      try {
        let platformPostId: string | null = null

        if (target.platform === "facebook") {
          platformPostId = await publishToFacebook({
            access_token: target.access_token,
            page_id: target.page_id,
            content: item.content,
            media_urls: item.media_urls,
            media_types: item.media_types,
          })
        } else if (target.platform === "instagram") {
          platformPostId = await publishToInstagram({
            access_token: target.access_token,
            account_id: target.account_id,
            content: item.content,
            media_urls: item.media_urls,
            media_types: item.media_types,
            post_type: target.post_type,
            cover_url: item.cover_url ?? null,
          })
        }

        // post_targets has no updated_at column
        await sql`
          UPDATE post_targets
          SET status = 'published', platform_post_id = ${platformPostId}
          WHERE id = ${target.target_id}
        `
      } catch (err: any) {
        const errMsg = err?.message || String(err)
        errors.push(`${target.platform}: ${errMsg}`)
        await sql`
          UPDATE post_targets
          SET status = 'failed', error_message = ${errMsg}
          WHERE id = ${target.target_id}
        `
      }
    }

    const allFailed = errors.length > 0 && errors.length === targets.length
    const maxReached = item.attempts >= item.max_attempts

    if (errors.length === 0) {
      // All targets succeeded — mark queue done and post published with timestamp
      await sql`
        UPDATE post_queue SET status = 'done', updated_at = NOW() WHERE id = ${item.queue_id}
      `
      await sql`
        UPDATE posts SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = ${item.post_id}
      `
    } else if (allFailed && maxReached) {
      // All failed, no retries left
      await sql`
        UPDATE post_queue SET status = 'failed', last_error = ${errors.join("; ")}, updated_at = NOW() WHERE id = ${item.queue_id}
      `
      await sql`
        UPDATE posts SET status = 'failed', error_message = ${errors.join("; ")}, updated_at = NOW() WHERE id = ${item.post_id}
      `
    } else if (allFailed) {
      // All failed but retries remain — reset to pending for next cron run
      await sql`
        UPDATE post_queue SET status = 'pending', last_error = ${errors.join("; ")}, updated_at = NOW() WHERE id = ${item.queue_id}
      `
      await sql`
        UPDATE posts SET status = 'scheduled', updated_at = NOW() WHERE id = ${item.post_id}
      `
    } else {
      // Partial success — mark done and published
      await sql`
        UPDATE post_queue SET status = 'done', updated_at = NOW() WHERE id = ${item.queue_id}
      `
      await sql`
        UPDATE posts SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = ${item.post_id}
      `
    }

    results.push({
      queueId: item.queue_id,
      postId: item.post_id,
      targets: targets.length,
      errors: errors.length,
    })
  }

  return NextResponse.json({ processed: results.length, results })
}

// ─── Facebook publish ─────────────────────────────────────────────────────────

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

// ─── Instagram publish ────────────────────────────────────────────────────────

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

    let mediaType: string
    if (isReel) mediaType = "REELS"
    else if (isStory) mediaType = "STORIES"
    else if (isVideo) mediaType = "VIDEO"
    else mediaType = "IMAGE"

    const containerBody: Record<string, string | boolean> = { media_type: mediaType, access_token }
    if (isVideo) containerBody.video_url = media_urls[0]
    else containerBody.image_url = media_urls[0]
    if (!isStory && content) containerBody.caption = content
    if (isReel && cover_url) containerBody.cover_url = cover_url

    const containerRes = await fetch(`${GRAPH_API}/${account_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    })
    const containerData = await containerRes.json()
    if (containerData.error) throw new Error(`Container: ${containerData.error.message} [${containerData.error.code}]`)

    await waitForContainer(containerData.id, access_token, isVideo ? 120000 : 15000)

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
  for (let i = 0; i < media_urls.length; i++) {
    const url = media_urls[i]
    const isItemVideo = media_types?.[i] === "video"
    const r = await fetch(`${GRAPH_API}/${account_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isItemVideo ? { video_url: url, media_type: "VIDEO" } : { image_url: url }),
        is_carousel_item: true,
        access_token,
      }),
    })
    const d = await r.json()
    if (d.error) throw new Error(`Item ${i + 1}: ${d.error.message}`)
    itemIds.push(d.id)
  }

  const carouselRes = await fetch(`${GRAPH_API}/${account_id}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "CAROUSEL", children: itemIds.join(","), caption: content, access_token }),
  })
  const carouselData = await carouselRes.json()
  if (carouselData.error) throw new Error(carouselData.error.message)

  await waitForContainer(carouselData.id, access_token, 30000)

  const publishRes = await fetch(`${GRAPH_API}/${account_id}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carouselData.id, access_token }),
  })
  const publishData = await publishRes.json()
  if (publishData.error) throw new Error(publishData.error.message)
  return publishData.id
}

async function waitForContainer(containerId: string, token: string, maxWaitMs = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${GRAPH_API}/${containerId}?fields=status_code,status&access_token=${token}`)
    const data = await res.json()
    if (data.status_code === "FINISHED") return
    if (data.status_code === "ERROR") throw new Error(`Container failed: ${data.status || "unknown"}`)
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error("Container timed out")
}
