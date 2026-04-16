import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "socialdog_session"

const protectedPaths = ["/dashboard", "/workspace"]
const authPaths = ["/login", "/register"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Cookie normal (produção / desktop)
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value

  // Fallback: token passado diretamente na URL como ?__session=...
  // Necessário para o contexto de preview (iframe cross-origin) onde cookies SameSite=Lax
  // não são enviados. A rota /api/auth/session redireciona para /?__session=token.
  const urlToken = request.nextUrl.searchParams.get("__session")

  const hasSession = !!(sessionCookie || urlToken)

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))
  const isAuthPath = authPaths.some((p) => pathname.startsWith(p))

  // Se chegou com token na URL, seta o cookie e redireciona para a mesma página sem o token
  if (urlToken && !sessionCookie) {
    const cleanUrl = new URL(request.url)
    cleanUrl.searchParams.delete("__session")
    const response = NextResponse.redirect(cleanUrl)
    response.cookies.set(COOKIE_NAME, urlToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
    return response
  }

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (isAuthPath && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
}
