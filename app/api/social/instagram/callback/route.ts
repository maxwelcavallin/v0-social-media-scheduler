import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const IG_API = "https://api.instagram.com"
const GRAPH_IG = "https://graph.instagram.com"
const CLIENT_ID = "2170374997100265"
const REDIRECT_URI = "https://social.list.dog/api/social/instagram/callback"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const rawState = searchParams.get("state")
  const error = searchParams.get("error")

  let workspaceId = ""

  try {
    const decoded = JSON.parse(atob(rawState || ""))
    workspaceId = decoded.workspaceId || ""
  } catch {
    workspaceId = rawState || ""
  }

  console.log("[v0] ig-callback code:", !!code, "workspaceId:", workspaceId, "error:", error)

  const accountsUrl = new URL(`/workspace/${workspaceId}/accounts`, request.url)

  if (error || !code || !workspaceId) {
    console.log("[v0] ig-callback early-exit: error=", error, "code=", !!code, "workspaceId=", workspaceId)
    accountsUrl.searchParams.set("ig_error", error || "missing_params")
    return NextResponse.redirect(accountsUrl)
  }

  const appSecret = process.env.INSTAGRAM_APP_KEY
  if (!appSecret) {
    console.log("[v0] ig-callback early-exit: INSTAGRAM_APP_KEY not set")
    accountsUrl.searchParams.set("ig_error", "config_error")
    return NextResponse.redirect(accountsUrl)
  }

  console.log("[v0] ig-callback proceeding to token exchange")

  try {
    // Step 1: Trocar código por short-lived token — feito AQUI no servidor imediatamente
    const tokenBody = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    })

    const tokenRes = await fetch(`${IG_API}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error_type) {
      accountsUrl.searchParams.set("ig_error", encodeURIComponent(tokenData.error_message || "auth_error"))
      return NextResponse.redirect(accountsUrl)
    }

    const shortToken: string = tokenData.access_token
    const igUserId: string = String(tokenData.user_id)

    // Step 2: Trocar por long-lived token (60 dias)
    const llRes = await fetch(
      `${GRAPH_IG}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    )
    const llData = await llRes.json()
    const longToken: string = llData.access_token || shortToken

    // Step 3: Buscar perfil
    const profileRes = await fetch(
      `${GRAPH_IG}/v22.0/${igUserId}?fields=id,name,username,profile_picture_url,followers_count&access_token=${longToken}`
    )
    const profile = await profileRes.json()

    // Step 4: Salvar no banco (usar colunas corretas do schema: account_username, não username)
    const sql = neon(process.env.DATABASE_URL!)
    await sql`
      INSERT INTO social_accounts (
        workspace_id, platform, account_id, account_name,
        account_username, profile_picture_url, access_token, is_active, updated_at
      ) VALUES (
        ${workspaceId}, 'instagram', ${igUserId},
        ${profile.name || profile.username || "Instagram"},
        ${profile.username || null},
        ${profile.profile_picture_url || null},
        ${longToken}, true, NOW()
      )
      ON CONFLICT (workspace_id, platform, account_id)
      DO UPDATE SET
        account_name = EXCLUDED.account_name,
        account_username = EXCLUDED.account_username,
        profile_picture_url = EXCLUDED.profile_picture_url,
        access_token = EXCLUDED.access_token,
        is_active = true,
        updated_at = NOW()
    `

    // Redirecionar para connecting-instagram com sucesso para mostrar feedback visual
    const successUrl = new URL(`/workspace/${workspaceId}/accounts/connecting-instagram`, request.url)
    successUrl.searchParams.set("success", "1")
    successUrl.searchParams.set("username", profile.username || igUserId)
    return NextResponse.redirect(successUrl)
  } catch (err: any) {
    console.log("[v0] ig-callback catch error:", err.message)
    const errorUrl = new URL(`/workspace/${workspaceId}/accounts/connecting-instagram`, request.url)
    errorUrl.searchParams.set("error", encodeURIComponent(err.message || "unexpected_error"))
    return NextResponse.redirect(errorUrl)
  }
}
