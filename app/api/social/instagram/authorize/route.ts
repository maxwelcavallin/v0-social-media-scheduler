import { NextRequest, NextResponse } from "next/server"

// Instagram connection via Facebook OAuth → Instagram Business Account
// This is the ONLY supported way to connect an Instagram Business/Creator account
// for content publishing via the official Meta Graph API.
//
// Flow:
//   1. Facebook OAuth dialog (facebook.com/dialog/oauth) with Instagram scopes
//   2. Callback → exchange code for User Access Token (graph.facebook.com)
//   3. GET /me/accounts → find Pages managed by user
//   4. For each Page → GET /{page_id}?fields=instagram_business_account → get IG account
//   5. Save IG account_id + page access token to social_accounts

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const workspaceId = searchParams.get("workspaceId")

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 })
  }

  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) {
    return NextResponse.json(
      { error: "FACEBOOK_APP_ID não configurado no servidor." },
      { status: 500 }
    )
  }

  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  // Callback goes to the instagram/callback route (not meta/callback) to keep flows separate
  const redirectUri = `${protocol}://${host}/api/social/instagram/callback`

  const state = Buffer.from(JSON.stringify({ workspaceId, redirectUri })).toString("base64")

  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
  ].join(",")

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state,
  })

  console.log("[instagram/authorize] Redirecionando para Facebook OAuth")
  console.log("[instagram/authorize] redirect_uri:", redirectUri)
  console.log("[instagram/authorize] scopes:", scopes)

  return NextResponse.redirect(
    `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  )
}
