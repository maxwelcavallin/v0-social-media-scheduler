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

  console.log("[v0] meta/process: iniciando. workspaceId:", workspaceId, "redirectUri:", redirectUri)

  try {
    // Step 1: Exchange code for short-lived token
    const tokenUrl = `${GRAPH_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    console.log("[v0] meta/process step1: trocando code. redirect_uri:", redirectUri)
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()
    console.log("[v0] meta/process step1 status:", tokenRes.status, "error:", tokenData.error ? JSON.stringify(tokenData.error) : "none")

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
    console.log("[v0] meta/process step2 long-lived:", longRes.status, "error:", longData.error ? JSON.stringify(longData.error) : "none")
    const userToken = longData.access_token || shortToken

    // Step 3: Try /me/accounts first (pages linked to personal profile)
    const pages: any[] = []

    const accountsRes = await fetch(
      `${GRAPH_API}/me/accounts?access_token=${userToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
    )
    const accountsData = await accountsRes.json()
    console.log("[v0] meta/process step3 /me/accounts:", accountsRes.status, "pages found:", accountsData.data?.length ?? 0, "error:", accountsData.error ? JSON.stringify(accountsData.error) : "none")

    if (accountsData.data && accountsData.data.length > 0) {
      pages.push(...accountsData.data)
    }

    // Buscar user_id real para usar como fallback
    const meRes = await fetch(`${GRAPH_API}/me?fields=id,name&access_token=${userToken}`)
    const meData = await meRes.json()
    const userId = meData.id
    console.log("[v0] meta/process: userId:", userId, "name:", meData.name)

    // Step 4: Fallback A — user_id/accounts (mesmo que /me/accounts mas com ID explícito)
    if (pages.length === 0 && userId) {
      console.log("[v0] meta/process step4A: tentando /{userId}/accounts")
      try {
        const userAccountsRes = await fetch(
          `${GRAPH_API}/${userId}/accounts?access_token=${userToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
        )
        const userAccountsData = await userAccountsRes.json()
        console.log("[v0] meta/process step4A /{userId}/accounts:", userAccountsRes.status, "count:", userAccountsData.data?.length ?? 0, "error:", userAccountsData.error ? JSON.stringify(userAccountsData.error) : "none")
        if (userAccountsData.data?.length > 0) pages.push(...userAccountsData.data)
      } catch (e) {
        console.log("[v0] meta/process step4A erro:", e instanceof Error ? e.message : e)
      }
    }

    // Step 4B: Business Manager — owned_pages, client_pages, user_owned_pages
    if (pages.length === 0) {
      console.log("[v0] meta/process step4B: tentando Business Manager")
      try {
        const bizRes = await fetch(`${GRAPH_API}/me/businesses?access_token=${userToken}&limit=25`)
        const bizData = await bizRes.json()
        console.log("[v0] meta/process step4B /me/businesses:", bizRes.status, "count:", bizData.data?.length ?? 0, "error:", bizData.error ? JSON.stringify(bizData.error) : "none")

        if (bizData.data && bizData.data.length > 0) {
          for (const biz of bizData.data) {
            // owned_pages
            const ownedRes = await fetch(
              `${GRAPH_API}/${biz.id}/owned_pages?access_token=${userToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
            )
            const ownedData = await ownedRes.json()
            console.log("[v0] meta/process step4B owned_pages biz", biz.id, ":", ownedData.data?.length ?? 0, "error:", ownedData.error ? JSON.stringify(ownedData.error) : "none")
            if (ownedData.data?.length > 0) pages.push(...ownedData.data)

            // client_pages
            const clientRes = await fetch(
              `${GRAPH_API}/${biz.id}/client_pages?access_token=${userToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
            )
            const clientData = await clientRes.json()
            console.log("[v0] meta/process step4B client_pages biz", biz.id, ":", clientData.data?.length ?? 0, "error:", clientData.error ? JSON.stringify(clientData.error) : "none")
            if (clientData.data?.length > 0) pages.push(...clientData.data)

            // user_owned_pages (páginas que o usuário possui dentro do BM)
            if (userId) {
              const uopRes = await fetch(
                `${GRAPH_API}/${biz.id}/user_owned_pages?user_id=${userId}&access_token=${userToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
              )
              const uopData = await uopRes.json()
              console.log("[v0] meta/process step4B user_owned_pages biz", biz.id, ":", uopData.data?.length ?? 0, "error:", uopData.error ? JSON.stringify(uopData.error) : "none")
              if (uopData.data?.length > 0) pages.push(...uopData.data)
            }
          }
        }
      } catch (e) {
        console.log("[v0] meta/process step4B erro:", e instanceof Error ? e.message : e)
      }
    }

    // Step 4C: Último fallback — buscar páginas via app token (app-level token)
    if (pages.length === 0) {
      console.log("[v0] meta/process step4C: tentando app token para listar páginas do usuário")
      try {
        const appToken = `${appId}|${appSecret}`
        const appPagesRes = await fetch(
          `${GRAPH_API}/${userId}/accounts?access_token=${appToken}&limit=100&fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}`
        )
        const appPagesData = await appPagesRes.json()
        console.log("[v0] meta/process step4C app token pages:", appPagesRes.status, "count:", appPagesData.data?.length ?? 0, "error:", appPagesData.error ? JSON.stringify(appPagesData.error) : "none")
        if (appPagesData.data?.length > 0) pages.push(...appPagesData.data)
      } catch (e) {
        console.log("[v0] meta/process step4C erro:", e instanceof Error ? e.message : e)
      }
    }

    // Step 5: Se ainda vazio, retornar erro informativo com diagnóstico
    if (pages.length === 0) {
      return NextResponse.json({
        error: `Nenhuma Página do Facebook encontrada para o usuário ${meData.name} (ID: ${userId}). Certifique-se de que você é administrador de pelo menos uma Página do Facebook e que concedeu todas as permissões solicitadas.`,
      }, { status: 400 })
    }

    // Step 6: Save pages and linked Instagram accounts
    console.log("[v0] meta/process step6: salvando", pages.length, "páginas")
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
