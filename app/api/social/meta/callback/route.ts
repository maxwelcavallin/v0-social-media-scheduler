import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

const GRAPH_API = "https://graph.facebook.com/v22.0"

export async function GET(request: NextRequest) {
  console.log("[meta/callback] ===== START =====")
  console.log("[meta/callback] URL:", request.url)

  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const workspaceId = searchParams.get("state")
  const error = searchParams.get("error")
  const errorReason = searchParams.get("error_reason")

  console.log("[meta/callback] code:", code ? code.substring(0, 20) + "..." : null)
  console.log("[meta/callback] workspaceId:", workspaceId)
  console.log("[meta/callback] error:", error, errorReason)

  if (error) {
    console.log("[meta/callback] OAuth error, redirecting")
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/accounts?error=oauth_cancelled`, request.url)
    )
  }

  if (!code || !workspaceId) {
    console.log("[meta/callback] Missing code or workspaceId")
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Check session
  const session = await getSession()
  console.log("[meta/callback] session userId:", session?.user?.id ?? "NULL")
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  const origin = request.nextUrl.origin
  const redirectUri = `${origin}/api/social/meta/callback`

  console.log("[meta/callback] appId:", appId ? appId.substring(0, 6) + "..." : "MISSING")
  console.log("[meta/callback] appSecret:", appSecret ? "present" : "MISSING")
  console.log("[meta/callback] redirectUri:", redirectUri)

  if (!appId || !appSecret) {
    console.error("[meta/callback] Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET")
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/accounts?error=config_error`, request.url)
    )
  }

  try {
    // Step 1: Exchange code for short-lived token
    const tokenUrl = `${GRAPH_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    console.log("[meta/callback] Step 1: exchanging code for token...")
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()
    console.log("[meta/callback] Step 1 result:", tokenData.error ? JSON.stringify(tokenData.error) : "OK, token type: " + tokenData.token_type)

    if (tokenData.error) {
      return NextResponse.redirect(
        new URL(`/workspace/${workspaceId}/accounts?error=token_exchange`, request.url)
      )
    }

    const shortToken = tokenData.access_token

    // Step 2: Exchange for long-lived token (60 days)
    console.log("[meta/callback] Step 2: exchanging for long-lived token...")
    const longLivedRes = await fetch(
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
    )
    const longLivedData = await longLivedRes.json()
    const userToken = longLivedData.access_token || shortToken
    console.log("[meta/callback] Step 2 result:", longLivedData.error ? JSON.stringify(longLivedData.error) : "OK")

    // Step 3: Fetch pages
    console.log("[meta/callback] Step 3: fetching pages...")
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?access_token=${userToken}&fields=id,name,access_token,picture,instagram_business_account{id,name,username,profile_picture_url}`
    )
    const pagesData = await pagesRes.json()
    console.log("[meta/callback] Step 3 pages found:", pagesData?.data?.length ?? 0)
    if (pagesData.error) {
      console.error("[meta/callback] Step 3 error:", JSON.stringify(pagesData.error))
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.redirect(
        new URL(`/workspace/${workspaceId}/accounts?error=no_pages`, request.url)
      )
    }

    let savedCount = 0

    for (const page of pagesData.data) {
      console.log("[meta/callback] Processing page:", page.name, "id:", page.id)
      const pageToken = page.access_token

      try {
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
        savedCount++
        console.log("[meta/callback] Saved FB page:", page.name)
      } catch (insertErr) {
        console.error("[meta/callback] Failed to save FB page:", page.name, insertErr)
      }

      // Save Instagram account if connected
      if (page.instagram_business_account) {
        const igAccount = page.instagram_business_account
        console.log("[meta/callback] Processing IG account:", igAccount.id)
        try {
          const igDetailsRes = await fetch(
            `${GRAPH_API}/${igAccount.id}?fields=id,name,username,profile_picture_url&access_token=${pageToken}`
          )
          const igDetails = await igDetailsRes.json()
          console.log("[meta/callback] IG details:", igDetails.username, igDetails.error ? JSON.stringify(igDetails.error) : "OK")

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
          savedCount++
          console.log("[meta/callback] Saved IG account:", igDetails.username)
        } catch (igErr) {
          console.error("[meta/callback] Failed to save IG account:", igErr)
        }
      }
    }

    console.log("[meta/callback] ===== DONE, savedCount:", savedCount, "=====")
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/accounts?connected=${savedCount}`, request.url)
    )
  } catch (err) {
    console.error("[meta/callback] Unhandled error:", err)
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/accounts?error=server_error`, request.url)
    )
  }
}
