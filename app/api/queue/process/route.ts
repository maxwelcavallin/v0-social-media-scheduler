import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"

const GRAPH_API = "https://graph.facebook.com/v22.0"

// Called by Vercel Cron every 5 minutes (no auth needed for cron)
// Also called internally after immediate posts with x-queue-secret header
export async function GET(request: NextRequest) {
  return processQueue()
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-queue-secret")
  if (secret !== (process.env.QUEUE_SECRET || "postflow-queue")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return processQueue()
}

async function processQueue() {
  const pendingItems = await sql`
    SELECT
      pq.id as queue_id,
      pq.post_id,
      pq.attempts,
      pq.max_attempts,
      pt.post_type,
      pt.id as target_id,
      p.id as post_id_ref,
      p.content,
      sa.platform,
      sa.account_id,
      sa.page_id,
      sa.access_token,
      ARRAY_AGG(pm.url ORDER BY pm.order_index) FILTER (WHERE pm.id IS NOT NULL) as media_urls,
      ARRAY_AGG(pm.media_type ORDER BY pm.order_index) FILTER (WHERE pm.id IS NOT NULL) as media_types
    FROM post_queue pq
    JOIN posts p ON p.id = pq.post_id
    JOIN post_targets pt ON pt.post_id = p.id
    JOIN social_accounts sa ON sa.id = pt.social_account_id
    LEFT JOIN post_media pm ON pm.post_id = p.id
    WHERE pq.status IN ('pending', 'processing')
      AND pq.scheduled_at <= NOW()
      AND pq.attempts < pq.max_attempts
    GROUP BY pq.id, pq.post_id, pq.attempts, pq.max_attempts,
             pt.post_type, pt.id, p.id, p.content,
             sa.platform, sa.account_id, sa.page_id, sa.access_token
    LIMIT 10
  `

  const results = []

  for (const item of pendingItems) {
    try {
      await sql`
        UPDATE post_queue SET status = 'processing', last_attempt_at = NOW(),
          attempts = attempts + 1 WHERE id = ${item.queue_id}
      `

      let platformPostId: string | null = null

      if (item.platform === "facebook") {
        platformPostId = await publishToFacebook(item)
      } else if (item.platform === "instagram") {
        platformPostId = await publishToInstagram(item)
      }

      await sql`UPDATE post_queue SET status = 'published' WHERE id = ${item.queue_id}`
      await sql`
        UPDATE post_targets SET status = 'published',
          platform_post_id = ${platformPostId} WHERE id = ${item.target_id}
      `

      const pendingTargets = await sql`
        SELECT COUNT(*)::int as count FROM post_targets
        WHERE post_id = ${item.post_id_ref} AND status != 'published'
      `
      if (pendingTargets[0].count === 0) {
        await sql`UPDATE posts SET status = 'published', published_at = NOW() WHERE id = ${item.post_id_ref}`
      }

      results.push({ queueId: item.queue_id, status: "published" })
    } catch (err: any) {
      console.error(`[queue] Error processing ${item.queue_id}:`, err.message)

      const isMaxAttempts = (item.attempts + 1) >= item.max_attempts
      await sql`
        UPDATE post_queue SET
          status = ${isMaxAttempts ? "failed" : "pending"},
          next_retry_at = NOW() + INTERVAL '5 minutes'
        WHERE id = ${item.queue_id}
      `
      if (isMaxAttempts) {
        await sql`UPDATE post_targets SET status = 'failed', error_message = ${err.message} WHERE id = ${item.target_id}`
        await sql`UPDATE posts SET status = 'failed', error_message = ${err.message} WHERE id = ${item.post_id_ref}`
      }

      results.push({ queueId: item.queue_id, status: "failed", error: err.message })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}

async function publishToFacebook(item: any): Promise<string> {
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

async function publishToInstagram(item: any): Promise<string> {
  const { access_token, account_id, content, media_urls, media_types, post_type } = item

  if (!media_urls || media_urls.length === 0) throw new Error("Instagram requires media")

  if (media_urls.length === 1) {
    const isVideo = media_types?.[0] === "video" || post_type === "reel"
    const containerRes = await fetch(`${GRAPH_API}/${account_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: !isVideo ? media_urls[0] : undefined,
        video_url: isVideo ? media_urls[0] : undefined,
        media_type: isVideo ? "REELS" : "IMAGE",
        caption: content,
        access_token,
      }),
    })
    const containerData = await containerRes.json()
    if (containerData.error) throw new Error(containerData.error.message)

    await waitForContainer(containerData.id, access_token)

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

  await waitForContainer(carouselData.id, access_token)

  const publishRes = await fetch(`${GRAPH_API}/${account_id}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carouselData.id, access_token }),
  })
  const publishData = await publishRes.json()
  if (publishData.error) throw new Error(publishData.error.message)
  return publishData.id
}

async function waitForContainer(containerId: string, token: string, maxWait = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    const res = await fetch(`${GRAPH_API}/${containerId}?fields=status_code&access_token=${token}`)
    const data = await res.json()
    if (data.status_code === "FINISHED") return
    if (data.status_code === "ERROR") throw new Error("Instagram container processing failed")
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error("Instagram container timed out")
}
