import { type NextRequest, NextResponse } from "next/server"

// Facebook Login for Business — uses config_id from the Instagram Integration template
// configured at Meta for Developers > Facebook Login for Business > Templates
// This returns a Facebook User Token (not an Instagram token), which works with
// graph.facebook.com/me/accounts to find linked Instagram Business Accounts.
const FB_DIALOG = "https://www.facebook.com/dialog/oauth"
const CONFIG_ID = "784348634739530"

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
    config_id: CONFIG_ID,
    response_type: "code",
    state,
  })

  return NextResponse.redirect(`${FB_DIALOG}?${params.toString()}`)
}
