import { NextRequest } from "next/server"

/**
 * Retorna a URL base da aplicação na seguinte ordem de prioridade:
 * 1. NEXT_PUBLIC_APP_URL (variável explícita, mais confiável)
 * 2. x-forwarded-host + x-forwarded-proto (headers do proxy em produção)
 * 3. host header (fallback, pode ser interno na Vercel)
 */
export function getAppUrl(request?: NextRequest): string {
  // 1. Variável de ambiente explícita — prioridade máxima
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  }

  // 2. Headers de proxy (injetados pela Vercel / Cloudflare / nginx em produção)
  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host")
    const forwardedProto = request.headers.get("x-forwarded-proto")
    if (forwardedHost) {
      const proto = forwardedProto?.split(",")[0].trim() || "https"
      return `${proto}://${forwardedHost.split(",")[0].trim()}`
    }

    // 3. Fallback: host header direto
    const host = request.headers.get("host") ?? ""
    const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"
    return `${proto}://${host}`
  }

  return "https://social.list.dog"
}
