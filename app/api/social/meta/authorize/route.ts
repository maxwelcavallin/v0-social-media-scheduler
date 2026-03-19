import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const workspaceId = searchParams.get("workspaceId") || ""

  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID não configurado." }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/meta/callback`
  const state = btoa(JSON.stringify({ workspaceId, redirectUri }))

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
    ].join(","),
    response_type: "code",
    state,
  })

  return NextResponse.redirect(
    `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`
  )
}
