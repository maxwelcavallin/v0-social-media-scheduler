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
  const { code, workspaceId, redirectUri: bodyRedirectUri } = body

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  // Usar o redirectUri que veio do body (passado pelo connecting page a partir do callback)
  // para garantir que seja idêntico ao que foi enviado ao Facebook no authorize
  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const redirectUri = bodyRedirectUri || `${protocol}://${host}/api/social/meta/callback`

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
    console.log("[v0] meta/process user:", JSON.stringify(meData))
    console.log("[v0] meta/process perms:", JSON.stringify(grantedPerms))

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

    // Step 4: Business Manager — múltiplos endpoints
    if (pages.length === 0) {
      const bizRes = await fetch(`${GRAPH_API}/me/businesses?access_token=${userToken}&limit=25`)
      const bizData = await bizRes.json()
      console.log("[v0] meta/process step4 /me/businesses status:", bizRes.status, "count:", bizData.data?.length ?? 0, "error:", bizData.error ? JSON.stringify(bizData.error) : "none")

      const pageFields = "id,name,picture{url},instagram_business_account{id,name,username,profile_picture_url}"

      if (bizData.data && bizData.data.length > 0) {
        for (const biz of bizData.data) {
          console.log("[v0] meta/process step4 processando biz:", biz.id, biz.name)

          // 4A: /{biz}/owned_pages (endpoint dedicado, não nested)
          const ownedRes = await fetch(
            `${GRAPH_API}/${biz.id}/owned_pages?access_token=${userToken}&limit=100&fields=${pageFields}`
          )
          const ownedData = await ownedRes.json()
          console.log("[v0] meta/process step4A owned_pages:", ownedData.data?.length ?? 0, "error:", ownedData.error ? JSON.stringify(ownedData.error) : "none")
          if (ownedData.data?.length > 0) pages.push(...ownedData.data)

          // 4B: /{biz}/client_pages
          const clientRes = await fetch(
            `${GRAPH_API}/${biz.id}/client_pages?access_token=${userToken}&limit=100&fields=${pageFields}`
          )
          const clientData = await clientRes.json()
          console.log("[v0] meta/process step4B client_pages:", clientData.data?.length ?? 0, "error:", clientData.error ? JSON.stringify(clientData.error) : "none")
          if (clientData.data?.length > 0) pages.push(...clientData.data)

          // 4C: /{biz}/pages (lista TODAS as páginas do negócio)
          const bizPagesRes = await fetch(
            `${GRAPH_API}/${biz.id}/pages?access_token=${userToken}&limit=100&fields=${pageFields}`
          )
          const bizPagesData = await bizPagesRes.json()
          console.log("[v0] meta/process step4C /{biz}/pages:", bizPagesData.data?.length ?? 0, "error:", bizPagesData.error ? JSON.stringify(bizPagesData.error) : "none")
          if (bizPagesData.data?.length > 0) pages.push(...bizPagesData.data)

          // 4D: /{biz}/user_owned_pages?user_id=
          const uopRes = await fetch(
            `${GRAPH_API}/${biz.id}/user_owned_pages?user_id=${meData.id}&access_token=${userToken}&limit=100&fields=${pageFields}`
          )
          const uopData = await uopRes.json()
          console.log("[v0] meta/process step4D user_owned_pages:", uopData.data?.length ?? 0, "error:", uopData.error ? JSON.stringify(uopData.error) : "none")
          if (uopData.data?.length > 0) pages.push(...uopData.data)
        }
      }

      // 4E: app token fallback — buscar páginas via token de aplicativo
      if (pages.length === 0) {
        const appToken = `${appId}|${appSecret}`
        const appPagesRes = await fetch(
          `${GRAPH_API}/${meData.id}/accounts?access_token=${appToken}&limit=100&fields=${pageFields}`
        )
        const appPagesData = await appPagesRes.json()
        console.log("[v0] meta/process step4E app-token /accounts:", appPagesData.data?.length ?? 0, "error:", appPagesData.error ? JSON.stringify(appPagesData.error) : "none")
        if (appPagesData.data?.length > 0) pages.push(...appPagesData.data)
      }
    }

    // Deduplicar páginas por ID
    const seenIds = new Set<string>()
    const uniquePages = pages.filter(p => {
      if (seenIds.has(p.id)) return false
      seenIds.add(p.id)
      return true
    })
    pages.length = 0
    pages.push(...uniquePages)
    console.log("[v0] meta/process total páginas únicas:", pages.length)

    // Step 5: Se ainda vazio, retornar diagnóstico detalhado
    if (pages.length === 0) {
      const diagnosis = `Nenhuma Página encontrada. Usuário: ${meData.name} (${meData.id}). Permissões: ${grantedPerms?.join(", ")}. redirectUri usado: ${redirectUri}`
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
