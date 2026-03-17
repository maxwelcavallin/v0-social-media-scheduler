import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH = "https://graph.facebook.com/v18.0"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, workspaceId, redirectUri } = await request.json()

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  // Reuse the same env vars already used by the Facebook/Meta integration
  const appId     = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_KEY

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "Configuração do servidor incompleta. Contate o suporte." },
      { status: 500 }
    )
  }

  // Derive redirect_uri from request host — must match exactly what was sent in authorize
  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const finalRedirectUri = redirectUri || `${protocol}://${host}/api/social/instagram/callback`

  try {
    // ── Step 1: Exchange authorization code for User Access Token ─────────────
    console.log("[instagram/process] Step 1 — trocando código por token Facebook")
    console.log("[instagram/process] redirect_uri:", finalRedirectUri)
    console.log("[instagram/process] app_id:", appId)

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: finalRedirectUri,
      code,
    })
    const tokenRes = await fetch(`${GRAPH}/oauth/access_token?${tokenParams.toString()}`)
    const tokenData = await tokenRes.json()
    console.log("[instagram/process] Step 1 status:", tokenRes.status)
    console.log("[instagram/process] Step 1 resposta:", JSON.stringify(tokenData))

    if (!tokenRes.ok || tokenData.error) {
      return NextResponse.json(
        { error: `Erro ao autenticar. Tente novamente. [${tokenData.error?.message}]` },
        { status: 400 }
      )
    }

    const userAccessToken = tokenData.access_token

    // ── Step 2: Fetch Pages managed by this user ──────────────────────────────
    console.log("[instagram/process] Step 2 — buscando páginas do usuário")
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?access_token=${userAccessToken}`
    )
    const pagesData = await pagesRes.json()
    console.log("[instagram/process] Step 2 status:", pagesRes.status)
    console.log("[instagram/process] Step 2 resposta:", JSON.stringify(pagesData))

    if (!pagesRes.ok || pagesData.error) {
      return NextResponse.json(
        { error: "Não foi possível acessar suas páginas do Facebook. Tente novamente." },
        { status: 400 }
      )
    }

    const pages: any[] = pagesData.data || []
    console.log("[instagram/process] Total de páginas encontradas:", pages.length)

    if (pages.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma página do Facebook encontrada. Para conectar seu Instagram, é necessário ter uma conta profissional vinculada a uma página do Facebook. Leva menos de 2 minutos.",
        },
        { status: 400 }
      )
    }

    // ── Step 3: For each page, find linked Instagram Business Account ─────────
    const saved: string[] = []

    for (const page of pages) {
      console.log(`[instagram/process] Step 3 — verificando page ${page.id} (${page.name})`)

      const igRes = await fetch(
        `${GRAPH}/${page.id}?fields=instagram_business_account&access_token=${page.access_token || userAccessToken}`
      )
      const igData = await igRes.json()
      console.log(`[instagram/process] Page ${page.id} IG resposta:`, JSON.stringify(igData))

      const igAccount = igData.instagram_business_account
      if (!igAccount?.id) {
        console.log(`[instagram/process] Page ${page.id} não tem Instagram Business vinculado`)
        continue
      }

      const igId = igAccount.id

      // ── Step 4: Fetch Instagram Business Account details ──────────────────
      console.log(`[instagram/process] Step 4 — buscando detalhes da conta IG ${igId}`)
      const igDetailRes = await fetch(
        `${GRAPH}/${igId}?fields=id,name,username,profile_picture_url&access_token=${page.access_token || userAccessToken}`
      )
      const igDetail = await igDetailRes.json()
      console.log(`[instagram/process] IG ${igId} detalhes:`, JSON.stringify(igDetail))

      const accountName     = igDetail.name     || igDetail.username || page.name
      const accountUsername = igDetail.username || null
      const profilePicture  = igDetail.profile_picture_url || null
      // Use Page Access Token for publishing — it has the required permissions
      const accessToken     = page.access_token || userAccessToken

      // ── Step 5: Save to database ──────────────────────────────────────────
      await sql`
        INSERT INTO social_accounts
          (workspace_id, platform, account_id, page_id, account_name, account_username,
           profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
        VALUES
          (${workspaceId}, 'instagram', ${igId}, ${page.id}, ${accountName},
           ${accountUsername}, ${profilePicture}, ${accessToken},
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

      saved.push(`@${accountUsername || accountName}`)
      console.log(`[instagram/process] Conta salva: @${accountUsername || accountName}`)
    }

    if (saved.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma conta Instagram Business foi encontrada vinculada às suas páginas. Para conectar seu Instagram, é necessário ter uma conta profissional vinculada a uma página do Facebook. Leva menos de 2 minutos.",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, saved: saved.length, accounts: saved })
  } catch (err: any) {
    console.error("[instagram/process] Erro inesperado:", err)
    return NextResponse.json(
      { error: "Ocorreu um erro inesperado. Tente novamente." },
      { status: 500 }
    )
  }
}
