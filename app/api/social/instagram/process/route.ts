import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH = "https://graph.facebook.com/v22.0"

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
    return NextResponse.json({ error: "Configuração interna ausente." }, { status: 500 })
  }

  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const redirectUri = `${protocol}://${host}/api/social/instagram/callback`

  try {
    // Step 1: Trocar código por User Access Token
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error) {
      return NextResponse.json(
        { error: "Não foi possível autenticar. Tente novamente." },
        { status: 400 }
      )
    }

    const userToken = tokenData.access_token
    if (!userToken) {
      return NextResponse.json({ error: "Token de acesso não recebido." }, { status: 400 })
    }

    // Step 2: Trocar por Long-Lived User Token (60 dias)
    const llRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`
    )
    const llData = await llRes.json()
    const longUserToken = llData.access_token || userToken

    // Step 3: Buscar páginas do usuário via /me/accounts
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?access_token=${longUserToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
    )
    const pagesData = await pagesRes.json()
    const pages: any[] = pagesData.data || []

    // Step 4: Para cada página, buscar Page Token longa duração e salvar conta IG vinculada
    const saved: string[] = []

    for (const page of pages) {
      const ig = page.instagram_business_account
      if (!ig?.id) continue // página sem Instagram Business vinculado — ignorar

      // Buscar Page Access Token longa duração
      const ptRes = await fetch(`${GRAPH}/${page.id}?fields=access_token&access_token=${longUserToken}`)
      const ptData = await ptRes.json()
      const pageToken = ptData.access_token || page.access_token || longUserToken

      const accountId = ig.id
      const accountName = ig.name || page.name
      const accountUsername = ig.username || null
      const profilePicture = ig.profile_picture_url || page.picture?.data?.url || null

      await sql`
        INSERT INTO social_accounts
          (workspace_id, platform, account_id, page_id, account_name, account_username,
           profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
        VALUES
          (${workspaceId}, 'instagram', ${accountId}, ${page.id}, ${accountName},
           ${accountUsername}, ${profilePicture}, ${pageToken},
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
    }

    if (saved.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma conta profissional do Instagram encontrada. Para conectar seu Instagram, é necessário ter uma conta profissional vinculada a uma página do Facebook. Leva menos de 2 minutos.",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, saved: saved.length, accounts: saved })
  } catch (err: any) {
    return NextResponse.json(
      { error: "Ocorreu um erro inesperado. Tente novamente em instantes." },
      { status: 500 }
    )
  }
}
