import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { checkSocialAccountLimit } from "@/lib/plans"
import { getAppUrl } from "@/lib/app-url"

const GRAPH_API = "https://graph.facebook.com/v22.0"

// Valida se um Page Access Token é realmente um page token funcional.
// Um page token legítimo responde a /me com o id da página. Tokens degradados
// (ex: obtidos via Business Manager sem permissões de página concedidas)
// falham com erro 190 "impersonating a user's page" — esses NÃO devem ser salvos,
// pois causam falha em toda publicação (feed, reel, story).
async function isValidPageToken(pageId: string, pageToken: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const res = await fetch(`${GRAPH_API}/me?fields=id,name&access_token=${pageToken}`)
    const data = await res.json()
    if (data.error) {
      return { valid: false, reason: `${data.error.message} [${data.error.code}]` }
    }
    // O /me de um page token deve retornar o próprio id da página
    if (data.id && data.id !== pageId) {
      return { valid: false, reason: `token não corresponde à página (esperado ${pageId}, recebido ${data.id})` }
    }
    return { valid: true }
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : "erro de rede" }
  }
}

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
      needs_reconnect     = false,
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

  // Verificar limite de contas sociais do plano
  const accountLimit = await checkSocialAccountLimit(session.user.id, workspaceId)
  if (!accountLimit.allowed) {
    return NextResponse.json(
      { error: `Seu plano gratuito permite apenas ${accountLimit.limit} contas sociais. Faça upgrade para o Pro para contas ilimitadas.`, upgrade: true },
      { status: 403 }
    )
  }

  // Usa o redirectUri enviado pelo cliente (passado pelo callback), que é idêntico
  // ao que foi enviado ao Facebook no momento da autorização — obrigatório para validação.
  // Fallback para reconstrução a partir do host apenas se não vier no body.
  const redirectUri = bodyRedirectUri || `${getAppUrl(request)}/api/social/meta/callback`

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

    // Buscar user_id e permissões concedidas para diagnóstico
    const meRes = await fetch(`${GRAPH_API}/me?fields=id,name&access_token=${userToken}`)
    const meData = await meRes.json()
    const userId = meData.id
    console.log("[v0] meta/process: userId:", userId, "name:", meData.name)

    // Verificar quais permissões foram realmente concedidas pelo usuário
    const permsRes = await fetch(`${GRAPH_API}/me/permissions?access_token=${userToken}`)
    const permsData = await permsRes.json()
    const grantedPerms = permsData.data?.filter((p: any) => p.status === "granted").map((p: any) => p.permission)
    console.log("[v0] meta/process permissões concedidas:", JSON.stringify(grantedPerms))

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

    // Step 4B: Business Manager — owned_pages, client_pages + page token via /{page_id}
    if (pages.length === 0) {
      console.log("[v0] meta/process step4B: tentando Business Manager")
      try {
        const bizRes = await fetch(`${GRAPH_API}/me/businesses?access_token=${userToken}&limit=25`)
        const bizData = await bizRes.json()
        console.log("[v0] meta/process step4B /me/businesses:", bizRes.status, "count:", bizData.data?.length ?? 0, "error:", bizData.error ? JSON.stringify(bizData.error) : "none")

        if (bizData.data && bizData.data.length > 0) {
          for (const biz of bizData.data) {
            const pageFields = "id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}"

            // /{biz}/pages — lista TODAS as páginas conectadas ao negócio
            const bizPagesRes = await fetch(
              `${GRAPH_API}/${biz.id}/pages?access_token=${userToken}&limit=100&fields=${pageFields}`
            )
            const bizPagesData = await bizPagesRes.json()
            console.log("[v0] meta/process step4B /{biz}/pages biz", biz.id, ":", bizPagesData.data?.length ?? 0, "error:", bizPagesData.error ? JSON.stringify(bizPagesData.error) : "none")
            if (bizPagesData.data?.length > 0) pages.push(...bizPagesData.data)

            // owned_pages
            const ownedRes = await fetch(
              `${GRAPH_API}/${biz.id}/owned_pages?access_token=${userToken}&limit=100&fields=${pageFields}`
            )
            const ownedData = await ownedRes.json()
            console.log("[v0] meta/process step4B owned_pages biz", biz.id, ":", ownedData.data?.length ?? 0, "error:", ownedData.error ? JSON.stringify(ownedData.error) : "none")
            if (ownedData.data?.length > 0) pages.push(...ownedData.data)

            // client_pages
            const clientRes = await fetch(
              `${GRAPH_API}/${biz.id}/client_pages?access_token=${userToken}&limit=100&fields=${pageFields}`
            )
            const clientData = await clientRes.json()
            console.log("[v0] meta/process step4B client_pages biz", biz.id, ":", clientData.data?.length ?? 0, "error:", clientData.error ? JSON.stringify(clientData.error) : "none")
            if (clientData.data?.length > 0) pages.push(...clientData.data)

            // Para usuários do BM que não têm page token via /me/accounts,
            // buscar o page token diretamente via /{page_id}?fields=access_token
            // Isso funciona quando o usuário tem acesso via Business Manager mesmo sem ser admin pessoal da página.
            const pagesWithoutToken = pages.filter((p: any) => !p.access_token)
            for (const page of pagesWithoutToken) {
              console.log("[v0] meta/process step4B: buscando page token para página BM", page.id)
              try {
                const ptRes = await fetch(
                  `${GRAPH_API}/${page.id}?fields=access_token,instagram_business_account{id,name,username,profile_picture_url}&access_token=${userToken}`
                )
                const ptData = await ptRes.json()
                console.log("[v0] meta/process step4B page token para", page.id, ":", !!ptData.access_token, "error:", ptData.error ? JSON.stringify(ptData.error) : "none")
                if (ptData.access_token) {
                  page.access_token = ptData.access_token
                  if (ptData.instagram_business_account) {
                    page.instagram_business_account = ptData.instagram_business_account
                  }
                }
              } catch (e) {
                console.log("[v0] meta/process step4B page token error:", e instanceof Error ? e.message : e)
              }
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
    const rejected: { name: string; reason: string }[] = [] // páginas com token inválido
    const reconnectedAccountIds: string[] = [] // IDs das contas atualizadas para reatender posts falhos

    for (const page of pages) {
      // page.access_token é o Page Access Token — obrigatório para publicar no Instagram via Facebook Login.
      // Se vier undefined, significa que o usuário não concedeu as permissões necessárias (pages_show_list / pages_read_engagement).
      // Nunca fazer fallback para o userToken, pois causaria erro 190 ao tentar publicar.
      if (!page.access_token) {
        console.warn("[v0] meta/process: página", page.id, page.name, "sem page token — pulando")
        rejected.push({ name: page.name, reason: "sem page token (permissões não concedidas)" })
        continue
      }
      const pageToken = page.access_token

      // VALIDAÇÃO CRÍTICA: confirmar que o page token funciona ANTES de salvar.
      // Tokens degradados (sem permissões de página efetivamente concedidas) passam
      // pela verificação de existência mas falham em toda publicação com erro 190.
      const validation = await isValidPageToken(page.id, pageToken)
      if (!validation.valid) {
        console.warn("[v0] meta/process: página", page.id, page.name, "token INVÁLIDO — pulando. Motivo:", validation.reason)
        rejected.push({ name: page.name, reason: validation.reason || "token inválido" })
        continue
      }

      console.log("[v0] meta/process: salvando página", page.name, "pageToken válido. prefix:", pageToken?.substring(0, 8))

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
      reconnectedAccountIds.push(page.id)
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
          reconnectedAccountIds.push(igData.id)
          saved.push({ platform: "instagram", name: igData.username || igData.name })
        }
      }
    }

    // Step 7: Resetar posts agendados que falharam por falta de permissão nas contas
    // recém-reconectadas. Isso permite que o cron os publique na próxima execução.
    if (reconnectedAccountIds.length > 0) {
      // Busca as social_accounts.id (UUIDs) a partir dos account_id externos reconectados
      const reconnectedRows = await sql`
        SELECT id FROM social_accounts
        WHERE account_id = ANY(${reconnectedAccountIds}::text[])
          AND workspace_id = ${workspaceId}
      `
      const reconnectedUuids = reconnectedRows.map((r: any) => r.id)

      if (reconnectedUuids.length > 0) {
        // Reseta para 'pending' apenas os targets que falharam por erro de permissão (190)
        await sql`
          UPDATE post_targets
          SET status = 'pending', error_message = NULL
          WHERE social_account_id = ANY(${reconnectedUuids}::uuid[])
            AND status = 'failed'
            AND (
              error_message ILIKE '%impersonating a user%'
              OR error_message ILIKE '%pages_read_engagement%'
              OR error_message ILIKE '%[190]%'
            )
        `

        // Reseta a fila dos posts que agora têm todos os targets pendentes novamente
        await sql`
          UPDATE post_queue pq
          SET status = 'pending', attempts = 0, last_error = NULL, updated_at = NOW()
          WHERE pq.status = 'failed'
            AND EXISTS (
              SELECT 1 FROM post_targets pt
              WHERE pt.post_id = pq.post_id AND pt.status = 'pending'
            )
            AND NOT EXISTS (
              SELECT 1 FROM post_targets pt
              WHERE pt.post_id = pq.post_id AND pt.status = 'failed'
            )
        `

        // Reseta o status do post também
        await sql`
          UPDATE posts p
          SET status = 'scheduled', error_message = NULL, updated_at = NOW()
          WHERE p.status = 'failed'
            AND EXISTS (
              SELECT 1 FROM post_queue pq2
              WHERE pq2.post_id = p.id AND pq2.status = 'pending'
            )
        `

        console.log("[v0] meta/process: resetados targets e fila para accounts reconectadas:", reconnectedUuids.length)
      }
    }

    // Se nenhuma página foi salva mas algumas foram rejeitadas por token inválido,
    // informa o usuário com o motivo exato para que ele possa corrigir as permissões.
    if (saved.length === 0 && rejected.length > 0) {
      const detalhes = rejected.map((r) => `${r.name}: ${r.reason}`).join("; ")
      return NextResponse.json({
        error: `Não foi possível conectar as páginas pois o token retornado pelo Facebook não tem as permissões de página efetivas. Ao reconectar, na tela do Facebook clique em "Editar acesso" e MARQUE TODAS as páginas e permissões solicitadas. Detalhes: ${detalhes}`,
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      saved,
      count: saved.length,
      ...(rejected.length > 0 ? { rejected, warning: `${rejected.length} página(s) ignorada(s) por token inválido — verifique as permissões.` } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
