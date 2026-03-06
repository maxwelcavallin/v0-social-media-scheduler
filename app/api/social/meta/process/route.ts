import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH_API = "https://graph.facebook.com/v22.0"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 })
  }

  const body = await request.json()
  const { code, workspaceId, redirectUri } = body

  if (!code || !workspaceId || !redirectUri) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Configuração do app Facebook ausente." }, { status: 500 })
  }

  try {
    // Step 1: Exchange code for short-lived token
    const tokenRes = await fetch(
      `${GRAPH_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      return NextResponse.json(
        { error: `Erro ao trocar código: ${tokenData.error.message}` },
        { status: 400 }
      )
    }

    const shortToken = tokenData.access_token

    // Step 2: Exchange for long-lived token (60 days)
    const longLivedRes = await fetch(
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
    )
    const longLivedData = await longLivedRes.json()
    const userToken = longLivedData.access_token || shortToken

    // Step 3: Fetch pages with instagram info
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?access_token=${userToken}&fields=id,name,access_token,picture,instagram_business_account{id,name,username,profile_picture_url}`
    )
    const pagesData = await pagesRes.json()

    if (pagesData.error) {
      return NextResponse.json(
        { error: `Erro ao buscar páginas: ${pagesData.error.message}` },
        { status: 400 }
      )
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma Página do Facebook encontrada. Verifique se você tem páginas na sua conta." },
        { status: 400 }
      )
    }

    const saved: { platform: string; name: string }[] = []

    for (const page of pagesData.data) {
      const pageToken = page.access_token

      // Save Facebook Page
      await sql`
        INSERT INTO social_accounts (
          workspace_id, platform, account_name, account_id, page_id,
          access_token, profile_picture_url, is_active, created_at, updated_at, last_sync_at
        )
        VALUES (
          ${workspaceId}, 'facebook', ${page.name},
          ${page.id}, ${page.id}, ${pageToken},
          ${page.picture?.data?.url ?? null}, true, NOW(), NOW(), NOW()
        )
        ON CONFLICT (platform, account_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          account_name = EXCLUDED.account_name,
          workspace_id = EXCLUDED.workspace_id,
          profile_picture_url = EXCLUDED.profile_picture_url,
          is_active = true,
          updated_at = NOW(),
          last_sync_at = NOW()
      `
      saved.push({ platform: "facebook", name: page.name })

      // Save Instagram if connected
      if (page.instagram_business_account) {
        const igAccount = page.instagram_business_account

        const igDetailsRes = await fetch(
          `${GRAPH_API}/${igAccount.id}?fields=id,name,username,profile_picture_url&access_token=${pageToken}`
        )
        const igDetails = await igDetailsRes.json()

        if (!igDetails.error) {
          await sql`
            INSERT INTO social_accounts (
              workspace_id, platform, account_name, account_username, account_id, page_id,
              access_token, profile_picture_url, is_active, created_at, updated_at, last_sync_at
            )
            VALUES (
              ${workspaceId}, 'instagram',
              ${igDetails.name || igDetails.username || "Instagram"},
              ${igDetails.username ?? null},
              ${igDetails.id}, ${page.id}, ${pageToken},
              ${igDetails.profile_picture_url ?? null}, true, NOW(), NOW(), NOW()
            )
            ON CONFLICT (platform, account_id) DO UPDATE SET
              access_token = EXCLUDED.access_token,
              account_name = EXCLUDED.account_name,
              account_username = EXCLUDED.account_username,
              profile_picture_url = EXCLUDED.profile_picture_url,
              page_id = EXCLUDED.page_id,
              workspace_id = EXCLUDED.workspace_id,
              is_active = true,
              updated_at = NOW(),
              last_sync_at = NOW()
          `
          saved.push({ platform: "instagram", name: igDetails.username || igDetails.name })
        }
      }
    }

    return NextResponse.json({ success: true, saved, count: saved.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
