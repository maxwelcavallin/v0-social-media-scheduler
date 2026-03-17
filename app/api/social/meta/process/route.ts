import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH_API = "https://graph.facebook.com/v22.0"

// Insert or update a social account
async function upsertAccount(fields: {
  workspaceId: string
  platform: string
  accountName: string
  accountUsername: string | null
  accountId: string
  pageId: string | null
  accessToken: string
  profilePictureUrl: string | null
}) {
  await sql`
    INSERT INTO social_accounts (
      workspace_id, platform, account_name, account_username, account_id, page_id,
      access_token, profile_picture_url, is_active, created_at, updated_at, last_sync_at
    )
    VALUES (
      ${fields.workspaceId}, ${fields.platform}, ${fields.accountName},
      ${fields.accountUsername}, ${fields.accountId}, ${fields.pageId},
      ${fields.accessToken}, ${fields.profilePictureUrl},
      true, NOW(), NOW(), NOW()
    )
    ON CONFLICT (workspace_id, platform, account_id) DO UPDATE SET
      access_token        = EXCLUDED.access_token,
      account_name        = EXCLUDED.account_name,
      account_username    = EXCLUDED.account_username,
      profile_picture_url = EXCLUDED.profile_picture_url,
      page_id             = EXCLUDED.page_id,
      is_active           = true,
      updated_at          = NOW(),
      last_sync_at        = NOW()
  `
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 })
  }

  const body = await request.json()
  const { code, workspaceId } = body

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const redirectUri = `${protocol}://${host}/api/social/meta/callback`

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
        { error: `Erro ao trocar código: ${tokenData.error.message} [${tokenData.error.code}]` },
        { status: 400 }
      )
    }

    const shortToken = tokenData.access_token

    // Step 2: Exchange for long-lived user token (60 days)
    const longRes = await fetch(
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
    )
    const longData = await longRes.json()
    const userToken = longData.access_token || shortToken

    // Step 3: Try /me/accounts first (pages linked to personal profile)
    const pages: any[] = []

    const accountsRes = await fetch(
      `${GRAPH_API}/me/accounts?access_token=${userToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
    )
    const accountsData = await accountsRes.json()

    if (accountsData.data && accountsData.data.length > 0) {
      pages.push(...accountsData.data)
    }

    // Step 4: If still empty, try Business Manager — two separate calls required
    if (pages.length === 0) {
      // 4a: List businesses (no nested fields — Graph API does not support nesting here)
      const bizRes = await fetch(
        `${GRAPH_API}/me/businesses?access_token=${userToken}&limit=10&fields=id,name`
      )
      const bizData = await bizRes.json()

      if (bizData.data && bizData.data.length > 0) {
        for (const biz of bizData.data) {
          // 4b: For each business, fetch owned pages with IG account
          const ownedRes = await fetch(
            `${GRAPH_API}/${biz.id}/owned_pages?access_token=${userToken}&limit=100&fields=id,name,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
          )
          const ownedData = await ownedRes.json()

          if (ownedData.data && ownedData.data.length > 0) {
            for (const p of ownedData.data) {
              // 4c: Fetch Page Access Token explicitly for each page
              const pageTokenRes = await fetch(
                `${GRAPH_API}/${p.id}?fields=access_token&access_token=${userToken}`
              )
              const pageTokenData = await pageTokenRes.json()
              pages.push({
                ...p,
                access_token: pageTokenData.access_token || userToken,
              })
            }
          }

          // 4d: Also check client pages (pages managed on behalf of clients)
          const clientRes = await fetch(
            `${GRAPH_API}/${biz.id}/client_pages?access_token=${userToken}&limit=100&fields=id,name,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
          )
          const clientData = await clientRes.json()

          if (clientData.data && clientData.data.length > 0) {
            for (const p of clientData.data) {
              const pageTokenRes = await fetch(
                `${GRAPH_API}/${p.id}?fields=access_token&access_token=${userToken}`
              )
              const pageTokenData = await pageTokenRes.json()
              pages.push({
                ...p,
                access_token: pageTokenData.access_token || userToken,
              })
            }
          }
        }
      }
    }

    // Step 5: If still empty, show debug info
    if (pages.length === 0) {
      const meRes = await fetch(`${GRAPH_API}/me?fields=id,name&access_token=${userToken}`)
      const meData = await meRes.json()
      const permRes = await fetch(`${GRAPH_API}/me/permissions?access_token=${userToken}`)
      const permData = await permRes.json()
      const grantedPerms = permData.data
        ?.filter((p: any) => p.status === "granted")
        .map((p: any) => p.permission)
        .join(", ")

      return NextResponse.json({
        error: `Nenhuma Página encontrada. Usuário: ${meData.name} (${meData.id}). Permissões concedidas: ${grantedPerms || "nenhuma"}. Se suas páginas estão no Business Manager, certifique-se de que o app tem acesso à sua Business.`,
      }, { status: 400 })
    }

    // Step 6: Save pages and linked Instagram accounts
    const saved: { platform: string; name: string }[] = []

    for (const page of pages) {
      const pageToken = page.access_token || userToken

      await upsertAccount({
        workspaceId,
        platform: "facebook",
        accountName: page.name,
        accountUsername: null,
        accountId: page.id,
        pageId: page.id,
        accessToken: pageToken,
        profilePictureUrl: page.picture?.url ?? null,
      })
      saved.push({ platform: "facebook", name: page.name })

      // Save linked Instagram Business Account
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account
        // Fetch full IG profile details
        const igRes = await fetch(
          `${GRAPH_API}/${ig.id}?fields=id,name,username,profile_picture_url&access_token=${pageToken}`
        )
        const igData = await igRes.json()

        if (!igData.error) {
          await upsertAccount({
            workspaceId,
            platform: "instagram",
            accountName: igData.name || igData.username || "Instagram",
            accountUsername: igData.username ?? null,
            accountId: igData.id,
            pageId: page.id,
            accessToken: pageToken,
            profilePictureUrl: igData.profile_picture_url ?? null,
          })
          saved.push({ platform: "instagram", name: igData.username || igData.name })
        }
      }
    }

    return NextResponse.json({ success: true, saved, count: saved.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
