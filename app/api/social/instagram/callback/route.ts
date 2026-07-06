import { type NextRequest, NextResponse } from "next/server"

// Proteção contra dupla execução (Strict Mode do React / retry do browser)
// Códigos OAuth são de uso único — processar duas vezes gera "Error validating verification code"
const processedCodes = new Set<string>()

// Retorna HTML que envia postMessage para a janela pai e fecha o popup
function popupResponse(data: Record<string, string | null>) {
  const json = JSON.stringify(data)
  const html = `<!DOCTYPE html>
<html>
<head><title>Conectando...</title></head>
<body>
<script>
  try {
    window.opener.postMessage(${json}, window.location.origin);
  } catch(e) {}
  window.close();
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#666">
  Conectando... feche esta janela se ela não fechar automaticamente.
</p>
</body>
</html>`
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const error = searchParams.get("error")

  // Extrai o code BRUTO da URL sem passar pelo parser do Next.js
  // O Next.js decodifica automaticamente os parâmetros, o que pode corromper
  // caracteres como + e = que fazem parte do código OAuth do Instagram
  const urlString = request.url
  const codeMatch = urlString.match(/[?&]code=([^&#]+)/)
  const code = codeMatch ? codeMatch[1] : null

  const rawState = searchParams.get("state")

  // Validação de state (CSRF). A conexão é no nível da empresa (derivada da
  // sessão no /process), então o state só precisa carregar o redirectUri.
  try {
    JSON.parse(atob(rawState || ""))
  } catch {
    console.error("[Instagram OAuth] State inválido ou ausente:", rawState)
    return popupResponse({ type: "instagram_oauth_callback", error: "invalid_state", code: null, redirectUri: null })
  }

  if (error || !code) {
    return popupResponse({ type: "instagram_oauth_callback", error: error || "missing_params", code: null, redirectUri: null })
  }

  // Proteção contra dupla execução do mesmo código
  if (processedCodes.has(code)) {
    console.warn("[Instagram OAuth] Código já processado — ignorando segunda execução:", code.substring(0, 20))
    return popupResponse({ type: "instagram_oauth_callback", error: "code_already_used", code: null, redirectUri: null })
  }
  processedCodes.add(code)
  setTimeout(() => processedCodes.delete(code), 5 * 60 * 1000)

  const redirectUri = "https://social.list.dog/api/social/instagram/callback"

  return popupResponse({
    type: "instagram_oauth_callback",
    code,
    redirectUri,
    error: null,
  })
}
