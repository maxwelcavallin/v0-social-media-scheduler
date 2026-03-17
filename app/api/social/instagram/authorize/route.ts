import { NextRequest, NextResponse } from "next/server"

// Uses FACEBOOK_APP_ID — same variable already used by the Meta/Facebook integration.
// The user sees "Conectar Instagram" but the OAuth happens via Facebook Login (required by Meta).
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
  const redirectUri = `${protocol}://${host}/api/social/instagram/callback`

  const state = Buffer.from(JSON.stringify({ workspaceId, redirectUri })).toString("base64")

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: [
      "pages_show_list",
      "instagram_basic",
      "instagram_content_publish",
      "pages_read_engagement",
    ].join(","),
    response_type: "code",
    state,
  })

  return NextResponse.redirect(
    `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  )
}
