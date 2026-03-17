import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// Instagram Graph API (long-lived tokens)
const GRAPH = "https://graph.facebook.com/v22.0"
// Instagram OAuth API (code exchange — different from Facebook)
const IG_OAUTH = "https://api.instagram.com/oauth/access_token"
// Instagram Graph (for user info after token exchange)
const IG_GRAPH = "https://graph.instagram.com/v22.0"

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
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID ou INSTAGRAM_APP_KEY não configurados no servidor." },
      { status: 500 }
    )
  }

  // Always derive redirectUri from the actual request host
  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const finalRedirectUri = `${protocol}://${host}/api/social/instagram/callback`

  try {
    // Step 1: Exchange code for short-lived token via Instagram OAuth endpoint
    const tokenBody = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: finalRedirectUri,
      code,
    })

    const tokenRes = await fetch(IG_OAUTH, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error_type || tokenData.error_message) {
      return NextResponse.json(
        { error: `Erro ao trocar código: ${tokenData.error_message} (redirect_uri usado: ${finalRedirectUri})` },
        { status: 400 }
      )
    }

    const shortToken = tokenData.access_token
    const igUserId = tokenData.user_id?.toString()

    if (!shortToken || !igUserId) {
      return NextResponse.json(
        { error: `Token ou user_id ausente na resposta: ${JSON.stringify(tokenData)}` },
        { status: 400 }
      )
    }

    // Step 2: Exchange short-lived token for long-lived token
    // Instagram Business Login short-lived tokens last ~1h; exchange for 60-day token
    const longParams = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: appSecret,
      access_token: shortToken,
    })
    const longRes = await fetch(`${IG_GRAPH}/access_token?${longParams.toString()}`)
    const longData = await longRes.json()
    // Use long-lived token if exchange succeeded, otherwise keep short-lived
    const longToken = longData.access_token || shortToken

    // Step 3: Get Instagram user profile via /me endpoint (not by user ID)
    // Only fields available without app review: id, name, username, account_type
    const meRes = await fetch(
      `${IG_GRAPH}/me?fields=id,name,username,account_type&access_token=${longToken}`
    )
    const meData = await meRes.json()

    if (meData.error) {
      return NextResponse.json(
        { error: `Erro ao buscar perfil Instagram: ${meData.error.message} [código ${meData.error.code}]` },
        { status: 400 }
      )
    }

    const accountId = meData.id || igUserId
    const accountName = meData.name || meData.username || "Instagram"
    const accountUsername = meData.username || null
    const profilePicture = null // profile_picture_url requires app review

    // Step 4: Save to social_accounts
    await sql`
      INSERT INTO social_accounts
        (workspace_id, platform, account_id, page_id, account_name, account_username,
         profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
      VALUES
        (${workspaceId}, 'instagram', ${accountId}, null, ${accountName},
         ${accountUsername}, ${profilePicture}, ${longToken},
         true, NOW(), NOW(), NOW())
      ON CONFLICT (platform, account_id)
      DO UPDATE SET
        account_name        = EXCLUDED.account_name,
        account_username    = EXCLUDED.account_username,
        profile_picture_url = EXCLUDED.profile_picture_url,
        access_token        = EXCLUDED.access_token,
        workspace_id        = EXCLUDED.workspace_id,
        is_active           = true,
        last_sync_at        = NOW(),
        updated_at          = NOW()
    `

    return NextResponse.json({
      success: true,
      saved: 1,
      accounts: [`@${accountUsername || accountName}`],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno." }, { status: 500 })
  }
}
