import { type NextRequest, NextResponse } from "next/server"

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
  const code = searchParams.get("code")
  const rawState = searchParams.get("state")
  const error = searchParams.get("error")

  let workspaceId = ""
  try {
    const decoded = JSON.parse(atob(rawState || ""))
    workspaceId = decoded.workspaceId || ""
  } catch {
    workspaceId = rawState || ""
  }

  if (error || !code) {
    return popupResponse({
      type: "instagram_oauth_callback",
      error: error || "missing_params",
      code: null,
      redirectUri: null,
    })
  }

  // O redirect_uri deve ser idêntico ao cadastrado no painel Meta
  const redirectUri = "https://social.list.dog/api/social/instagram/callback"

  return popupResponse({
    type: "instagram_oauth_callback",
    code,
    redirectUri,
    error: null,
  })
}
