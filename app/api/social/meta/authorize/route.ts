import { NextRequest, NextResponse } from "next/server"
import { getAppUrl } from "@/lib/app-url"

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
  const redirectUri = `${getAppUrl(request)}/api/social/meta/callback`

  const state = Buffer.from(JSON.stringify({ workspaceId, redirectUri })).toString("base64")

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
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
