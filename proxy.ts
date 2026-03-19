import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "socialdog_session"

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/privacy-policy",
  "/data-deletion",
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir todas as rotas de API
  if (pathname.startsWith("/api/")) return NextResponse.next()

  // Permitir arquivos estáticos
  if (pathname.startsWith("/_next/") || pathname.includes(".")) return NextResponse.next()

  const session = request.cookies.get(COOKIE_NAME)
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))

  // Rota protegida sem sessão → redireciona para login
  if (!isPublic && !session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Já logado tentando acessar login/register → redireciona para dashboard
  if (session && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
