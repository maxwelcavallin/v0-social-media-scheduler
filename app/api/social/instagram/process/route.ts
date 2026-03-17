import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// Instagram OAuth API (code → token exchange)
const IG_OAUTH = "https://api.instagram.com/oauth/access_token"
// Instagram Graph API — Business Login uses versioned endpoint
const IG_GRAPH = "https://graph.instagram.com/v25.0"

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
    // ── Step 1: Exchange authorization code for access token ──────────────────
    console.log("[instagram/process] Step 1 — trocando código por token")
    console.log("[instagram/process] redirect_uri usado:", finalRedirectUri)
    console.log("[instagram/process] IG_OAUTH endpoint:", IG_OAUTH)
    console.log("[instagram/process] app_id:", appId)

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
    console.log("[instagram/process] Step 1 status:", tokenRes.status)
    console.log("[instagram/process] Step 1 resposta:", JSON.stringify(tokenData))

    if (!tokenRes.ok || tokenData.error_type || tokenData.error_message) {
      return NextResponse.json(
        { error: `Erro ao trocar código: ${tokenData.error_message || tokenData.error_type} (redirect_uri: ${finalRedirectUri})` },
        { status: 400 }
      )
    }

    // Business Login returns flat: { "access_token": "...", "user_id": "..." }
    // Some versions wrap in data array — handle both
    const tokenEntry = Array.isArray(tokenData.data) ? tokenData.data[0] : tokenData
    const shortToken = tokenEntry?.access_token
    const igUserId = tokenEntry?.user_id?.toString()
    console.log("[instagram/process] shortToken presente:", !!shortToken)
    console.log("[instagram/process] igUserId:", igUserId)

    if (!shortToken || !igUserId) {
      return NextResponse.json(
        { error: `Token ou user_id ausente. Resposta completa: ${JSON.stringify(tokenData)}` },
        { status: 400 }
      )
    }

    // ── Step 2: Fetch profile via graph.instagram.com/v25.0/me ──────────────
    // For Instagram Business Login (scopes: instagram_business_*):
    //   - ig_exchange_token does NOT exist — only for deprecated Basic Display API
    //   - The token from Step 1 is valid directly for /me on graph.instagram.com
    //   - Response wraps data in { "data": [{ "user_id": "...", "username": "..." }] }
    const accessToken = shortToken
    console.log("[instagram/process] Step 2 — buscando perfil em graph.instagram.com/v25.0/me")
    const meRes = await fetch(
      `${IG_GRAPH}/me?fields=user_id,name,username,profile_picture_url,account_type&access_token=${accessToken}`
    )
    const meRaw = await meRes.json()
    console.log("[instagram/process] Step 2 status:", meRes.status)
    console.log("[instagram/process] Step 2 resposta:", JSON.stringify(meRaw))

    if (!meRes.ok || meRaw.error) {
      return NextResponse.json(
        { error: `Erro ao buscar perfil: ${meRaw.error?.message} [código ${meRaw.error?.code}]` },
        { status: 400 }
      )
    }

    // Business Login /me returns { "data": [{ ... }] } array
    const meData      = Array.isArray(meRaw.data) ? meRaw.data[0] : meRaw
    const accountId   = meData.user_id  || meData.id || igUserId
    const accountName = meData.name     || meData.username || `Instagram ${igUserId}`
    const accountUsername = meData.username || null
    const profilePicture  = meData.profile_picture_url || null

    // Step 4: Save to social_accounts
    await sql`
      INSERT INTO social_accounts
        (workspace_id, platform, account_id, page_id, account_name, account_username,
         profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
      VALUES
        (${workspaceId}, 'instagram', ${accountId}, null, ${accountName},
         ${accountUsername}, ${profilePicture}, ${accessToken},
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
