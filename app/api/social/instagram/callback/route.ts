import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const rawState = searchParams.get("state")
  const error = searchParams.get("error")

  let workspaceId = ""
  let redirectUri = ""

  try {
    const decoded = JSON.parse(atob(rawState || ""))
    workspaceId = decoded.workspaceId || ""
    redirectUri = decoded.redirectUri || ""
  } catch {
    workspaceId = rawState || ""
    const host = request.nextUrl.host
    redirectUri = `https://${host}/api/social/instagram/callback`
  }

  if (error || !code || !workspaceId) {
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/accounts?ig_error=${encodeURIComponent(error || "missing_params")}`, request.url)
    )
  }

  const processingUrl = new URL(`/workspace/${workspaceId}/accounts/connecting-instagram`, request.url)
  processingUrl.searchParams.set("code", code)
  processingUrl.searchParams.set("redirectUri", redirectUri)
  return NextResponse.redirect(processingUrl)
}
