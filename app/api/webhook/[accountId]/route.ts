import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { publishToInstagram, publishToFacebook } from "@/lib/publish"

export const maxDuration = 120

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params

  // Validar Authorization: Bearer <secret>
  const authHeader = request.headers.get("authorization") || ""
  const secret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!secret) {
    return NextResponse.json({ error: "Authorization header ausente" }, { status: 401 })
  }

  // Buscar conta e validar secret
  const [account] = await sql`
    SELECT id, platform, account_id, page_id, access_token, webhook_secret, account_username
    FROM social_accounts
    WHERE id = ${accountId} AND is_active = true
    LIMIT 1
  `
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
  }
  if (!account.webhook_secret || account.webhook_secret !== secret) {
    return NextResponse.json({ error: "Secret inválido" }, { status: 401 })
  }

  // Payload esperado:
  // { content, media_urls, media_types, post_type, cover_url }
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 })
  }

  const {
    content = "",
    media_urls = null,
    media_types = null,
    post_type = "feed",
    cover_url = null,
  } = body

  // Salvar post no banco antes de publicar
  const [post] = await sql`
    INSERT INTO posts (content, status, workspace_id, created_by, created_at, updated_at)
    SELECT ${content}, 'published', o.id, m.user_id, NOW(), NOW()
    FROM social_accounts sa
    JOIN organization o ON o.id = sa.workspace_id
    JOIN member m ON m.organization_id = o.id
    WHERE sa.id = ${accountId}
    LIMIT 1
    RETURNING id, workspace_id
  `
  if (!post) {
    return NextResponse.json({ error: "Erro ao salvar post" }, { status: 500 })
  }

  // Salvar mídia se houver
  if (media_urls && media_urls.length > 0) {
    for (let i = 0; i < media_urls.length; i++) {
      await sql`
        INSERT INTO post_media (post_id, url, media_type, order_index)
        VALUES (${post.id}, ${media_urls[i]}, ${media_types?.[i] || "image"}, ${i})
      `
    }
  }

  // Salvar target
  await sql`
    INSERT INTO post_targets (post_id, social_account_id, post_type)
    VALUES (${post.id}, ${accountId}, ${post_type})
  `

  // Publicar na rede social
  try {
    let externalId: string

    if (account.platform === "facebook") {
      externalId = await publishToFacebook({
        access_token: account.access_token,
        page_id: account.page_id || account.account_id,
        content,
        media_urls,
        media_types,
      })
    } else {
      // instagram
      externalId = await publishToInstagram({
        access_token: account.access_token,
        account_id: account.account_id,
        page_id: account.page_id,
        content,
        media_urls,
        media_types,
        post_type,
        cover_url,
      })
    }

    await sql`
      UPDATE posts SET status = 'published', published_at = NOW(), updated_at = NOW()
      WHERE id = ${post.id}
    `

    return NextResponse.json({ success: true, post_id: post.id, external_id: externalId })
  } catch (err: any) {
    const message: string = err.message ?? "Erro desconhecido"

    const isRateLimit = message.includes("Media Publish Limit") || message.includes("too many actions") || message.includes("code 9")
    // Erro 190: token sem permissões suficientes — conta precisa ser reconectada
    const isPermissionError = message.includes("190") || message.includes("impersonating a user's page") || message.includes("pages_read_engagement")

    if (isPermissionError) {
      await sql`
        UPDATE social_accounts SET needs_reconnect = true, updated_at = NOW()
        WHERE id = ${accountId}
      `
    }

    await sql`
      UPDATE posts SET status = 'failed', error_message = ${message}, updated_at = NOW()
      WHERE id = ${post.id}
    `
    return NextResponse.json(
      {
        error: isPermissionError
          ? "Permissões insuficientes. Reconecte a conta nas configurações do workspace para atualizar o token."
          : isRateLimit
          ? "Limite de publicações da API do Instagram atingido. O Instagram permite até 25 posts por 24h via API. Tente novamente amanhã."
          : message,
        code: isPermissionError ? "NEEDS_RECONNECT" : isRateLimit ? "RATE_LIMIT" : "PUBLISH_ERROR",
      },
      { status: isPermissionError ? 403 : isRateLimit ? 429 : 502 }
    )
  }
}
