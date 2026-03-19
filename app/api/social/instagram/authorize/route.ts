import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const workspaceId = searchParams.get("workspaceId") || ""

  const appId = process.env.INSTAGRAM_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "INSTAGRAM_APP_ID não configurado." }, { status: 500 })
  }

  // Usar URL fixa de produção — deve ser exatamente igual à cadastrada no Meta
  const redirectUri = "https://social.list.dog/api/social/instagram/callback"
  const state = btoa(JSON.stringify({ workspaceId, redirectUri }))

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
      "instagram_business_content_publish",
    ].join(","),
    response_type: "code",
    state,
  })

  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  )
}
