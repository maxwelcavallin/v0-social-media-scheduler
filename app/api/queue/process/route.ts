import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { publishToFacebook, publishToInstagram, GRAPH_API, GRAPH_IG } from "@/lib/publish"

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
  // ────────────────────────────────────────────────────────────────────────
  // RECONCILIAÇÃO AUTO-CURATIVA (corrige status "preso")
  // Publicar vídeo/carrossel é lento. Se a função serverless do cron for morta
  // por timeout DEPOIS de marcar os targets como 'published'/'failed' mas ANTES
  // de atualizar o status do post, o post fica preso em 'scheduled'/'publishing'
  // (mentindo o status). Além disso, quando attempts == max_attempts o item
  // some da query principal e nunca seria finalizado. Esta etapa repara isso
  // baseando-se no estado REAL dos targets, que é a fonte de verdade.
  await reconcileResolvedPosts()

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
    LIMIT 3
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
            page_id: target.page_id,
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

        // Erro 190: token sem permissões — marcar conta para reconexão obrigatória
        const isPermissionError = errMsg.includes("190") || errMsg.includes("impersonating a user's page") || errMsg.includes("pages_read_engagement")
        if (isPermissionError) {
          await sql`
            UPDATE social_accounts SET needs_reconnect = true, updated_at = NOW()
            WHERE account_id = ${target.account_id} AND platform = ${target.platform}
          `
        }

        await sql`
          UPDATE post_targets
          SET status = 'failed', error_message = ${errMsg}
          WHERE id = ${target.target_id}
        `
      }
    }

    // IMPORTANTE: a decisão de status NÃO pode se basear apenas nos targets
    // processados nesta execução (que filtra status = 'pending'). Numa retentativa,
    // targets que falharam antes já estão 'failed' e não voltam como 'pending',
    // deixando `targets` vazio — o que antes marcava o post como "publicado"
    // indevidamente. Por isso consultamos o estado REAL de TODOS os targets do post.
    const targetStats = await sql`
      SELECT
        COUNT(*)::int                                            AS total,
        COUNT(*) FILTER (WHERE status = 'published')::int        AS published,
        COUNT(*) FILTER (WHERE status = 'failed')::int           AS failed,
        COUNT(*) FILTER (WHERE status = 'pending')::int          AS pending
      FROM post_targets
      WHERE post_id = ${item.post_id}
    `
    const stats = targetStats[0]
    const total = stats.total ?? 0
    const published = stats.published ?? 0
    const failed = stats.failed ?? 0
    const pending = stats.pending ?? 0

    // Coleta as mensagens de erro persistidas nos targets que falharam (fonte de verdade)
    const failedTargets = await sql`
      SELECT platform, error_message FROM post_targets
      WHERE post_id = ${item.post_id} AND status = 'failed'
    `
    const persistedErrors = failedTargets
      .map((t: any) => `${t.platform}: ${t.error_message || "erro desconhecido"}`)
      .join("; ")

    const maxReached = item.attempts >= item.max_attempts
    const allPublished = total > 0 && published === total

    if (allPublished) {
      // Só marca como publicado quando TODOS os targets foram confirmados pela API
      await sql`
        UPDATE post_queue SET status = 'done', updated_at = NOW() WHERE id = ${item.queue_id}
      `
      await sql`
        UPDATE posts SET status = 'published', published_at = NOW(), error_message = NULL, updated_at = NOW() WHERE id = ${item.post_id}
      `
    } else if (pending > 0 && !maxReached) {
      // Ainda há targets pendentes e tentativas restantes — reagenda para o próximo cron.
      // Resetamos os targets que falharam nesta rodada para 'pending' para que sejam retentados.
      await sql`
        UPDATE post_targets SET status = 'pending' WHERE post_id = ${item.post_id} AND status = 'failed'
      `
      await sql`
        UPDATE post_queue SET status = 'pending', last_error = ${persistedErrors || null}, updated_at = NOW() WHERE id = ${item.queue_id}
      `
      await sql`
        UPDATE posts SET status = 'scheduled', updated_at = NOW() WHERE id = ${item.post_id}
      `
    } else if (failed > 0 && published > 0) {
      // Sucesso PARCIAL definitivo: alguns publicaram, outros falharam.
      // NUNCA marca como publicado — sinaliza falha para o usuário ver o que não saiu.
      const partialError = `Publicação parcial — ${published}/${total} publicado(s). Falhas: ${persistedErrors}`
      await sql`
        UPDATE post_queue SET status = 'failed', last_error = ${partialError}, updated_at = NOW() WHERE id = ${item.queue_id}
      `
      await sql`
        UPDATE posts SET status = 'failed', error_message = ${partialError}, updated_at = NOW() WHERE id = ${item.post_id}
      `
    } else {
      // Todos falharam (ou sem tentativas restantes) — marca como falha com o erro real.
      const finalError = persistedErrors || errors.join("; ") || "Falha ao publicar (motivo desconhecido)"
      await sql`
        UPDATE post_queue SET status = 'failed', last_error = ${finalError}, updated_at = NOW() WHERE id = ${item.queue_id}
      `
      await sql`
        UPDATE posts SET status = 'failed', error_message = ${finalError}, updated_at = NOW() WHERE id = ${item.post_id}
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

async function waitForContainer(containerId: string, token: string, maxWaitMs = 30000, isDirectIg = false): Promise<void> {
  const api = isDirectIg ? GRAPH_IG : GRAPH_API
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${api}/${containerId}?fields=status_code,status&access_token=${token}`)
    const data = await res.json()
    if (data.status_code === "FINISHED") return
    if (data.status_code === "ERROR") throw new Error(`Container failed: ${data.status || "unknown"}`)
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error("Container timed out")
}
