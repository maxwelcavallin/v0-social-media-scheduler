import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH = "https://graph.facebook.com/v22.0"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, workspaceId, redirectUri } = await request.json()

  if (!code || !workspaceId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  // Use request host to build redirectUri server-side — never trust client value
  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const serverRedirectUri = `${protocol}://${host}/api/social/instagram/callback`
  const finalRedirectUri = redirectUri || serverRedirectUri

  try {
    const appId = process.env.FACEBOOK_APP_ID!
    const appSecret = process.env.FACEBOOK_APP_SECRET!

    // Step 1: Exchange code for short-lived user token
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      return NextResponse.json(
        { error: `Erro ao trocar código: ${tokenData.error.message} (redirect_uri: ${finalRedirectUri})` },
        { status: 400 }
      )
    }

    const userToken = tokenData.access_token

    // Step 2: Get long-lived token
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`
    )
    const longData = await longRes.json()
    const longToken = longData.access_token || userToken

    // Step 3: Get user info
    const meRes = await fetch(`${GRAPH}/me?fields=id,name&access_token=${longToken}`)
    const meData = await meRes.json()

    if (meData.error) {
      return NextResponse.json({ error: `Erro ao buscar perfil: ${meData.error.message}` }, { status: 400 })
    }

    // Step 4: Get Facebook pages (needed to find linked Instagram accounts)
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?access_token=${longToken}&fields=id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}`
    )
    const pagesData = await pagesRes.json()

    let savedCount = 0
    const savedAccounts: string[] = []

    if (pagesData.data && pagesData.data.length > 0) {
      // Has pages — save linked Instagram Business accounts
      for (const page of pagesData.data) {
        const igAccount = page.instagram_business_account
        if (!igAccount) continue

        // Get a page-scoped token for this Instagram account
        const pageTokenRes = await fetch(
          `${GRAPH}/${page.id}?fields=access_token&access_token=${longToken}`
        )
        const pageTokenData = await pageTokenRes.json()
        const pageToken = pageTokenData.access_token || page.access_token

        // Get long-lived page token
        const longPageRes = await fetch(
          `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${pageToken}`
        )
        const longPageData = await longPageRes.json()
        const finalPageToken = longPageData.access_token || pageToken

        await sql`
          INSERT INTO social_accounts
            (workspace_id, platform, account_id, page_id, account_name, account_username,
             profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
          VALUES
            (${workspaceId}, 'instagram', ${igAccount.id}, ${page.id}, ${igAccount.name},
             ${igAccount.username || null}, ${igAccount.profile_picture_url || null},
             ${finalPageToken}, true, NOW(), NOW(), NOW())
          ON CONFLICT (platform, account_id)
          DO UPDATE SET
            account_name = EXCLUDED.account_name,
            account_username = EXCLUDED.account_username,
            profile_picture_url = EXCLUDED.profile_picture_url,
            access_token = EXCLUDED.access_token,
            page_id = EXCLUDED.page_id,
            is_active = true,
            last_sync_at = NOW(),
            updated_at = NOW()
        `
        savedCount++
        savedAccounts.push(`@${igAccount.username || igAccount.name}`)
      }
    } else {
      // No pages — try Instagram Basic Display API (personal/creator accounts)
      // The user token itself IS the Instagram user token in this flow
      const igMeRes = await fetch(
        `${GRAPH}/me?fields=id,name,username,profile_picture&access_token=${longToken}`
      )
      const igMe = await igMeRes.json()

      if (igMe.id) {
        await sql`
          INSERT INTO social_accounts
            (workspace_id, platform, account_id, page_id, account_name, account_username,
             profile_picture_url, access_token, is_active, last_sync_at, created_at, updated_at)
          VALUES
            (${workspaceId}, 'instagram', ${igMe.id}, null, ${igMe.name || igMe.username},
             ${igMe.username || null}, ${igMe.profile_picture || null},
             ${longToken}, true, NOW(), NOW(), NOW())
          ON CONFLICT (platform, account_id)
          DO UPDATE SET
            account_name = EXCLUDED.account_name,
            account_username = EXCLUDED.account_username,
            profile_picture_url = EXCLUDED.profile_picture_url,
            access_token = EXCLUDED.access_token,
            is_active = true,
            last_sync_at = NOW(),
            updated_at = NOW()
        `
        savedCount++
        savedAccounts.push(`@${igMe.username || igMe.name}`)
      } else {
        return NextResponse.json(
          { error: `Nenhuma conta Instagram encontrada vinculada a este login. Resposta: ${JSON.stringify(igMe)}` },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      saved: savedCount,
      accounts: savedAccounts,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno." }, { status: 500 })
  }
}
