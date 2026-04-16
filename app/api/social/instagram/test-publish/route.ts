import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { GRAPH_IG } from "@/lib/publish"

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  // Verificar role admin na empresa
  const adminCheck = await sql`
    SELECT cm.role
    FROM company_member cm
    JOIN company c ON c.id = cm.company_id
    WHERE cm.user_id = ${session.user.id}
    LIMIT 1
  `
  if (!adminCheck.length || adminCheck[0].role !== "admin") {
    return NextResponse.json({ error: "Acesso negado. Apenas administradores podem executar este teste." }, { status: 403 })
  }

  const { accountId } = await req.json()
  if (!accountId) return NextResponse.json({ error: "accountId obrigatório" }, { status: 400 })

  // Buscar conta Instagram sem page_id (conexão direta)
  const accountRows = await sql`
    SELECT id, access_token, platform_user_id, account_username
    FROM social_accounts
    WHERE id = ${accountId}
      AND platform = 'instagram'
      AND page_id IS NULL
    LIMIT 1
  `
  if (!accountRows.length) {
    return NextResponse.json({ error: "Conta não encontrada ou não é uma conta Instagram direta (sem page_id)" }, { status: 404 })
  }

  const account = accountRows[0]
  const { access_token, platform_user_id, account_username } = account

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://placehold.co/1080x1080/E8F4FD/1a3a5c.jpg"

  const imageUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}/ig-test-image.jpg`
    : "https://placehold.co/1080x1080/E8F4FD/1a3a5c.jpg"

  const apiResponses: { step: string; url: string; status: number; body: unknown }[] = []

  try {
    // ── Passo 1: Criar container de mídia ──────────────────────────────────
    const containerUrl = `${GRAPH_IG}/me/media`
    const containerBody = {
      image_url: imageUrl,
      caption: "Teste de integração via Instagram Graph API — pode ser excluído.",
      access_token,
    }

    const containerRes = await fetch(containerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    })
    const containerData = await containerRes.json()
    apiResponses.push({ step: "Criar container", url: containerUrl, status: containerRes.status, body: containerData })

    if (containerData.error) {
      return NextResponse.json({
        success: false,
        error: `Erro ao criar container: ${containerData.error.message} [código ${containerData.error.code}]`,
        api_responses: apiResponses,
      }, { status: 200 })
    }

    const containerId = containerData.id

    // ── Passo 2: Aguardar status FINISHED ──────────────────────────────────
    let lastStatus = ""
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const statusUrl = `${GRAPH_IG}/${containerId}?fields=status_code,status&access_token=${access_token}`
      const statusRes = await fetch(statusUrl)
      const statusData = await statusRes.json()
      lastStatus = statusData.status_code
      apiResponses.push({ step: `Poll status (tentativa ${i + 1})`, url: statusUrl, status: statusRes.status, body: statusData })
      if (lastStatus === "FINISHED") break
      if (lastStatus === "ERROR") {
        return NextResponse.json({
          success: false,
          error: `Instagram rejeitou a mídia: ${statusData.status || "erro desconhecido"}`,
          container_id: containerId,
          api_responses: apiResponses,
        }, { status: 200 })
      }
    }

    if (lastStatus !== "FINISHED") {
      return NextResponse.json({
        success: false,
        error: `Tempo esgotado aguardando processamento (último status: ${lastStatus})`,
        container_id: containerId,
        api_responses: apiResponses,
      }, { status: 200 })
    }

    // ── Passo 3: Publicar ──────────────────────────────────────────────────
    const publishUrl = `${GRAPH_IG}/me/media_publish`
    const publishBody = { creation_id: containerId, access_token }

    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(publishBody),
    })
    const publishData = await publishRes.json()
    apiResponses.push({ step: "Publicar mídia", url: publishUrl, status: publishRes.status, body: publishData })

    if (publishData.error) {
      return NextResponse.json({
        success: false,
        error: `Erro ao publicar: ${publishData.error.message} [código ${publishData.error.code}]`,
        container_id: containerId,
        api_responses: apiResponses,
      }, { status: 200 })
    }

    return NextResponse.json({
      success: true,
      account_username,
      container_id: containerId,
      media_id: publishData.id,
      api_responses: apiResponses,
    })

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Erro desconhecido",
      api_responses: apiResponses,
    }, { status: 500 })
  }
}
