import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { getWorkspaceCompany } from "@/lib/company"
import { checkSocialAccountLimit } from "@/lib/plans"

// GET /api/social/meta/catalog?workspaceId=...
// Lista o POOL GLOBAL da empresa (connected_accounts) — todas as contas já
// conectadas na Visão Geral (páginas do Facebook, Instagram vinculado e
// Instagram direto) — e marca quais já estão vinculadas a este workspace.
// É a fonte do seletor: conecta-se uma vez na empresa e escolhe-se aqui quais
// contas usar em cada workspace, SEM refazer o OAuth.
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get("workspaceId")
  if (!workspaceId) return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 })

  // Confirma que o usuário pertence ao workspace e obtém a empresa dona dele.
  const ctx = await getWorkspaceCompany(session.user.id, workspaceId)
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const [pool, linked] = await Promise.all([
    sql`
      SELECT id, platform, external_id, page_id, name, username, picture_url, source, updated_at
      FROM connected_accounts
      WHERE company_id = ${ctx.companyId}
      ORDER BY platform ASC, name ASC
    `,
    sql`
      SELECT account_id, platform
      FROM social_accounts
      WHERE workspace_id = ${workspaceId}
    `,
  ])

  const linkedKeys = new Set(linked.map((a: any) => `${a.platform}:${a.account_id}`))

  const accounts = pool.map((a: any) => ({
    id: a.id,
    platform: a.platform as "facebook" | "instagram",
    externalId: a.external_id,
    pageId: a.page_id,
    name: a.name,
    username: a.username,
    pictureUrl: a.picture_url,
    source: a.source as "facebook" | "instagram_direct",
    linked: linkedKeys.has(`${a.platform}:${a.external_id}`),
  }))

  return NextResponse.json({ accounts })
}

// POST /api/social/meta/catalog
// body: { workspaceId: string, accountIds: string[] }  (ids de connected_accounts)
// Vincula as contas escolhidas ao workspace, criando as social_accounts a partir
// do pool da empresa — sem refazer o OAuth.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const workspaceId: string | undefined = body?.workspaceId
  const accountIds: string[] = Array.isArray(body?.accountIds) ? body.accountIds : []
  if (!workspaceId) return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 })
  if (accountIds.length === 0) return NextResponse.json({ error: "Selecione ao menos uma conta" }, { status: 400 })

  const ctx = await getWorkspaceCompany(session.user.id, workspaceId)
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const poolAccounts = await sql`
    SELECT id, platform, external_id, page_id, name, username, picture_url,
           access_token, user_access_token, token_expires_at, fb_user_id
    FROM connected_accounts
    WHERE company_id = ${ctx.companyId}
      AND id = ANY(${accountIds}::uuid[])
  `

  let linkedCount = 0
  let limitReached = false
  for (const acc of poolAccounts) {
    // Respeita o limite de contas sociais do plano no momento da seleção.
    const accountLimit = await checkSocialAccountLimit(session.user.id, workspaceId)
    if (!accountLimit.allowed) {
      limitReached = true
      break
    }

    await sql`
      INSERT INTO social_accounts (
        workspace_id, platform, account_name, account_username, account_id, page_id,
        access_token, token_expires_at, profile_picture_url, user_access_token, fb_user_id,
        is_active, needs_reconnect, created_at, updated_at, last_sync_at
      )
      VALUES (
        ${workspaceId}, ${acc.platform}, ${acc.name}, ${acc.username}, ${acc.external_id}, ${acc.page_id},
        ${acc.access_token}, ${acc.token_expires_at}, ${acc.picture_url}, ${acc.user_access_token}, ${acc.fb_user_id},
        true, false, NOW(), NOW(), NOW()
      )
      ON CONFLICT (workspace_id, platform, account_id) DO UPDATE SET
        access_token        = EXCLUDED.access_token,
        account_name        = EXCLUDED.account_name,
        account_username    = EXCLUDED.account_username,
        page_id             = EXCLUDED.page_id,
        token_expires_at    = EXCLUDED.token_expires_at,
        user_access_token   = EXCLUDED.user_access_token,
        fb_user_id          = EXCLUDED.fb_user_id,
        profile_picture_url = EXCLUDED.profile_picture_url,
        is_active           = true,
        needs_reconnect     = false,
        updated_at          = NOW(),
        last_sync_at        = NOW()
    `
    linkedCount++
  }

  if (limitReached && linkedCount === 0) {
    return NextResponse.json(
      { error: "Seu plano gratuito atingiu o limite de contas sociais. Faça upgrade para o Pro.", upgrade: true },
      { status: 403 }
    )
  }

  return NextResponse.json({
    ok: true,
    linked: linkedCount,
    ...(limitReached ? { warning: "Algumas contas não foram vinculadas por limite do plano." } : {}),
  })
}
