import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH_API = "https://graph.facebook.com/v22.0"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const workspaceId = searchParams.get("state")
  const error = searchParams.get("error")

  if (error || !code || !workspaceId) {
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/accounts?error=oauth_cancelled`, request.url)
    )
  }

  const appId = process.env.FACEBOOK_APP_ID!
  const appSecret = process.env.FACEBOOK_APP_SECRET!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/meta/callback`

  try {
    // Exchange code for short-lived user access token
    const tokenRes = await fetch(
      `${GRAPH_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error("[meta/callback] Token exchange error:", tokenData.error)
      return NextResponse.redirect(
        new URL(`/workspace/${workspaceId}/accounts?error=token_exchange`, request.url)
      )
    }

    // Exchange for long-lived token (60 days)
    const longLivedRes = await fetch(
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    )
    const longLivedData = await longLivedRes.json()
    const userToken = longLivedData.access_token || tokenData.access_token

    // Fetch all pages managed by the user
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?access_token=${userToken}&fields=id,name,access_token,picture,instagram_business_account{id,name,username,profile_picture_url}`
    )
    const pagesData = await pagesRes.json()

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.redirect(
        new URL(`/workspace/${workspaceId}/accounts?error=no_pages`, request.url)
      )
    }

    let savedCount = 0

    for (const page of pagesData.data) {
      const pageToken = page.access_token

      // Save Facebook Page
      await sql`
        INSERT INTO social_accounts (
          id, workspace_id, platform, account_name, account_id, page_id,
          access_token, profile_picture_url, is_active, created_at, updated_at, last_sync_at
        )
        VALUES (
          gen_random_uuid(), ${workspaceId}, 'facebook', ${page.name},
          ${page.id}, ${page.id}, ${pageToken},
          ${page.picture?.data?.url || null}, true, NOW(), NOW(), NOW()
        )
        ON CONFLICT (platform, account_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          account_name = EXCLUDED.account_name,
          profile_picture_url = EXCLUDED.profile_picture_url,
          is_active = true,
          updated_at = NOW(),
          last_sync_at = NOW()
      `
      savedCount++

      // Save Instagram account if connected
      if (page.instagram_business_account) {
        const igAccount = page.instagram_business_account
        const igDetailsRes = await fetch(
          `${GRAPH_API}/${igAccount.id}?fields=id,name,username,profile_picture_url&access_token=${pageToken}`
        )
        const igDetails = await igDetailsRes.json()

        await sql`
          INSERT INTO social_accounts (
            id, workspace_id, platform, account_name, account_username, account_id, page_id,
            access_token, profile_picture_url, is_active, created_at, updated_at, last_sync_at
          )
          VALUES (
            gen_random_uuid(), ${workspaceId}, 'instagram',
            ${igDetails.name || igDetails.username || "Instagram"},
            ${igDetails.username || null},
            ${igDetails.id}, ${page.id}, ${pageToken},
            ${igDetails.profile_picture_url || null}, true, NOW(), NOW(), NOW()
          )
          ON CONFLICT (platform, account_id) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            account_name = EXCLUDED.account_name,
            account_username = EXCLUDED.account_username,
            profile_picture_url = EXCLUDED.profile_picture_url,
            page_id = EXCLUDED.page_id,
            is_active = true,
            updated_at = NOW(),
            last_sync_at = NOW()
        `
        savedCount++
      }
    }

    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/accounts?connected=${savedCount}`, request.url)
    )
  } catch (err) {
    console.error("[meta/callback] Error:", err)
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/accounts?error=server_error`, request.url)
    )
  }
}
