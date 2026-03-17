import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH = "https://graph.facebook.com/v18.0"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, workspaceId } = await request.json()

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  const appId     = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "FACEBOOK_APP_ID ou FACEBOOK_APP_SECRET não configurados." },
      { status: 500 }
    )
  }

  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const redirectUri = `${protocol}://${host}/api/social/instagram/callback`

  try {
    // ── Step 1: Exchange code for Facebook User Access Token ──────────────────
    console.log("[instagram/process] Step 1 — trocando código por User Access Token do Facebook")
    console.log("[instagram/process] redirect_uri:", redirectUri)

    const tokenParams = new URLSearchParams({
      client_id:     appId,
      client_secret: appSecret,
      redirect_uri:  redirectUri,
      code,
    })

    const tokenRes  = await fetch(`${GRAPH}/oauth/access_token?${tokenParams.toString()}`)
    const tokenData = await tokenRes.json()
    console.log("[instagram/process] Step 1 status:", tokenRes.status)
    console.log("[instagram/process] Step 1 resposta:", JSON.stringify(tokenData))

    if (!tokenRes.ok || tokenData.error) {
      return NextResponse.json(
        { error: `Erro ao trocar código: ${tokenData.error?.message} [código ${tokenData.error?.code}]` },
        { status: 400 }
      )
    }

    const userAccessToken = tokenData.access_token
    if (!userAccessToken) {
      return NextResponse.json({ error: "access_token ausente na resposta do Step 1." }, { status: 400 })
    }

    // ── Step 2: Get Pages managed by this user ────────────────────────────────
    console.log("[instagram/process] Step 2 — buscando Pages do usuário")
    const pagesRes  = await fetch(`${GRAPH}/me/accounts?access_token=${userAccessToken}`)
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
    if (pages.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma Página do Facebook encontrada. Você precisa ser administrador de uma Página para conectar o Instagram Business." },
        { status: 400 }
      )
    }

    // ── Step 3: For each Page, find linked Instagram Business Account ─────────
    console.log("[instagram/process] Step 3 — buscando conta Instagram vinculada às Pages")
    const savedAccounts: string[] = []

    for (const page of pages) {
      const pageId          = page.id
      const pageAccessToken = page.access_token // Page token is used for publishing

      console.log(`[instagram/process] Verificando Page ${pageId} (${page.name})`)

      const igRes  = await fetch(
        `${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
      )
      const igData = await igRes.json()
      console.log(`[instagram/process] Page ${pageId} IG resposta:`, JSON.stringify(igData))

      const igAccount = igData.instagram_business_account
      if (!igAccount?.id) {
        console.log(`[instagram/process] Page ${pageId} não tem Instagram Business vinculado, pulando.`)
        continue
      }

      const igAccountId = igAccount.id

      // ── Step 4: Fetch Instagram account details ───────────────────────────
      const detailRes  = await fetch(
        `${GRAPH}/${igAccountId}?fields=id,name,username,profile_picture_url&access_token=${pageAccessToken}`
      )
      const detailData = await detailRes.json()
      console.log(`[instagram/process] IG ${igAccountId} detalhes:`, JSON.stringify(detailData))

      const accountName     = detailData.name     || detailData.username || `Instagram ${igAccountId}`
      const accountUsername = detailData.username || null
      const profilePicture  = detailData.profile_picture_url || null

      // Save using the PAGE ACCESS TOKEN — required for publishing via Graph API
      await sql`
        INSERT INTO social_accounts
          (workspace_id, platform, account_id, page_id, account_name, account_username,
           profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
        VALUES
          (${workspaceId}, 'instagram', ${igAccountId}, ${pageId}, ${accountName},
           ${accountUsername}, ${profilePicture}, ${pageAccessToken},
           true, NOW(), NOW(), NOW())
        ON CONFLICT (platform, account_id)
        DO UPDATE SET
          account_name        = EXCLUDED.account_name,
          account_username    = EXCLUDED.account_username,
          profile_picture_url = EXCLUDED.profile_picture_url,
          access_token        = EXCLUDED.access_token,
          page_id             = EXCLUDED.page_id,
          workspace_id        = EXCLUDED.workspace_id,
          is_active           = true,
          last_sync_at        = NOW(),
          updated_at          = NOW()
      `

      savedAccounts.push(`@${accountUsername || accountName}`)
      console.log(`[instagram/process] Conta salva: @${accountUsername || accountName} (ig_id: ${igAccountId})`)
    }

    if (savedAccounts.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma conta Instagram Business foi encontrada vinculada às suas Páginas do Facebook. Certifique-se de que sua conta Instagram está configurada como Business ou Creator e vinculada a uma Página." },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, saved: savedAccounts.length, accounts: savedAccounts })

  } catch (err: any) {
    console.error("[instagram/process] Erro inesperado:", err)
    return NextResponse.json({ error: err.message || "Erro interno." }, { status: 500 })
  }
}
