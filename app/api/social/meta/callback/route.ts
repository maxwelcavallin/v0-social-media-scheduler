import { NextRequest, NextResponse } from "next/server"

// Callback do OAuth do Facebook. A conexão é no nível da empresa, então
// redirecionamos para a página de conexão da Visão Geral (/dashboard/connecting).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const rawState = searchParams.get("state")
  const error = searchParams.get("error")
  const errorReason = searchParams.get("error_reason")

  let redirectUri = ""
  try {
    const decoded = JSON.parse(atob(rawState || ""))
    redirectUri = decoded.redirectUri || ""
  } catch {
    redirectUri = `${request.nextUrl.origin}/api/social/meta/callback`
  }

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/connecting?fb_error=${encodeURIComponent(error)}&fb_reason=${encodeURIComponent(errorReason || "")}`,
        request.url
      )
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  const processingUrl = new URL(`/dashboard/connecting`, request.url)
  processingUrl.searchParams.set("code", code)
  processingUrl.searchParams.set("redirectUri", redirectUri)
  return NextResponse.redirect(processingUrl)
}
