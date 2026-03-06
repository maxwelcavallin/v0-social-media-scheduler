import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const workspaceId = searchParams.get("state")
  const error = searchParams.get("error")
  const errorReason = searchParams.get("error_reason")
  const errorDescription = searchParams.get("error_description")

  // If Facebook returned an error
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

  // Redirect to a processing page that handles everything client-side
  // This avoids any server-side session/cookie issues in the OAuth redirect flow
  const processingUrl = new URL(`/workspace/${workspaceId}/accounts/connecting`, request.url)
  processingUrl.searchParams.set("code", code)
  processingUrl.searchParams.set("origin", request.nextUrl.origin)
  return NextResponse.redirect(processingUrl)
}
