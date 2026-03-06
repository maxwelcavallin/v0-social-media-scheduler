import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const rawState = searchParams.get("state")
  const error = searchParams.get("error")
  const errorReason = searchParams.get("error_reason")

  // Decode state — can be base64 JSON {workspaceId, redirectUri} or plain workspaceId (legacy)
  let workspaceId = ""
  let redirectUri = ""

  try {
    const decoded = JSON.parse(atob(rawState || ""))
    workspaceId = decoded.workspaceId || ""
    redirectUri = decoded.redirectUri || ""
  } catch {
    // Legacy: state is just the workspaceId string
    workspaceId = rawState || ""
    redirectUri = `${request.nextUrl.origin}/api/social/meta/callback`
  }

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/workspace/${workspaceId}/accounts?fb_error=${encodeURIComponent(error)}&fb_reason=${encodeURIComponent(errorReason || "")}`,
        request.url
      )
    )
  }

  if (!code || !workspaceId) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Pass code + the exact redirectUri that was sent to Facebook
  const processingUrl = new URL(`/workspace/${workspaceId}/accounts/connecting`, request.url)
  processingUrl.searchParams.set("code", code)
  processingUrl.searchParams.set("redirectUri", redirectUri)
  return NextResponse.redirect(processingUrl)
}
