import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const IG_API = "https://api.instagram.com"
const GRAPH_FB = "https://graph.facebook.com"
const GRAPH_IG = "https://graph.instagram.com"
const CLIENT_ID = "2170374997100265"
const REDIRECT_URI = "https://social.list.dog/api/social/instagram/callback"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const rawState = searchParams.get("state")
  const error = searchParams.get("error")

  console.log("[v0] ig-callback: recebido. code:", !!code, "state:", rawState?.slice(0, 30), "error:", error)

  let workspaceId = ""

  try {
    const decoded = JSON.parse(atob(rawState || ""))
    workspaceId = decoded.workspaceId || ""
    console.log("[v0] ig-callback: workspaceId decodificado:", workspaceId)
  } catch {
    workspaceId = rawState || ""
    console.log("[v0] ig-callback: state raw usado como workspaceId:", workspaceId)
  }

  const accountsUrl = new URL(`/workspace/${workspaceId}/accounts`, request.url)

  if (error || !code || !workspaceId) {
    console.log("[v0] ig-callback: saída antecipada — error:", error, "code:", !!code, "workspaceId:", workspaceId)
    accountsUrl.searchParams.set("ig_error", error || "missing_params")
    return NextResponse.redirect(accountsUrl)
  }

  const appSecret = process.env.INSTAGRAM_APP_KEY
  if (!appSecret) {
    console.log("[v0] ig-callback: INSTAGRAM_APP_KEY não configurado")
    accountsUrl.searchParams.set("ig_error", "config_error")
    return NextResponse.redirect(accountsUrl)
  }

  console.log("[v0] ig-callback: iniciando troca de token. workspaceId:", workspaceId, "code:", code?.slice(0, 20))

  try {
    // Step 1: Trocar código por short-lived token
    const tokenBody = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    })

    console.log("[v0] ig-callback step1 body enviado:", tokenBody.toString().replace(appSecret, "***"))

    // Tentar primeiro com api.instagram.com (Instagram Login puro)
    // Se falhar, tentar com graph.facebook.com (Facebook App com Instagram Login)
    let tokenRes = await fetch(`${IG_API}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    })
    let tokenData = await tokenRes.json()
    console.log("[v0] ig-callback step1 via api.instagram.com status:", tokenRes.status, "data:", JSON.stringify(tokenData))

    if (!tokenRes.ok || tokenData.error_type) {
      console.log("[v0] ig-callback step1 fallback: tentando graph.facebook.com")
      tokenRes = await fetch(`${GRAPH_FB}/v22.0/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      })
      tokenData = await tokenRes.json()
      console.log("[v0] ig-callback step1 via graph.facebook.com status:", tokenRes.status, "data:", JSON.stringify(tokenData))
    }

    if (!tokenRes.ok || tokenData.error_type || tokenData.error) {
      console.log("[v0] ig-callback step1 ERRO final:", tokenData.error_message || tokenData.error?.message)
      accountsUrl.searchParams.set("ig_error", encodeURIComponent(tokenData.error_message || tokenData.error?.message || "auth_error"))
      return NextResponse.redirect(accountsUrl)
    }

    const shortToken: string = tokenData.access_token
    // graph.facebook.com retorna user_id como string; api.instagram.com como number
    const igUserId: string = String(tokenData.user_id || tokenData.id || "")

    // Step 2: Long-lived token (60 dias)
    const llRes = await fetch(
      `${GRAPH_IG}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    )
    const llData = await llRes.json()
    console.log("[v0] ig-callback step2 long-lived:", llRes.status, "error:", llData.error)
    const longToken: string = llData.access_token || shortToken

    // Step 3: Buscar perfil
    const profileRes = await fetch(
      `${GRAPH_IG}/v22.0/${igUserId}?fields=id,name,username,profile_picture_url,followers_count&access_token=${longToken}`
    )
    const profile = await profileRes.json()
    console.log("[v0] ig-callback step3 profile:", JSON.stringify(profile))

    // Step 4: Salvar no banco
    console.log("[v0] ig-callback step4: salvando no banco. DATABASE_URL set:", !!process.env.DATABASE_URL)
    const sql = neon(process.env.DATABASE_URL!)
    await sql`
      INSERT INTO social_accounts (
        workspace_id, platform, account_id, page_id, account_name,
        account_username, profile_picture_url, access_token,
        is_active, last_sync_at, created_at, updated_at
      ) VALUES (
        ${workspaceId}, 'instagram', ${igUserId}, NULL,
        ${profile.name || profile.username || "Instagram"},
        ${profile.username || null},
        ${profile.profile_picture_url || null},
        ${longToken}, true, NOW(), NOW(), NOW()
      )
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
    console.log("[v0] ig-callback step4: salvo com sucesso. igUserId:", igUserId)

    const successUrl = new URL(`/workspace/${workspaceId}/accounts/connecting-instagram`, request.url)
    successUrl.searchParams.set("success", "1")
    successUrl.searchParams.set("username", profile.username || igUserId)
    console.log("[v0] ig-callback: redirecionando para:", successUrl.toString())
    return NextResponse.redirect(successUrl)
  } catch (err: any) {
    console.log("[v0] ig-callback CATCH:", err.message, err.stack)
    const errorUrl = new URL(`/workspace/${workspaceId}/accounts/connecting-instagram`, request.url)
    errorUrl.searchParams.set("error", encodeURIComponent(err.message || "unexpected_error"))
    return NextResponse.redirect(errorUrl)
  }
}
