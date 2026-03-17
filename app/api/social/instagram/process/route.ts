import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// Facebook Graph API — Facebook Login for Business returns a Facebook User Token
// that works with graph.facebook.com (NOT graph.instagram.com)
const GRAPH = "https://graph.facebook.com/v22.0"
// Facebook OAuth token exchange endpoint
const FB_TOKEN_URL = "https://graph.facebook.com/v22.0/oauth/access_token"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, workspaceId } = await request.json()

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "FACEBOOK_APP_ID ou FACEBOOK_APP_SECRET não configurados." },
      { status: 500 }
    )
  }

  // Derive redirect_uri from actual host — must match exactly what was used in authorize
  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const redirectUri = `${protocol}://${host}/api/social/instagram/callback`

  try {
    // ── Step 1: Exchange authorization code for Facebook User Access Token ────
    console.log("[instagram/process] Step 1 — trocando código por Facebook User Token")
    console.log("[instagram/process] redirect_uri:", redirectUri)
    console.log("[instagram/process] app_id:", appId)

    const tokenUrl = new URL(FB_TOKEN_URL)
    tokenUrl.searchParams.set("client_id", appId)
    tokenUrl.searchParams.set("client_secret", appSecret)
    tokenUrl.searchParams.set("redirect_uri", redirectUri)
    tokenUrl.searchParams.set("code", code)

    const tokenRes = await fetch(tokenUrl.toString())
    const tokenData = await tokenRes.json()
    console.log("[instagram/process] Step 1 status:", tokenRes.status)
    console.log("[instagram/process] Step 1 resposta:", JSON.stringify(tokenData))

    if (!tokenRes.ok || tokenData.error) {
      return NextResponse.json(
        { error: `Erro ao trocar código: ${tokenData.error?.message || JSON.stringify(tokenData)}` },
        { status: 400 }
      )
    }

    const userToken = tokenData.access_token
    if (!userToken) {
      return NextResponse.json({ error: "Token ausente na resposta." }, { status: 400 })
    }

    // ── Step 2: Get Facebook Pages and linked Instagram Business Accounts ─────
    console.log("[instagram/process] Step 2 — buscando Pages e contas Instagram vinculadas")
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}&access_token=${userToken}&limit=50`
    )
    const pagesData = await pagesRes.json()
    console.log("[instagram/process] Step 2 status:", pagesRes.status)
    console.log("[instagram/process] Step 2 resposta:", JSON.stringify(pagesData))

    if (!pagesRes.ok || pagesData.error) {
      return NextResponse.json(
        { error: `Erro ao buscar páginas: ${pagesData.error?.message} [código ${pagesData.error?.code}]` },
        { status: 400 }
      )
    }

    const pages: any[] = pagesData.data || []
    const igPages = pages.filter((p) => p.instagram_business_account)
    console.log("[instagram/process] Pages com Instagram vinculado:", igPages.length)

    if (igPages.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma conta Instagram Business encontrada vinculada às suas Páginas do Facebook. " +
            "Certifique-se de que sua conta Instagram está conectada a uma Página do Facebook no Gerenciador de Negócios.",
        },
        { status: 400 }
      )
    }

    // ── Step 3: Save all found Instagram Business Accounts ────────────────────
    const savedAccounts: string[] = []

    for (const page of igPages) {
      const ig = page.instagram_business_account
      // Use the Page Access Token for publishing (required by Content Publishing API)
      const pageAccessToken = page.access_token || userToken

      console.log("[instagram/process] Salvando conta:", ig.username, "| Page:", page.name)

      await sql`
        INSERT INTO social_accounts
          (workspace_id, platform, account_id, page_id, account_name, account_username,
           profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
        VALUES
          (${workspaceId}, 'instagram', ${ig.id}, ${page.id}, ${ig.name || ig.username},
           ${ig.username || null}, ${ig.profile_picture_url || null}, ${pageAccessToken},
           true, NOW(), NOW(), NOW())
        ON CONFLICT (workspace_id, platform, account_id)
        DO UPDATE SET
          account_name        = EXCLUDED.account_name,
          account_username    = EXCLUDED.account_username,
          profile_picture_url = EXCLUDED.profile_picture_url,
          access_token        = EXCLUDED.access_token,
          page_id             = EXCLUDED.page_id,
          is_active           = true,
          last_sync_at        = NOW(),
          updated_at          = NOW()
      `
      savedAccounts.push(`@${ig.username || ig.name}`)
    }

    return NextResponse.json({
      success: true,
      saved: savedAccounts.length,
      accounts: savedAccounts,
    })
  } catch (err: any) {
    console.log("[instagram/process] Erro inesperado:", err.message)
    return NextResponse.json({ error: err.message || "Erro interno." }, { status: 500 })
  }
}
