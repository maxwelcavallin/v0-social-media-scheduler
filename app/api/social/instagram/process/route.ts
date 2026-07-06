import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { getUserCompany } from "@/lib/company"

const IG_API = "https://api.instagram.com"
const GRAPH_IG = "https://graph.instagram.com"
const REDIRECT_URI = "https://social.list.dog/api/social/instagram/callback"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, redirectUri } = await request.json()

  if (!code) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  // A conexão pertence à EMPRESA do usuário logado (pool global de contas).
  const company = await getUserCompany(session.user.id)
  if (!company) {
    return NextResponse.json({ error: "Cadastre sua empresa antes de conectar contas." }, { status: 400 })
  }
  const companyId = company.id

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

    console.log("[v0] Step1 OK — shortToken:", !!shortToken, "igUserId:", igUserId)

    if (!shortToken || !igUserId) {
      console.error("[v0] Token inválido — tokenData:", tokenData)
      return NextResponse.json({ error: "Token inválido recebido." }, { status: 400 })
    }

    // Step 2: Trocar por Long-Lived Token (60 dias)
    const llUrl = `${GRAPH_IG}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    console.log("[v0] Step2 — trocando por long-lived token...")
    const llRes = await fetch(llUrl)
    const llData = await llRes.json()
    console.log("[v0] Step2 result — status:", llRes.status, "error:", llData.error, "has_token:", !!llData.access_token)
    const longToken = llData.access_token || shortToken

    // Step 3: Buscar perfil via /me (campos básicos garantidos por instagram_business_basic)
    // Não incluir followers_count aqui — causa erro 500 em apps sem revisão avançada
    const profileUrl = `${GRAPH_IG}/me?fields=id,username,name,profile_picture_url,account_type&access_token=${longToken}`
    console.log("[v0] Step3 — buscando perfil via /me")
    const profileRes = await fetch(profileUrl)
    const profile = await profileRes.json()
    console.log("[v0] Step3 result", {
      status: profileRes.status,
      id: profile.id,
      username: profile.username,
      account_type: profile.account_type,
      error: profile.error,
    })

    if (!profileRes.ok || !profile.id) {
      console.error("[v0] Profile fetch failed:", {
        status: profileRes.status,
        error: profile.error,
        igUserId,
        usedLongToken: !!llData.access_token,
      })
      return NextResponse.json(
        { error: `Não foi possível obter o perfil: ${profile.error?.message || JSON.stringify(profile)}` },
        { status: 400 }
      )
    }

    // Step 3b: Buscar followers_count separadamente com fallback (campo avançado — pode falhar)
    let followersCount: number | null = null
    try {
      const followersRes = await fetch(`${GRAPH_IG}/me?fields=followers_count&access_token=${longToken}`)
      if (followersRes.ok) {
        const followersData = await followersRes.json()
        followersCount = followersData.followers_count ?? null
      }
    } catch {
      // ignorado — followers_count é opcional
    }

    // Long-lived token expira em 60 dias
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

    // Step 4: Salvar a conta Instagram no POOL GLOBAL da empresa (connected_accounts).
    // A conta fica disponível para qualquer workspace da empresa selecionar depois.
    // Instagram direto não tem página do Facebook (page_id = NULL) nem user token.
    await sql`
      INSERT INTO connected_accounts
        (company_id, connected_by_user_id, platform, external_id, page_id,
         name, username, picture_url, access_token, user_access_token,
         token_expires_at, fb_user_id, source, created_at, updated_at)
      VALUES
        (${companyId}, ${session.user.id}, 'instagram', ${profile.id}, NULL,
         ${profile.name || profile.username || "Instagram"},
         ${profile.username || null},
         ${profile.profile_picture_url || null},
         ${longToken}, NULL, ${tokenExpiresAt.toISOString()}, NULL, 'instagram_direct', NOW(), NOW())
      ON CONFLICT (company_id, platform, external_id)
      DO UPDATE SET
        name             = EXCLUDED.name,
        username         = EXCLUDED.username,
        picture_url      = EXCLUDED.picture_url,
        access_token     = EXCLUDED.access_token,
        token_expires_at = EXCLUDED.token_expires_at,
        page_id          = NULL,
        source           = 'instagram_direct',
        updated_at       = NOW()
    `

    // Propaga o token fresco para social_accounts já vinculadas desta conta IG
    // direta em qualquer workspace da empresa (mantém a publicação funcionando).
    await sql`
      UPDATE social_accounts
      SET access_token = ${longToken}, token_expires_at = ${tokenExpiresAt.toISOString()},
          needs_reconnect = false, is_active = true, updated_at = NOW(), last_sync_at = NOW()
      WHERE platform = 'instagram' AND account_id = ${profile.id} AND page_id IS NULL
        AND workspace_id IN (SELECT id FROM "organization" WHERE company_id = ${companyId})
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
        followers_count: followersCount,
        token_expires_at: tokenExpiresAt.toISOString(),
      },
    })
  } catch (e: any) {
    console.error("[v0] Instagram process — erro inesperado:", e?.message, e?.stack)
    return NextResponse.json(
      { error: `Erro inesperado: ${e?.message || "desconhecido"}` },
      { status: 500 }
    )
  }
}
