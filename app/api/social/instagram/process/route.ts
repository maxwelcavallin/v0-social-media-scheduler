import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// Instagram Business Login uses api.instagram.com for token exchange
const IG_OAUTH = "https://api.instagram.com/oauth/access_token"
// Profile and long-lived token exchange use graph.instagram.com
const IG_GRAPH = "https://graph.instagram.com/v22.0"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, workspaceId } = await request.json()

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_KEY

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID ou INSTAGRAM_APP_KEY não configurados." },
      { status: 500 }
    )
  }

  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const redirectUri = `${protocol}://${host}/api/social/instagram/callback`

  try {
    // ── Step 1: Exchange code for short-lived token ───────────────────────────
    const tokenRes = await fetch(IG_OAUTH, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }).toString(),
    })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error_type || tokenData.error_message) {
      return NextResponse.json(
        { error: `Erro ao trocar código: ${tokenData.error_message || tokenData.error_type || JSON.stringify(tokenData)}` },
        { status: 400 }
      )
    }

    const shortToken: string = tokenData.access_token
    const igUserId: string = tokenData.user_id?.toString()

    if (!shortToken || !igUserId) {
      return NextResponse.json(
        { error: `Token ou user_id ausente. Resposta: ${JSON.stringify(tokenData)}` },
        { status: 400 }
      )
    }

    // ── Step 2: Exchange for long-lived token (60 days) ───────────────────────
    const longRes = await fetch(
      `${IG_GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    )
    const longData = await longRes.json()

    const accessToken: string = longData.access_token || shortToken

    // ── Step 3: Fetch profile via Instagram Graph API ─────────────────────────
    // Business Login API supports: id, name, username, profile_picture_url, followers_count
    const profileRes = await fetch(
      `${IG_GRAPH}/${igUserId}?fields=id,name,username,profile_picture_url&access_token=${accessToken}`
    )
    const profileData = await profileRes.json()

    if (!profileRes.ok || profileData.error) {
      return NextResponse.json(
        { error: `Erro ao buscar perfil: ${profileData.error?.message || JSON.stringify(profileData)}` },
        { status: 400 }
      )
    }

    const accountId = profileData.id || igUserId
    const accountName = profileData.name || profileData.username || `Instagram ${igUserId}`
    const accountUsername = profileData.username || null
    const profilePicture = profileData.profile_picture_url || null

    // ── Step 4: Save to database ──────────────────────────────────────────────
    await sql`
      INSERT INTO social_accounts
        (workspace_id, platform, account_id, page_id, account_name, account_username,
         profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
      VALUES
        (${workspaceId}, 'instagram', ${accountId}, null, ${accountName},
         ${accountUsername}, ${profilePicture}, ${accessToken},
         true, NOW(), NOW(), NOW())
      ON CONFLICT (workspace_id, platform, account_id)
      DO UPDATE SET
        account_name        = EXCLUDED.account_name,
        account_username    = EXCLUDED.account_username,
        profile_picture_url = EXCLUDED.profile_picture_url,
        access_token        = EXCLUDED.access_token,
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
