import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// GET /api/social/meta/catalog?workspaceId=...
// Lista as páginas do CATÁLOGO global do usuário (todas as páginas que ele já
// concedeu ao app via Facebook) e marca quais já estão vinculadas ao workspace.
// É a fonte do seletor: o usuário conecta uma vez e escolhe aqui quais páginas
// usar em cada workspace, SEM refazer o OAuth (evitando a revogação/erro 190).
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get("workspaceId")
  if (!workspaceId) return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 })

  // Confirma que o usuário pertence ao workspace
  const member = await sql`
    SELECT 1 FROM "member"
    WHERE organization_id = ${workspaceId} AND user_id = ${session.user.id}
    LIMIT 1
  `
  if (member.length === 0) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const [catalog, linked] = await Promise.all([
    sql`
      SELECT page_id, page_name, picture_url,
             ig_business_account_id, ig_username, ig_name, ig_profile_picture_url,
             updated_at
      FROM meta_page_catalog
      WHERE connected_by_user_id = ${session.user.id}
      ORDER BY page_name ASC
    `,
    sql`
      SELECT account_id, platform, page_id
      FROM social_accounts
      WHERE workspace_id = ${workspaceId}
    `,
  ])

  // Um page_id está "vinculado" ao workspace se existe uma social_account do
  // Facebook com aquele account_id (=page_id) nele.
  const linkedPageIds = new Set(
    linked.filter((a: any) => a.platform === "facebook").map((a: any) => a.account_id),
  )

  const pages = catalog.map((p: any) => ({
    pageId: p.page_id,
    pageName: p.page_name,
    pictureUrl: p.picture_url,
    igUsername: p.ig_username,
    igName: p.ig_name,
    igProfilePictureUrl: p.ig_profile_picture_url,
    hasInstagram: Boolean(p.ig_business_account_id),
    linked: linkedPageIds.has(p.page_id),
  }))

  return NextResponse.json({ pages })
}

// POST /api/social/meta/catalog
// body: { workspaceId: string, pageIds: string[] }
// Vincula as páginas escolhidas ao workspace, criando as social_accounts (FB e IG
// vinculado, quando houver) a partir do catálogo — sem refazer o OAuth.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const workspaceId: string | undefined = body?.workspaceId
  const pageIds: string[] = Array.isArray(body?.pageIds) ? body.pageIds : []
  if (!workspaceId) return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 })
  if (pageIds.length === 0) return NextResponse.json({ error: "Selecione ao menos uma página" }, { status: 400 })

  const member = await sql`
    SELECT 1 FROM "member"
    WHERE organization_id = ${workspaceId} AND user_id = ${session.user.id}
    LIMIT 1
  `
  if (member.length === 0) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const catalogPages = await sql`
    SELECT page_id, page_name, page_access_token, user_access_token, fb_user_id,
           picture_url, ig_business_account_id, ig_username, ig_name, ig_profile_picture_url
    FROM meta_page_catalog
    WHERE connected_by_user_id = ${session.user.id}
      AND page_id = ANY(${pageIds}::text[])
  `

  let linkedCount = 0
  for (const page of catalogPages) {
    // Facebook
    await sql`
      INSERT INTO social_accounts (
        workspace_id, platform, account_name, account_username, account_id, page_id,
        access_token, profile_picture_url, user_access_token, fb_user_id,
        is_active, needs_reconnect, created_at, updated_at, last_sync_at
      )
      VALUES (
        ${workspaceId}, 'facebook', ${page.page_name}, NULL, ${page.page_id}, ${page.page_id},
        ${page.page_access_token}, ${page.picture_url}, ${page.user_access_token}, ${page.fb_user_id},
        true, false, NOW(), NOW(), NOW()
      )
      ON CONFLICT (workspace_id, platform, account_id) DO UPDATE SET
        access_token      = EXCLUDED.access_token,
        account_name      = EXCLUDED.account_name,
        page_id           = EXCLUDED.page_id,
        user_access_token = EXCLUDED.user_access_token,
        fb_user_id        = EXCLUDED.fb_user_id,
        profile_picture_url = EXCLUDED.profile_picture_url,
        is_active         = true,
        needs_reconnect   = false,
        updated_at        = NOW(),
        last_sync_at      = NOW()
    `

    // Instagram vinculado (se houver)
    if (page.ig_business_account_id) {
      await sql`
        INSERT INTO social_accounts (
          workspace_id, platform, account_name, account_username, account_id, page_id,
          access_token, profile_picture_url, user_access_token, fb_user_id,
          is_active, needs_reconnect, created_at, updated_at, last_sync_at
        )
        VALUES (
          ${workspaceId}, 'instagram',
          ${page.ig_name || page.ig_username || "Instagram"}, ${page.ig_username},
          ${page.ig_business_account_id}, ${page.page_id},
          ${page.page_access_token}, ${page.ig_profile_picture_url},
          ${page.user_access_token}, ${page.fb_user_id},
          true, false, NOW(), NOW(), NOW()
        )
        ON CONFLICT (workspace_id, platform, account_id) DO UPDATE SET
          access_token      = EXCLUDED.access_token,
          account_name      = EXCLUDED.account_name,
          account_username  = EXCLUDED.account_username,
          page_id           = EXCLUDED.page_id,
          user_access_token = EXCLUDED.user_access_token,
          fb_user_id        = EXCLUDED.fb_user_id,
          profile_picture_url = EXCLUDED.profile_picture_url,
          is_active         = true,
          needs_reconnect   = false,
          updated_at        = NOW(),
          last_sync_at      = NOW()
      `
    }
    linkedCount++
  }

  return NextResponse.json({ ok: true, linked: linkedCount })
}
