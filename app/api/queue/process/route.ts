import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { publishToFacebook, publishToInstagram, refreshFacebookPageToken, isTokenError, GRAPH_API, GRAPH_IG } from "@/lib/publish"

// Allow up to 300s for processing scheduled posts (videos take time)
export const maxDuration = 300

// ─── Logger ───────────────────────────────────────────────────────────────────
// Escreve nos logs do runtime (visíveis no painel de Logs da Vercel) em vez de
// gravar no banco. Evita escrita constante no Postgres a cada execução do cron.
type LogLevel = "info" | "error" | "warn"

function qlog(
  level: LogLevel,
  message: string,
  meta?: { post_id?: string; queue_id?: string; platform?: string; details?: Record<string, unknown> }
) {
  const parts = [`[v0][queue]`]
  if (meta?.post_id) parts.push(`post=${meta.post_id}`)
  if (meta?.queue_id) parts.push(`queue=${meta.queue_id}`)
  if (meta?.platform) parts.push(`platform=${meta.platform}`)
  const prefix = parts.join(" ")
  const detailsStr = meta?.details ? ` ${JSON.stringify(meta.details)}` : ""
  const line = `${prefix} ${message}${detailsStr}`

  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

// Detecta erros de token/permissão do Facebook/Instagram (OAuthException código 190
// e variações de "impersonating a user's page"). Esses erros significam que o token
// da conta está inválido/degradado — não adianta retentar; a conta precisa reconexão.
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
  // Classifica os targets levando em conta o ESTADO DA CONTA. Um target só é
  // "publicável" se a conta está ativa e não precisa reconexão. Targets pendentes
  // ou falhos em contas que precisam reconexão são "bloqueados" — não adianta
  // retentá-los e, principalmente, eles NÃO devem manter a fila em 'pending'
  // eternamente (esse era o bug do post que ficava "agendado" para sempre).
  const rows = await sql`
    SELECT
      COUNT(pt.id)::int                                        AS total,
      COUNT(pt.id) FILTER (WHERE pt.status = 'published')::int AS published,
      COUNT(pt.id) FILTER (WHERE pt.status = 'pending'
        AND COALESCE(sa.needs_reconnect, false) = false
        AND COALESCE(sa.is_active, true) = true)::int          AS pending_publishable,
      COUNT(pt.id) FILTER (WHERE pt.status = 'failed'
        AND COALESCE(sa.needs_reconnect, false) = false
        AND COALESCE(sa.is_active, true) = true)::int          AS failed_retryable,
      COUNT(pt.id) FILTER (WHERE pt.status IN ('pending','failed')
        AND (COALESCE(sa.needs_reconnect, false) = true
          OR COALESCE(sa.is_active, true) = false))::int       AS blocked,
      pq.attempts,
      pq.max_attempts
    FROM post_targets pt
    JOIN social_accounts sa ON sa.id = pt.social_account_id
    CROSS JOIN (SELECT attempts, max_attempts FROM post_queue WHERE id = ${queueId}) pq
    WHERE pt.post_id = ${postId}
    GROUP BY pq.attempts, pq.max_attempts
  `
  const stats = rows[0]
  const total: number = stats?.total ?? 0
  const published: number = stats?.published ?? 0
  const pendingPublishable: number = stats?.pending_publishable ?? 0
  const failedRetryable: number = stats?.failed_retryable ?? 0
  const blocked: number = stats?.blocked ?? 0
  const attempts: number = stats?.attempts ?? 0
  const maxAttempts: number = stats?.max_attempts ?? 3
  const hasRetries = attempts < maxAttempts

  // 1. Ainda há targets publicáveis aguardando — segue tentando na próxima rodada.
  if (pendingPublishable > 0) {
    await sql`UPDATE post_queue SET status = 'pending', updated_at = NOW() WHERE id = ${queueId}`
    await sql`UPDATE posts SET status = 'scheduled', updated_at = NOW() WHERE id = ${postId}`
    return
  }

  // 2. Há falhas em contas válidas (erros transitórios) e ainda restam tentativas —
  //    reseta SOMENTE essas falhas retentáveis e reagenda. Targets bloqueados por
  //    reconexão NÃO são tocados (continuam 'failed' aguardando o Step 7).
  if (hasRetries && failedRetryable > 0) {
    await sql`
      UPDATE post_targets pt
      SET status = 'pending', error_message = NULL
      FROM social_accounts sa
      WHERE pt.social_account_id = sa.id
        AND pt.post_id = ${postId}
        AND pt.status = 'failed'
        AND COALESCE(sa.needs_reconnect, false) = false
        AND COALESCE(sa.is_active, true) = true
    `
    await sql`UPDATE post_queue SET status = 'pending', updated_at = NOW() WHERE id = ${queueId}`
    await sql`UPDATE posts SET status = 'scheduled', updated_at = NOW() WHERE id = ${postId}`
    return
  }

  // 3. ESTADO TERMINAL: não há mais nada publicável para tentar nesta rodada.
  //    Os únicos targets não publicados são falhas definitivas ou bloqueios por
  //    reconexão. Finalizamos a fila (nunca deixar em 'pending' eternamente).
  const failedRows = await sql`
    SELECT sa.platform, pt.error_message
    FROM post_targets pt
    JOIN social_accounts sa ON sa.id = pt.social_account_id
    WHERE pt.post_id = ${postId} AND pt.status = 'failed'
  `
  const errDetails = failedRows
    .map((t: any) => `${t.platform}: ${t.error_message || "erro desconhecido"}`)
    .join("; ")

  if (published === total && total > 0) {
    // Tudo publicado com sucesso.
    await sql`UPDATE post_queue SET status = 'done', updated_at = NOW() WHERE id = ${queueId}`
    await sql`
      UPDATE posts
      SET status = 'published', published_at = COALESCE(published_at, NOW()),
          error_message = NULL, updated_at = NOW()
      WHERE id = ${postId}
    `
    return
  }

  if (published > 0) {
    // Publicação parcial: parte publicou, parte falhou/bloqueada. Encerra a fila
    // (status 'done' para não retentar em loop) mas registra o aviso no post.
    // Os targets bloqueados permanecem 'failed' e serão revividos no reconnect.
    const warn = blocked > 0 && !errDetails
      ? `Publicação parcial — ${published}/${total} publicado(s). Aguardando reconexão de conta(s).`
      : `Publicação parcial — ${published}/${total} publicado(s). Falhas: ${errDetails}`
    await sql`UPDATE post_queue SET status = 'done', last_error = ${warn}, updated_at = NOW() WHERE id = ${queueId}`
    await sql`
      UPDATE posts
      SET status = 'published', published_at = COALESCE(published_at, NOW()),
          error_message = ${warn}, updated_at = NOW()
      WHERE id = ${postId}
    `
    return
  }

  // 4. Nada publicou. Se é só bloqueio por reconexão, a mensagem orienta o usuário.
  const errorMessage =
    blocked > 0 && !errDetails
      ? "Aguardando reconexão da conta para publicar."
      : errDetails || "Falha ao publicar (motivo desconhecido)"

  await sql`UPDATE post_queue SET status = 'failed', last_error = ${errorMessage}, updated_at = NOW() WHERE id = ${queueId}`
  await sql`UPDATE posts SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW() WHERE id = ${postId}`
}

