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
    ON CONFLICT (platform, account_id) DO UPDATE SET
      access_token        = EXCLUDED.access_token,
      account_name        = EXCLUDED.account_name,
      account_username    = EXCLUDED.account_username,
      profile_picture_url = EXCLUDED.profile_picture_url,
      page_id             = EXCLUDED.page_id,
      workspace_id        = EXCLUDED.workspace_id,
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

  console.log("[v0] meta/process: appId:", appId, "redirectUri:", redirectUri, "workspaceId:", workspaceId)

  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Configuração do app Facebook ausente." }, { status: 500 })
  }

  try {
    // Step 1: Exchange code for short-lived token
    const tokenUrl = `${GRAPH_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()
    console.log("[v0] meta/process step1 token exchange status:", tokenRes.status, "error:", tokenData.error ? JSON.stringify(tokenData.error) : "none", "has_token:", !!tokenData.access_token)

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
    console.log("[v0] meta/process step2 long-lived status:", longRes.status, "error:", longData.error ? JSON.stringify(longData.error) : "none")
    const userToken = longData.access_token || shortToken

    // Buscar info do usuário e permissões para diagnóstico
    const [meRes, permRes] = await Promise.all([
      fetch(`${GRAPH_API}/me?fields=id,name&access_token=${userToken}`),
      fetch(`${GRAPH_API}/me/permissions?access_token=${userToken}`)
    ])
    const meData = await meRes.json()
    const permData = await permRes.json()
    const grantedPerms = permData.data?.filter((p: any) => p.status === "granted").map((p: any) => p.permission)
    console.log("[v0] meta/process user:", JSON.stringify(meData), "userId digits:", String(meData.id).length)
    console.log("[v0] meta/process perms:", JSON.stringify(grantedPerms))
    console.log("[v0] meta/process NOTA: ID com 16 dígitos = Instagram-scoped (app errado). ID com ~10-15 dígitos = Facebook user ID (correto)")

    // Step 3: /me/accounts
    const pages: any[] = []
    const accountsRes = await fetch(
      `${GRAPH_API}/me/accounts?access_token=${userToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
    )
    const accountsData = await accountsRes.json()
    console.log("[v0] meta/process step3 /me/accounts status:", accountsRes.status, "pages:", accountsData.data?.length ?? 0, "error:", accountsData.error ? JSON.stringify(accountsData.error) : "none")

    if (accountsData.data && accountsData.data.length > 0) {
      pages.push(...accountsData.data)
    }

    // Step 4: Business Manager
    if (pages.length === 0) {
      const bizRes = await fetch(
        `${GRAPH_API}/me/businesses?access_token=${userToken}&fields=id,name,owned_pages{id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}}`
      )
      const bizData = await bizRes.json()
      console.log("[v0] meta/process step4 /me/businesses status:", bizRes.status, "count:", bizData.data?.length ?? 0, "error:", bizData.error ? JSON.stringify(bizData.error) : "none")

      if (bizData.data && bizData.data.length > 0) {
        for (const biz of bizData.data) {
          console.log("[v0] meta/process step4 biz", biz.id, biz.name, "owned_pages:", biz.owned_pages?.data?.length ?? 0)
          if (biz.owned_pages?.data?.length > 0) {
            for (const p of biz.owned_pages.data) {
              const pageTokenRes = await fetch(
                `${GRAPH_API}/${p.id}?fields=access_token&access_token=${userToken}`
              )
              const pageTokenData = await pageTokenRes.json()
              console.log("[v0] meta/process step4 page", p.id, p.name, "token_ok:", !!pageTokenData.access_token, "error:", pageTokenData.error ? JSON.stringify(pageTokenData.error) : "none")
              pages.push({
                ...p,
                access_token: pageTokenData.access_token || userToken,
              })
            }
          }
        }
      }
    }

    // Step 5: Se ainda vazio, retornar diagnóstico detalhado
    if (pages.length === 0) {
      const userId = String(meData.id)
      const isInstagramScoped = userId.length >= 16
      const diagnosis = isInstagramScoped
        ? `PROBLEMA: O FACEBOOK_APP_ID (${appId}) está gerando tokens Instagram-scoped (user ID tem ${userId.length} dígitos). Este app é um Instagram App, não um Facebook App. Configure FACEBOOK_APP_ID com o ID de um Facebook App separado no Meta for Developers.`
        : `Nenhuma Página encontrada. Usuário: ${meData.name} (${userId}). Permissões: ${grantedPerms?.join(", ")}. Certifique-se de que o app tem acesso às suas páginas.`

      console.log("[v0] meta/process step5 DIAGNÓSTICO:", diagnosis)
      return NextResponse.json({ error: diagnosis }, { status: 400 })
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
