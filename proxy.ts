import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "socialdog-secret-key-change-in-production"
)

const COOKIE_NAME = "socialdog_session"

// Rotas públicas que não precisam de autenticação via cookie de sessão
// (rotas de API com autenticação própria via CRON_SECRET / QUEUE_SECRET devem estar aqui)
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/invite",
  "/api/auth",
  "/api/social/meta/callback",
  "/api/queue/process",   // chamado pelo Vercel Cron — usa Authorization: Bearer <CRON_SECRET>
  "/api/webhook/",        // chamado pelo scheduler interno — usa x-queue-secret
  "/review/",             // links de revisão de conteúdo — acesso público via token na URL
  "/api/review/",         // API dos links de revisão — autenticação via token da URL
  "/api/mcp/",            // servidor MCP — autenticação interna via Bearer Token
]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignora assets estáticos e rotas públicas
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    isPublic(pathname)
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value

  // Sem token — redireciona para login
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Token inválido ou expirado — redireciona para login
  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    // Limpa o cookie expirado
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Sessão expirada" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url))

    response.cookies.delete(COOKIE_NAME)
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Intercepta todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
