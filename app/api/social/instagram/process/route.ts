import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// Instagram Graph API (long-lived tokens)
const GRAPH = "https://graph.facebook.com/v22.0"
// Instagram OAuth API (code exchange — different from Facebook)
const IG_OAUTH = "https://api.instagram.com/oauth/access_token"
// Instagram Graph API does NOT support version prefixes like graph.facebook.com does
const IG_GRAPH = "https://graph.instagram.com"

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

    // ── Step 2: Fetch Instagram Business Account linked to the Facebook user ──
    // The token from api.instagram.com (Business Login) is a Facebook User Access Token.
    // graph.instagram.com/me only works with deprecated Basic Display API tokens — do NOT use it.
    // Correct flow: call graph.facebook.com/me/accounts to get Pages, then find linked IG account.
    const accessToken = shortToken

    console.log("[instagram/process] Step 2 — buscando Facebook user via graph.facebook.com/me")
    const fbMeRes = await fetch(
      `${GRAPH}/me?fields=id,name&access_token=${accessToken}`
    )
    const fbMeData = await fbMeRes.json()
    console.log("[instagram/process] Step 2 FB /me status:", fbMeRes.status)
    console.log("[instagram/process] Step 2 FB /me resposta:", JSON.stringify(fbMeData))

    if (!fbMeRes.ok || fbMeData.error) {
      return NextResponse.json(
        { error: `Erro ao buscar usuário Facebook: ${fbMeData.error?.message} [código ${fbMeData.error?.code}]` },
        { status: 400 }
      )
    }

    // Step 3: Get Pages managed by this user and find connected Instagram Business Account
    console.log("[instagram/process] Step 3 — buscando Pages e contas Instagram vinculadas")
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id,name,username,profile_picture_url}&access_token=${accessToken}`
    )
    const pagesData = await pagesRes.json()
    console.log("[instagram/process] Step 3 Pages status:", pagesRes.status)
    console.log("[instagram/process] Step 3 Pages resposta:", JSON.stringify(pagesData))

    if (!pagesRes.ok || pagesData.error) {
      return NextResponse.json(
        { error: `Erro ao buscar páginas: ${pagesData.error?.message} [código ${pagesData.error?.code}]` },
        { status: 400 }
      )
    }

    // Find first page with a connected Instagram Business Account
    const pages: any[] = pagesData.data || []
    const pageWithIg = pages.find((p) => p.instagram_business_account)
    const igAccount = pageWithIg?.instagram_business_account

    console.log("[instagram/process] Conta Instagram encontrada:", JSON.stringify(igAccount))

    // Fallback: use the user_id from Step 1 if no page/IG account found
    const accountId   = igAccount?.id       || igUserId
    const accountName = igAccount?.name     || fbMeData.name || `Instagram ${igUserId}`
    const accountUsername = igAccount?.username || null
    const profilePicture  = igAccount?.profile_picture_url || null

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
