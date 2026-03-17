import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// Instagram API with Instagram Login
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
const GRAPH_IG = "https://graph.instagram.com"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, workspaceId, redirectUri } = await request.json()

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_KEY

  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Configuração interna ausente." }, { status: 500 })
  }

  // redirect_uri deve ser idêntico ao usado no authorize
  const callbackUri = redirectUri || "https://social.list.dog/api/social/instagram/callback"

  try {
    // Step 1: Trocar código por Short-Lived Token
    const tokenBody = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: callbackUri,
      code,
    })

    const tokenRes = await fetch(IG_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error_type || tokenData.error) {
      const msg = tokenData.error_message || tokenData.error?.message || "Erro de autenticação."
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const shortToken = tokenData.access_token
    const igUserId = tokenData.user_id?.toString()

    if (!shortToken || !igUserId) {
      return NextResponse.json({ error: "Token inválido recebido." }, { status: 400 })
    }

    // Step 2: Trocar por Long-Lived Token (60 dias)
    // https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login#get-a-long-lived-token
    const llRes = await fetch(
      `${GRAPH_IG}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    )
    const llData = await llRes.json()
    const longToken = llData.access_token || shortToken

    // Step 3: Buscar perfil — campos disponíveis na Instagram API with Instagram Login
    const profileRes = await fetch(
      `${GRAPH_IG}/v22.0/${igUserId}?fields=id,name,username,profile_picture_url,account_type,followers_count&access_token=${longToken}`
    )
    const profile = await profileRes.json()

    if (profile.error) {
      return NextResponse.json(
        { error: `Erro ao buscar perfil: ${profile.error.message}` },
        { status: 400 }
      )
    }

    // Step 4: Salvar conta Instagram no banco
    await sql`
      INSERT INTO social_accounts
        (workspace_id, platform, account_id, page_id, account_name, account_username,
         profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
      VALUES
        (${workspaceId}, 'instagram', ${profile.id}, NULL,
         ${profile.name || profile.username || "Instagram"},
         ${profile.username || null},
         ${profile.profile_picture_url || null},
         ${longToken}, true, NOW(), NOW(), NOW())
      ON CONFLICT (workspace_id, platform, account_id)
      DO UPDATE SET
        account_name        = EXCLUDED.account_name,
        account_username    = EXCLUDED.account_username,
        profile_picture_url = EXCLUDED.profile_picture_url,
        access_token        = EXCLUDED.access_token,
        page_id             = NULL,
        is_active           = true,
        last_sync_at        = NOW(),
        updated_at          = NOW()
    `

    return NextResponse.json({
      success: true,
      saved: 1,
      accounts: [`@${profile.username || profile.name}`],
    })
  } catch {
    return NextResponse.json(
      { error: "Ocorreu um erro inesperado. Tente novamente em instantes." },
      { status: 500 }
    )
  }
}
