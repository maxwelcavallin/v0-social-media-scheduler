import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { publishToFacebook, publishToInstagram, GRAPH_API, GRAPH_IG } from "@/lib/publish"

// Allow up to 300s for processing scheduled posts (videos take time)
export const maxDuration = 300

// GET — called by Vercel Cron every 5 minutes
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

// ─────────────────────────────────────────────────────────────────────────────
// RECONCILIAÇÃO AUTO-CURATIVA
// Roda no início de CADA execução do cron. Detecta posts que ficaram presos
// em status não-final (scheduled/publishing/processing) porque:
//   (a) a função serverless foi morta por timeout após marcar os targets mas
//       antes de atualizar o post; ou
//   (b) attempts atingiu max_attempts e o item saiu da query principal.
// A fonte de verdade é SEMPRE o estado dos post_targets — nunca contagens
// de tentativas.
// ─────────────────────────────────────────────────────────────────────────────
async function reconcileResolvedPosts() {
  const stuck = await sql`
    SELECT
      p.id                                                           AS post_id,
      COUNT(pt.id)::int                                              AS total,
      COUNT(pt.id) FILTER (WHERE pt.status = 'published')::int       AS published,
      COUNT(pt.id) FILTER (WHERE pt.status = 'failed')::int          AS failed,
      COUNT(pt.id) FILTER (WHERE pt.status = 'pending')::int         AS pending
    FROM posts p
    JOIN post_targets pt ON pt.post_id = p.id
    WHERE p.status IN ('scheduled', 'publishing', 'processing')
    GROUP BY p.id
    HAVING COUNT(pt.id) FILTER (WHERE pt.status = 'pending') = 0
       AND COUNT(pt.id) > 0
  `

  for (const row of stuck) {
    const total: number = row.total ?? 0
    const published: number = row.published ?? 0
    const failed: number = row.failed ?? 0

    if (published === total) {
      // Todos os targets publicados — finaliza o post
      await sql`
        UPDATE posts
        SET status = 'published',
            published_at = COALESCE(published_at, NOW()),
            error_message = NULL,
            updated_at = NOW()
        WHERE id = ${row.post_id}
      `
      await sql`
        UPDATE post_queue SET status = 'done', updated_at = NOW()
        WHERE post_id = ${row.post_id}
      `
    } else {
      // Há falhas (total ou parcial)
      const failedRows = await sql`
        SELECT sa.platform, pt.error_message
        FROM post_targets pt
        JOIN social_accounts sa ON sa.id = pt.social_account_id
        WHERE pt.post_id = ${row.post_id} AND pt.status = 'failed'
      `
      const errDetails = failedRows
        .map((t: any) => `${t.platform}: ${t.error_message || "erro desconhecido"}`)
        .join("; ")
      const errorMessage =
        failed < total
          ? `Publicação parcial — ${published}/${total} publicado(s). Falhas: ${errDetails}`
          : errDetails || "Falha ao publicar (motivo desconhecido)"

      await sql`
        UPDATE posts SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW()
        WHERE id = ${row.post_id}
      `
      await sql`
        UPDATE post_queue SET status = 'failed', last_error = ${errorMessage}, updated_at = NOW()
        WHERE post_id = ${row.post_id}
      `
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FINALIZA um item da fila consultando o estado REAL de todos os targets.
// Chamado tanto após processar os targets quanto em situações de edge-case.
// ─────────────────────────────────────────────────────────────────────────────
async function finalizeQueueItem(queueId: string, postId: string) {
  const rows = await sql`
    SELECT
      COUNT(pt.id)::int                                        AS total,
      COUNT(pt.id) FILTER (WHERE pt.status = 'published')::int AS published,
      COUNT(pt.id) FILTER (WHERE pt.status = 'failed')::int    AS failed,
      COUNT(pt.id) FILTER (WHERE pt.status = 'pending')::int   AS pending
    FROM post_targets pt
    WHERE pt.post_id = ${postId}
  `
  const stats = rows[0]
  const total: number = stats?.total ?? 0
  const published: number = stats?.published ?? 0
  const failed: number = stats?.failed ?? 0
  const pending: number = stats?.pending ?? 0

  // Ainda há targets não resolvidos — mantém como pending para próxima rodada
  if (pending > 0) {
    await sql`
      UPDATE post_queue SET status = 'pending', updated_at = NOW()
      WHERE id = ${queueId}
    `
    await sql`
      UPDATE posts SET status = 'scheduled', updated_at = NOW()
      WHERE id = ${postId}
    `
    return
  }

  if (published === total && total > 0) {
    // Todos publicados
    await sql`
      UPDATE post_queue SET status = 'done', updated_at = NOW()
      WHERE id = ${queueId}
    `
    await sql`
      UPDATE posts
      SET status = 'published',
          published_at = COALESCE(published_at, NOW()),
          error_message = NULL,
          updated_at = NOW()
      WHERE id = ${postId}
    `
    return
  }

  // Há falhas — coleta os erros reais persistidos nos targets
  const failedRows = await sql`
    SELECT sa.platform, pt.error_message
    FROM post_targets pt
    JOIN social_accounts sa ON sa.id = pt.social_account_id
    WHERE pt.post_id = ${postId} AND pt.status = 'failed'
  `
  const errDetails = failedRows
    .map((t: any) => `${t.platform}: ${t.error_message || "erro desconhecido"}`)
    .join("; ")
  const errorMessage =
    failed < total && published > 0
      ? `Publicação parcial — ${published}/${total} publicado(s). Falhas: ${errDetails}`
      : errDetails || "Falha ao publicar (motivo desconhecido)"

  await sql`
    UPDATE post_queue SET status = 'failed', last_error = ${errorMessage}, updated_at = NOW()
    WHERE id = ${queueId}
  `
  await sql`
    UPDATE posts SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW()
    WHERE id = ${postId}
  `
}

async function processQueue() {
  // 1. Reconcilia posts presos de execuções anteriores
  await reconcileResolvedPosts()

  // 2. Busca itens pendentes cuja janela de agendamento chegou.
  //    Não filtra por attempts < max_attempts — a reconciliação cuida dos que
  //    esgotaram tentativas sem finalizar.
  const pendingItems = await sql`
    SELECT
      pq.id           AS queue_id,
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
    LIMIT 3
  `

  if (pendingItems.length === 0) {
    return NextResponse.json({ processed: 0, results: [] })
  }

  const results = []

  for (const item of pendingItems) {
    // Marca como processing IMEDIATAMENTE para evitar double-execution
    await sql`
      UPDATE post_queue
      SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
      WHERE id = ${item.queue_id}
    `

    // Busca APENAS os targets ainda pending (não retenta targets que já publicaram)
    const targets = await sql`
      SELECT
        pt.id           AS target_id,
        pt.post_type,
        sa.platform,
        sa.account_id,
        sa.page_id,
        sa.access_token
      FROM post_targets pt
      JOIN social_accounts sa ON sa.id = pt.social_account_id
      WHERE pt.post_id = ${item.post_id}
        AND pt.status = 'pending'
    `

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

        await sql`
          UPDATE post_targets
          SET status = 'published', platform_post_id = ${platformPostId}
          WHERE id = ${target.target_id}
        `
      } catch (err: any) {
        const errMsg = err?.message || String(err)

        // Erro 190: token sem permissão de Página — marca conta para reconexão
        const isPermissionError =
          errMsg.includes("190") ||
          errMsg.includes("impersonating a user's page") ||
          errMsg.includes("pages_read_engagement")
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

    // Finaliza consultando o estado real de TODOS os targets (fonte de verdade)
    await finalizeQueueItem(item.queue_id, item.post_id)

    results.push({
      queueId: item.queue_id,
      postId: item.post_id,
      targetsProcessed: targets.length,
    })
  }

  return NextResponse.json({ processed: results.length, results })
}

export async function waitForContainer(containerId: string, token: string, maxWaitMs = 30000, isDirectIg = false): Promise<void> {
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
