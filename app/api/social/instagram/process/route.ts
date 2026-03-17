import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const IG_API = "https://api.instagram.com"
const GRAPH_IG = "https://graph.instagram.com"
// Deve ser idêntico ao client_id usado no authorize
const CLIENT_ID = "2170374997100265"
// Deve ser idêntico ao redirect_uri cadastrado no painel Meta para esse app
const REDIRECT_URI = "https://social.list.dog/api/social/instagram/callback"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, workspaceId, redirectUri } = await request.json()

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  const appSecret = process.env.INSTAGRAM_APP_KEY

  if (!appSecret) {
    return NextResponse.json({ error: "Configuração interna ausente." }, { status: 500 })
  }

  try {
    // Step 1: Trocar código por Short-Lived Access Token
    // client_id e redirect_uri DEVEM ser idênticos aos usados no authorize
    const usedRedirectUri = redirectUri || REDIRECT_URI
    const tokenBody = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: usedRedirectUri,
      code,
    })

    console.log("[v0] instagram/process - client_id:", CLIENT_ID)
    console.log("[v0] instagram/process - redirect_uri:", usedRedirectUri)
    console.log("[v0] instagram/process - body (sem secret):", tokenBody.toString().replace(appSecret, "***"))

    const tokenRes = await fetch(`${IG_API}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    })
    const tokenData = await tokenRes.json()

    console.log("[v0] instagram/process - tokenRes.status:", tokenRes.status)
    console.log("[v0] instagram/process - tokenData:", JSON.stringify(tokenData))

    if (!tokenRes.ok || tokenData.error_type || tokenData.error) {
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

    // Step 3: Buscar perfil do usuário
    const profileRes = await fetch(
      `${GRAPH_IG}/${igUserId}?fields=id,name,username,profile_picture_url,account_type&access_token=${longToken}`
    )
    const profile = await profileRes.json()

    if (profile.error) {
      return NextResponse.json(
        { error: "Não foi possível obter o perfil do Instagram." },
        { status: 400 }
      )
    }

    // Step 4: Salvar conta Instagram
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