async function processQueue() {
  await qlog("info", `cron iniciado — ${new Date().toISOString()}`)

  await reconcileResolvedPosts()

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
      -- Só seleciona itens que tenham AO MENOS UM target pendente publicável
      -- (conta ativa e que não precisa reconexão). Isso evita o head-of-line
      -- blocking: posts cujos targets dependem todos de contas a reconectar não
      -- devem ocupar o LIMIT e impedir que posts válidos sejam processados.
      AND EXISTS (
        SELECT 1
        FROM post_targets pt2
        JOIN social_accounts sa2 ON sa2.id = pt2.social_account_id
        WHERE pt2.post_id = pq.post_id
          AND pt2.status = 'pending'
          AND COALESCE(sa2.needs_reconnect, false) = false
          AND COALESCE(sa2.is_active, true) = true
      )
    GROUP BY pq.id, pq.post_id, pq.attempts, pq.max_attempts, p.content, p.workspace_id
    -- Prioriza os agendamentos mais antigos primeiro
    ORDER BY MIN(pq.scheduled_at) ASC
    LIMIT 3
  `

  await qlog("info", `itens pendentes: ${pendingItems.length}`)

  if (pendingItems.length === 0) {
    return NextResponse.json({ processed: 0, results: [] })
  }

  const results = []

  for (const item of pendingItems) {
    await qlog("info", `processando post (tentativa ${item.attempts + 1}/${item.max_attempts})`, {
      post_id: item.post_id,
      queue_id: item.queue_id,
      details: { media_urls: item.media_urls, media_types: item.media_types },
    })

    await sql`
      UPDATE post_queue
      SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
      WHERE id = ${item.queue_id}
    `

    const targets = await sql`
      SELECT
        pt.id               AS target_id,
        pt.post_type,
        pt.social_account_id,
        sa.platform,
        sa.account_id,
        sa.page_id,
        sa.access_token,
        sa.user_access_token,
        sa.fb_user_id
      FROM post_targets pt
      JOIN social_accounts sa ON sa.id = pt.social_account_id
      WHERE pt.post_id = ${item.post_id}
        AND pt.status = 'pending'
        AND (sa.needs_reconnect IS NULL OR sa.needs_reconnect = false)
    `

    await qlog("info", `targets disponíveis: ${targets.length}`, {
      post_id: item.post_id,
      queue_id: item.queue_id,
    })

    const allPendingTargets = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM post_targets pt
      WHERE pt.post_id = ${item.post_id} AND pt.status = 'pending'
    `
    const totalPending = allPendingTargets[0]?.cnt ?? 0
    if (targets.length === 0 && totalPending > 0) {
      await qlog("warn", "pulado — conta(s) precisam reconexão", {
        post_id: item.post_id,
        queue_id: item.queue_id,
      })
      await sql`
        UPDATE post_queue
        SET status = 'pending', attempts = attempts - 1, updated_at = NOW()
        WHERE id = ${item.queue_id}
      `
      results.push({ queueId: item.queue_id, postId: item.post_id, skipped: true, reason: "needs_reconnect" })
      continue
    }

    for (const target of targets) {
      await qlog("info", `publicando em ${target.platform} (post_type: ${target.post_type})`, {
        post_id: item.post_id,
        queue_id: item.queue_id,
        platform: target.platform,
      })
      // Closure de publicação reutilizável — recebe o token a usar para que a
      // auto-cura possa tentar novamente com um token recém-emitido.
      const publishWith = async (token: string): Promise<string | null> => {
        if (target.platform === "facebook") {
          return await publishToFacebook({
            access_token: token,
            page_id: target.page_id,
            content: item.content,
            media_urls: item.media_urls,
            media_types: item.media_types,
            post_type: target.post_type,
          })
        } else if (target.platform === "instagram") {
          return await publishToInstagram({
            access_token: token,
            account_id: target.account_id,
            page_id: target.page_id,
            content: item.content,
            media_urls: item.media_urls,
            media_types: item.media_types,
            post_type: target.post_type,
            cover_url: item.cover_url ?? null,
          })
        }
        return null
      }

      try {
        const platformPostId: string | null = await publishWith(target.access_token)

        await qlog("info", `publicado com sucesso em ${target.platform}. platform_post_id: ${platformPostId}`, {
          post_id: item.post_id,
          queue_id: item.queue_id,
          platform: target.platform,
        })
        await sql`
          UPDATE post_targets
          SET status = 'published', platform_post_id = ${platformPostId}
          WHERE id = ${target.target_id}
        `
      } catch (err: any) {
        const errMsg = err?.message || String(err)

        if (isTokenError(errMsg)) {
          // AUTO-CURA: antes de marcar a conta para reconexão, tentamos re-emitir
          // um Page Access Token fresco a partir do user_access_token salvo. Como
          // todas as páginas do mesmo usuário FB derivam do mesmo user token, um
          // user token válido consegue gerar um page token novo na hora — sem exigir
          // reconexão manual. Só funciona via page_id (IG direto não tem page token).
          if (target.user_access_token && target.page_id) {
            await qlog("info", `tentando auto-cura do token em ${target.platform}`, {
              post_id: item.post_id,
              queue_id: item.queue_id,
              platform: target.platform,
              details: { social_account_id: target.social_account_id },
            })
            const freshToken = await refreshFacebookPageToken(target.page_id, target.user_access_token)
            if (freshToken) {
              // Persiste o token fresco em TODAS as cópias dessa página/conta
              // (Facebook por account_id, Instagram por page_id), em todos os workspaces.
              await sql`
                UPDATE social_accounts
                SET access_token = ${freshToken}, needs_reconnect = false,
                    is_active = true, updated_at = NOW(), last_sync_at = NOW()
                WHERE (platform = 'facebook' AND account_id = ${target.page_id})
                   OR (platform = 'instagram' AND page_id = ${target.page_id})
              `
              try {
                const retryPostId = await publishWith(freshToken)
                await qlog("info", `auto-cura bem-sucedida em ${target.platform}. platform_post_id: ${retryPostId}`, {
                  post_id: item.post_id,
                  queue_id: item.queue_id,
                  platform: target.platform,
                })
                await sql`
                  UPDATE post_targets
                  SET status = 'published', platform_post_id = ${retryPostId}
                  WHERE id = ${target.target_id}
                `
                continue // target publicado — pula a marcação de reconexão
              } catch (retryErr: any) {
                // A republicação ainda falhou — cai para o fluxo de reconexão abaixo.
                await qlog("warn", `auto-cura falhou na republicação em ${target.platform}: ${retryErr?.message || retryErr}`, {
                  post_id: item.post_id,
                  queue_id: item.queue_id,
                  platform: target.platform,
                })
              }
            } else {
              await qlog("warn", `auto-cura não obteve token fresco em ${target.platform} (user token provavelmente expirado)`, {
                post_id: item.post_id,
                queue_id: item.queue_id,
                platform: target.platform,
              })
            }
          }

          // Token inválido/degradado: marca a conta para reconexão e o target como
          // 'failed' com mensagem reconhecível. O flag needs_reconnect na conta é o
          // que impede novas tentativas com token quebrado (a query do cron exclui
          // contas a reconectar). Marcar 'failed' (em vez de 'pending') mantém o
          // finalizeQueueItem e a recuperação pós-reconexão (Step 7) consistentes —
          // ambos trabalham com targets 'failed'. Assim o post NÃO fica preso em
          // 'pending' eternamente: ele é finalizado e revivido quando a conta
          // reconectar.
          await qlog("warn", `token inválido em ${target.platform} — marcando conta para reconexão`, {
            post_id: item.post_id,
            queue_id: item.queue_id,
            platform: target.platform,
            details: { error: errMsg, social_account_id: target.social_account_id },
          })
          await sql`
            UPDATE social_accounts
            SET needs_reconnect = true, updated_at = NOW()
            WHERE id = ${target.social_account_id}
          `
          await sql`
            UPDATE post_targets
            SET status = 'failed', error_message = ${"Conta precisa reconexão: " + errMsg}
            WHERE id = ${target.target_id}
          `
        } else {
          await qlog("error", `falha ao publicar em ${target.platform}: ${errMsg}`, {
            post_id: item.post_id,
            queue_id: item.queue_id,
            platform: target.platform,
            details: { error: errMsg, post_type: target.post_type },
          })
          await sql`
            UPDATE post_targets
            SET status = 'failed', error_message = ${errMsg}
            WHERE id = ${target.target_id}
          `
        }
      }
    }

    await finalizeQueueItem(item.queue_id, item.post_id)

    results.push({
      queueId: item.queue_id,
      postId: item.post_id,
      targetsProcessed: targets.length,
    })
  }

  await qlog("info", `cron concluído — processados: ${results.length}`)
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
