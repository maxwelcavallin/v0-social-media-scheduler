import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const IG_API = "https://api.instagram.com"
const GRAPH_IG = "https://graph.instagram.com"
const REDIRECT_URI = "https://social.list.dog/api/social/instagram/callback"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, workspaceId, redirectUri } = await request.json()

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  const CLIENT_ID = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET

  if (!CLIENT_ID || !appSecret) {
    console.error("[Instagram Process] Env vars ausentes — INSTAGRAM_APP_ID:", !!CLIENT_ID, "INSTAGRAM_APP_SECRET:", !!appSecret)
    return NextResponse.json({ error: "Configuração interna ausente." }, { status: 500 })
  }

  try {
    // Step 1: Trocar código por Short-Lived Access Token
    const usedRedirectUri = redirectUri || REDIRECT_URI

    // Extrai o code bruto da URL recebida (evita re-encoding por URLSearchParams)
    // O code pode conter caracteres como AQ... que o URLSearchParams re-encoda incorretamente
    const rawCodeMatch = (request as any)._rawCode || code

    // Monta body manualmente sem re-encodar o code
    const bodyString = [
      `client_id=${CLIENT_ID}`,
      `client_secret=${appSecret}`,
      `grant_type=authorization_code`,
      `redirect_uri=${encodeURIComponent(usedRedirectUri)}`,
      `code=${rawCodeMatch}`,
    ].join("&")

    const tokenRes = await fetch(`${IG_API}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyString,
    })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error_type || tokenData.error) {
      console.error("[Instagram Token Exchange Failed]", {
        status: tokenRes.status,
        error: tokenData,
        redirect_uri_used: usedRedirectUri,
        client_id_used: CLIENT_ID,
      })
      return NextResponse.json(
        { error: `Erro ao autenticar: ${tokenData.error_message || tokenData.error?.message || JSON.stringify(tokenData)}` },
        { status: 400 }
      )
    }

    const shortToken = tokenData.access_token
    const igUserId = tokenData.user_id?.toString()

    if (!shortToken || !igUserId) {
      return NextResponse.json({ error: "Token inválido recebido." }, { status: 400 })
    }

    // Step 2: Trocar por Long-Lived Token (60 dias)
    const llRes = await fetch(
      `${GRAPH_IG}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    )
    const llData = await llRes.json()
    const longToken = llData.access_token || shortToken

    // Step 3: Buscar perfil do usuário incluindo followers_count e account_type
    const profileRes = await fetch(
      `${GRAPH_IG}/${igUserId}?fields=id,name,username,profile_picture_url,account_type,followers_count&access_token=${longToken}`
    )
    const profile = await profileRes.json()

    if (profile.error) {
      return NextResponse.json(
        { error: "Não foi possível obter o perfil do Instagram." },
        { status: 400 }
      )
    }

    // Long-lived token expira em 60 dias
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

    // Step 4: Salvar conta Instagram com token_expires_at
    await sql`
      INSERT INTO social_accounts
        (workspace_id, platform, account_id, page_id, account_name, account_username,
         profile_picture_url, access_token, token_expires_at, is_active, last_sync_at, created_at, updated_at)
      VALUES
        (${workspaceId}, 'instagram', ${profile.id}, NULL,
         ${profile.name || profile.username || "Instagram"},
         ${profile.username || null},
         ${profile.profile_picture_url || null},
         ${longToken}, ${tokenExpiresAt.toISOString()}, true, NOW(), NOW(), NOW())
      ON CONFLICT (workspace_id, platform, account_id)
      DO UPDATE SET
        account_name        = EXCLUDED.account_name,
        account_username    = EXCLUDED.account_username,
        profile_picture_url = EXCLUDED.profile_picture_url,
        access_token        = EXCLUDED.access_token,
        token_expires_at    = EXCLUDED.token_expires_at,
        page_id             = NULL,
        is_active           = true,
        last_sync_at        = NOW(),
        updated_at          = NOW()
    `

    return NextResponse.json({
      success: true,
      saved: 1,
      accounts: [`@${profile.username || profile.name}`],
      profile: {
        username: profile.username,
        name: profile.name,
        profile_picture_url: profile.profile_picture_url,
        account_type: profile.account_type,
        followers_count: profile.followers_count,
        token_expires_at: tokenExpiresAt.toISOString(),
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Ocorreu um erro inesperado. Tente novamente em instantes." },
      { status: 500 }
    )
  }
}
