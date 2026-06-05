import { NextRequest, NextResponse } from "next/server"
import { validateMcpToken } from "@/lib/mcp-auth"
import { uploadMcpMedia, type McpMediaInput } from "@/lib/mcp-media"
import sql from "@/lib/db"

export const maxDuration = 60

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://social.list.dog"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------
interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

interface McpRequest {
  jsonrpc: "2.0"
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Definição das ferramentas
// ---------------------------------------------------------------------------
const TOOLS: McpTool[] = [
  {
    name: "listar_contas",
    description: "Lista as contas do Instagram e Facebook do workspace que têm permissão MCP ativada.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "listar_posts",
    description: "Lista os posts do workspace. Aceita filtro opcional de status.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "scheduled", "published", "failed"],
          description: "Filtrar por status do post (opcional).",
        },
        limit: { type: "number", description: "Máximo de posts a retornar (padrão 20, máx 50)." },
      },
      required: [],
    },
  },
  {
    name: "criar_post",
    description: "Cria um post em rascunho para uma ou mais contas com permissão MCP ativada. Suporta feed, story e reel, com imagens e vídeos.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Texto/legenda do post. Pode ser vazio para stories." },
        post_type: {
          type: "string",
          enum: ["feed", "story", "reel"],
          description: "Tipo do post. feed = post normal, story = story (expira em 24h), reel = vídeo curto. Padrão: feed.",
        },
        account_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs das contas onde publicar (devem ter mcp_allowed = true).",
        },
        media: {
          type: "array",
          description: "Mídias do post. Obrigatório para story e reel. Máx 10 para carrossel de feed.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["image", "video"], description: "Tipo da mídia." },
              url: { type: "string", description: "URL pública da mídia (recomendado)." },
              media_type: { type: "string", description: "MIME type: image/jpeg, image/png, image/webp, video/mp4 (para envio via base64)." },
              data: { type: "string", description: "Conteúdo em base64 (alternativa à url)." },
            },
            required: ["type"],
          },
        },
      },
      required: ["content", "account_ids"],
    },
  },
  {
    name: "agendar_post",
    description: "Cria e agenda um post para uma data/hora específica (ISO 8601, horário de Brasília). Suporta feed, story e reel, com imagens e vídeos.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Texto/legenda do post. Pode ser vazio para stories." },
        post_type: {
          type: "string",
          enum: ["feed", "story", "reel"],
          description: "Tipo do post. feed = post normal, story = story (expira em 24h), reel = vídeo curto. Padrão: feed.",
        },
        scheduled_at: { type: "string", description: "Data e hora ISO 8601, ex: 2026-06-10T14:30:00-03:00" },
        account_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs das contas onde publicar (devem ter mcp_allowed = true).",
        },
        media: {
          type: "array",
          description: "Mídias do post. Obrigatório para story e reel. Máx 10 para carrossel de feed.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["image", "video"] },
              url: { type: "string", description: "URL pública da mídia (recomendado)." },
              media_type: { type: "string" },
              data: { type: "string" },
            },
            required: ["type"],
          },
        },
      },
      required: ["content", "scheduled_at", "account_ids"],
    },
  },
  {
    name: "publicar_agora",
    description: "Publica imediatamente um post em uma ou mais contas com permissão MCP ativada. Suporta feed, story e reel, com imagens e vídeos.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Texto/legenda do post. Pode ser vazio para stories." },
        post_type: {
          type: "string",
          enum: ["feed", "story", "reel"],
          description: "Tipo do post. feed = post normal, story = story (expira em 24h), reel = vídeo curto. Padrão: feed.",
        },
        account_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs das contas onde publicar (devem ter mcp_allowed = true).",
        },
        media: {
          type: "array",
          description: "Mídias do post. Obrigatório para story e reel. Máx 10 para carrossel de feed.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["image", "video"] },
              url: { type: "string", description: "URL pública da mídia (recomendado)." },
              media_type: { type: "string" },
              data: { type: "string" },
            },
            required: ["type"],
          },
        },
      },
      required: ["content", "account_ids"],
    },
  },
  {
    name: "editar_post",
    description: "Edita o conteúdo, tipo ou data de agendamento de um post que ainda não foi publicado (status draft ou scheduled). Use para corrigir erros antes da publicação.",
    inputSchema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID do post a editar." },
        content: { type: "string", description: "Novo texto do post (opcional — omita para manter o atual)." },
        post_type: {
          type: "string",
          enum: ["feed", "story", "reel"],
          description: "Novo tipo do post (opcional — omita para manter o atual).",
        },
        scheduled_at: {
          type: "string",
          description: "Nova data/hora de agendamento ISO 8601 (opcional — omita para manter a atual). Apenas para posts com status scheduled.",
        },
      },
      required: ["post_id"],
    },
  },
  {
    name: "cancelar_agendamento",
    description: "Cancela o agendamento de um post (muda status de scheduled para draft e remove da fila). Use para desfazer um agendar_post feito por engano.",
    inputSchema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID do post agendado a cancelar." },
      },
      required: ["post_id"],
    },
  },
  {
    name: "excluir_post",
    description: "Exclui permanentemente um post. Só é permitido para posts com status draft ou failed. Posts agendados devem ser cancelados antes com cancelar_agendamento.",
    inputSchema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID do post a excluir." },
      },
      required: ["post_id"],
    },
  },
]

// ---------------------------------------------------------------------------
// Helper: faz upload das mídias e insere em post_media
// ---------------------------------------------------------------------------
async function saveMedia(mediaInput: McpMediaInput[], postId: string): Promise<void> {
  if (!mediaInput.length) return
  if (mediaInput.length > 10) throw new Error("Máximo de 10 mídias por post.")

  for (let i = 0; i < mediaInput.length; i++) {
    const resolved = await uploadMcpMedia(mediaInput[i], postId, i)
    await sql`
      INSERT INTO post_media (id, post_id, url, media_type, order_index, created_at)
      VALUES (gen_random_uuid(), ${postId}, ${resolved.url}, ${resolved.media_type}, ${i}, NOW())
    `
  }
}

// ---------------------------------------------------------------------------
// Execução das ferramentas
// ---------------------------------------------------------------------------
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  organizationId: string
): Promise<unknown> {
  // Valida permissão mcp_allowed para todas as ferramentas que recebem account_ids
  if (args.account_ids) {
    const ids = args.account_ids as string[]
    if (!ids.length) throw new Error("account_ids não pode ser vazio.")

    const allowed = await sql`
      SELECT id FROM social_accounts
      WHERE id = ANY(${ids}::uuid[])
        AND workspace_id = ${organizationId}
        AND mcp_allowed = true
        AND is_active = true
    `
    const allowedIds = new Set(allowed.map((r: any) => r.id))
    const blocked = ids.filter((id) => !allowedIds.has(id))
    if (blocked.length > 0) {
      throw new Error(
        `Ação bloqueada: as seguintes contas não têm permissão MCP ativada ou não pertencem a este workspace: ${blocked.join(", ")}`
      )
    }
  }

  switch (name) {
    case "listar_contas": {
      const accounts = await sql`
        SELECT id, platform, account_name, account_username, mcp_allowed, is_active
        FROM social_accounts
        WHERE workspace_id = ${organizationId}
          AND mcp_allowed = true
          AND is_active = true
        ORDER BY platform, account_name
      `
      return { accounts }
    }

    case "listar_posts": {
      const status = args.status as string | undefined
      const limit = Math.min(Number(args.limit ?? 20), 50)
      const posts = status
        ? await sql`
            SELECT p.id, p.content, p.status, p.post_type, p.scheduled_at, p.published_at, p.created_at,
                   COALESCE(ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.post_type IS NOT NULL), ARRAY[]::text[]) AS target_post_types
            FROM posts p
            LEFT JOIN post_targets pt ON pt.post_id = p.id
            WHERE p.workspace_id = ${organizationId} AND p.status = ${status}
            GROUP BY p.id
            ORDER BY p.created_at DESC LIMIT ${limit}
          `
        : await sql`
            SELECT p.id, p.content, p.status, p.post_type, p.scheduled_at, p.published_at, p.created_at,
                   COALESCE(ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.post_type IS NOT NULL), ARRAY[]::text[]) AS target_post_types
            FROM posts p
            LEFT JOIN post_targets pt ON pt.post_id = p.id
            WHERE p.workspace_id = ${organizationId}
            GROUP BY p.id
            ORDER BY p.created_at DESC LIMIT ${limit}
          `
      return { posts }
    }

    case "criar_post": {
      const content = args.content as string
      const account_ids = args.account_ids as string[]
      const mediaInput = (args.media ?? []) as McpMediaInput[]
      const postType = (args.post_type as string | undefined) ?? "feed"

      if (!["feed", "story", "reel"].includes(postType)) throw new Error("post_type inválido. Use: feed, story ou reel.")
      if ((postType === "story" || postType === "reel") && mediaInput.length === 0) {
        throw new Error(`post_type "${postType}" exige ao menos uma mídia. Forneça o campo media.`)
      }
      if (postType === "reel" && !mediaInput.some((m) => m.type === "video")) {
        throw new Error("Reels exigem um vídeo. Certifique-se de que ao menos uma mídia seja do tipo video.")
      }

      const post = await sql`
        INSERT INTO posts (workspace_id, content, status, post_type, created_by, created_at, updated_at)
        VALUES (${organizationId}, ${content}, 'draft', ${postType}, 'mcp', NOW(), NOW())
        RETURNING id
      `
      const postId = post[0].id

      if (mediaInput.length > 0) await saveMedia(mediaInput, postId)

      for (const accountId of account_ids) {
        await sql`
          INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
          VALUES (gen_random_uuid(), ${postId}, ${accountId}, ${postType}, 'pending', NOW())
        `
      }
      return {
        post_id: postId,
        status: "draft",
        post_type: postType,
        media_count: mediaInput.length,
        message: `Post do tipo "${postType}" criado como rascunho com sucesso${mediaInput.length ? ` (${mediaInput.length} mídia${mediaInput.length > 1 ? "s" : ""})` : ""}.`,
      }
    }

    case "agendar_post": {
      const content = args.content as string
      const scheduled_at = args.scheduled_at as string
      const account_ids = args.account_ids as string[]
      const mediaInput = (args.media ?? []) as McpMediaInput[]
      const postType = (args.post_type as string | undefined) ?? "feed"

      if (!["feed", "story", "reel"].includes(postType)) throw new Error("post_type inválido. Use: feed, story ou reel.")
      if ((postType === "story" || postType === "reel") && mediaInput.length === 0) {
        throw new Error(`post_type "${postType}" exige ao menos uma mídia. Forneça o campo media.`)
      }
      if (postType === "reel" && !mediaInput.some((m) => m.type === "video")) {
        throw new Error("Reels exigem um vídeo. Certifique-se de que ao menos uma mídia seja do tipo video.")
      }

      const scheduledDate = new Date(scheduled_at)
      if (isNaN(scheduledDate.getTime())) throw new Error("scheduled_at inválido. Use formato ISO 8601.")
      if (scheduledDate <= new Date()) throw new Error("scheduled_at deve ser uma data futura.")

      const post = await sql`
        INSERT INTO posts (workspace_id, content, status, post_type, scheduled_at, created_by, created_at, updated_at)
        VALUES (${organizationId}, ${content}, 'scheduled', ${postType}, ${scheduledDate.toISOString()}, 'mcp', NOW(), NOW())
        RETURNING id
      `
      const postId = post[0].id

      if (mediaInput.length > 0) await saveMedia(mediaInput, postId)

      for (const accountId of account_ids) {
        await sql`
          INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
          VALUES (gen_random_uuid(), ${postId}, ${accountId}, ${postType}, 'pending', NOW())
        `
      }
      await sql`
        INSERT INTO post_queue (post_id, scheduled_at, status, attempts, max_attempts, created_at, updated_at)
        VALUES (${postId}, ${scheduledDate.toISOString()}, 'pending', 0, 3, NOW(), NOW())
      `
      return {
        post_id: postId,
        status: "scheduled",
        post_type: postType,
        scheduled_at: scheduledDate.toISOString(),
        media_count: mediaInput.length,
        message: `${postType === "story" ? "Story" : postType === "reel" ? "Reel" : "Post"} agendado com sucesso para ${scheduledDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${mediaInput.length ? ` com ${mediaInput.length} mídia${mediaInput.length > 1 ? "s" : ""}` : ""}.`,
      }
    }

    case "publicar_agora": {
      const content = args.content as string
      const account_ids = args.account_ids as string[]
      const mediaInput = (args.media ?? []) as McpMediaInput[]
      const postType = (args.post_type as string | undefined) ?? "feed"

      if (!["feed", "story", "reel"].includes(postType)) throw new Error("post_type inválido. Use: feed, story ou reel.")
      if ((postType === "story" || postType === "reel") && mediaInput.length === 0) {
        throw new Error(`post_type "${postType}" exige ao menos uma mídia. Forneça o campo media.`)
      }
      if (postType === "reel" && !mediaInput.some((m) => m.type === "video")) {
        throw new Error("Reels exigem um vídeo. Certifique-se de que ao menos uma mídia seja do tipo video.")
      }

      const post = await sql`
        INSERT INTO posts (workspace_id, content, status, post_type, created_by, created_at, updated_at)
        VALUES (${organizationId}, ${content}, 'scheduled', ${postType}, 'mcp', NOW(), NOW())
        RETURNING id
      `
      const postId = post[0].id

      if (mediaInput.length > 0) await saveMedia(mediaInput, postId)

      for (const accountId of account_ids) {
        await sql`
          INSERT INTO post_targets (id, post_id, social_account_id, post_type, status, created_at)
          VALUES (gen_random_uuid(), ${postId}, ${accountId}, ${postType}, 'pending', NOW())
        `
      }
      const now = new Date(Date.now() + 10_000) // 10s no futuro para o cron pegar
      await sql`
        INSERT INTO post_queue (post_id, scheduled_at, status, attempts, max_attempts, created_at, updated_at)
        VALUES (${postId}, ${now.toISOString()}, 'pending', 0, 3, NOW(), NOW())
      `
      return {
        post_id: postId,
        status: "publishing",
        post_type: postType,
        media_count: mediaInput.length,
        message: `${postType === "story" ? "Story" : postType === "reel" ? "Reel" : "Post"} enviado para publicação imediata${mediaInput.length ? ` com ${mediaInput.length} mídia${mediaInput.length > 1 ? "s" : ""}` : ""}. Será processado em instantes.`,
      }
    }

    case "editar_post": {
      const postId = args.post_id as string
      const newContent = args.content as string | undefined
      const newPostType = args.post_type as string | undefined
      const newScheduledAt = args.scheduled_at as string | undefined

      if (newPostType && !["feed", "story", "reel"].includes(newPostType)) {
        throw new Error("post_type inválido. Use: feed, story ou reel.")
      }

      // Verifica que o post pertence ao workspace e ainda pode ser editado
      const existing = await sql`
        SELECT id, status, content, post_type, scheduled_at FROM posts
        WHERE id = ${postId} AND workspace_id = ${organizationId}
      `
      if (!existing.length) throw new Error(`Post ${postId} não encontrado neste workspace.`)

      const post = existing[0]
      if (post.status === "published") throw new Error("Não é possível editar um post já publicado.")
      if (post.status === "failed") throw new Error("Post falhou ao publicar. Use excluir_post e crie um novo.")

      // Valida nova data se fornecida
      let scheduledDate: Date | undefined
      if (newScheduledAt !== undefined) {
        if (post.status !== "scheduled") throw new Error("Só é possível alterar scheduled_at em posts com status scheduled. Use cancelar_agendamento primeiro se quiser mudar para draft.")
        scheduledDate = new Date(newScheduledAt)
        if (isNaN(scheduledDate.getTime())) throw new Error("scheduled_at inválido. Use formato ISO 8601.")
        if (scheduledDate <= new Date()) throw new Error("scheduled_at deve ser uma data futura.")
      }

      if (!newContent && !newPostType && !scheduledDate) {
        throw new Error("Informe ao menos um campo para editar: content, post_type ou scheduled_at.")
      }

      const updatedContent = newContent ?? post.content
      const updatedPostType = newPostType ?? post.post_type

      await sql`
        UPDATE posts
        SET content = ${updatedContent}, post_type = ${updatedPostType},
            scheduled_at = ${scheduledDate ? scheduledDate.toISOString() : post.scheduled_at},
            updated_at = NOW()
        WHERE id = ${postId}
      `

      if (newPostType) {
        // Sincroniza o post_type nos targets existentes
        await sql`UPDATE post_targets SET post_type = ${updatedPostType} WHERE post_id = ${postId}`
      }

      if (scheduledDate) {
        await sql`
          UPDATE post_queue SET scheduled_at = ${scheduledDate.toISOString()}, updated_at = NOW()
          WHERE post_id = ${postId} AND status = 'pending'
        `
      }

      const changes: string[] = []
      if (newContent) changes.push("conteúdo")
      if (newPostType) changes.push(`tipo → ${newPostType}`)
      if (scheduledDate) changes.push(`agendamento → ${scheduledDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`)

      return {
        post_id: postId,
        post_type: updatedPostType,
        message: `Post atualizado com sucesso. Alterações: ${changes.join(", ")}.`,
      }
    }

    case "cancelar_agendamento": {
      const postId = args.post_id as string

      const existing = await sql`
        SELECT id, status FROM posts
        WHERE id = ${postId} AND workspace_id = ${organizationId}
      `
      if (!existing.length) throw new Error(`Post ${postId} não encontrado neste workspace.`)

      const post = existing[0]
      if (post.status !== "scheduled") throw new Error(`Post não está agendado (status atual: ${post.status}).`)

      // Remove da fila e muda status para draft
      await sql`
        DELETE FROM post_queue WHERE post_id = ${postId} AND status = 'pending'
      `
      await sql`
        UPDATE posts SET status = 'draft', scheduled_at = NULL, updated_at = NOW()
        WHERE id = ${postId}
      `

      return {
        post_id: postId,
        status: "draft",
        message: "Agendamento cancelado. O post voltou para rascunho e pode ser editado ou excluído.",
      }
    }

    case "excluir_post": {
      const postId = args.post_id as string

      const existing = await sql`
        SELECT id, status FROM posts
        WHERE id = ${postId} AND workspace_id = ${organizationId}
      `
      if (!existing.length) throw new Error(`Post ${postId} não encontrado neste workspace.`)

      const post = existing[0]
      if (post.status === "published") throw new Error("Não é possível excluir um post já publicado nas redes sociais.")
      if (post.status === "scheduled") throw new Error("Post está agendado. Use cancelar_agendamento antes de excluir.")

      // Exclui em cascata (post_targets, post_media e post_queue via FK ON DELETE CASCADE)
      await sql`DELETE FROM posts WHERE id = ${postId}`

      return {
        post_id: postId,
        message: "Post excluído permanentemente com sucesso.",
      }
    }

    default:
      throw new Error(`Ferramenta desconhecida: ${name}`)
  }
}

// ---------------------------------------------------------------------------
// Handler MCP JSON-RPC (Streamable HTTP)
// ---------------------------------------------------------------------------
async function handleMcpRequest(
  mcpReq: McpRequest,
  organizationId: string
): Promise<Record<string, unknown>> {
  const { jsonrpc, id, method, params } = mcpReq

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc,
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "socialdog-mcp", version: "1.0.0" },
          },
        }

      case "tools/list":
        return { jsonrpc, id, result: { tools: TOOLS } }

      case "tools/call": {
        const toolName = (params?.name as string) ?? ""
        const toolArgs = (params?.arguments as Record<string, unknown>) ?? {}
        const result = await executeTool(toolName, toolArgs, organizationId)
        return {
          jsonrpc,
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
        }
      }

      case "ping":
        return { jsonrpc, id, result: {} }

      default:
        return {
          jsonrpc,
          id,
          error: { code: -32601, message: `Método não encontrado: ${method}` },
        }
    }
  } catch (err: any) {
    return {
      jsonrpc,
      id,
      error: { code: -32603, message: err.message ?? "Erro interno" },
    }
  }
}

// ---------------------------------------------------------------------------
// Next.js Route Handlers
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params
  const ctx = await validateMcpToken(req.headers.get("authorization"))
  if (!ctx || ctx.organizationId !== organizationId) {
    return NextResponse.json(
      { error: "Bearer Token inválido ou sem permissão para este workspace." },
      {
        status: 401,
        headers: {
          ...CORS,
          "WWW-Authenticate": `Bearer realm="${BASE}/api/mcp/${organizationId}", resource_metadata="${BASE}/.well-known/oauth-authorization-server"`,
        },
      }
    )
  }

  const body: McpRequest = await req.json()
  const response = await handleMcpRequest(body, organizationId)
  return NextResponse.json(response, { headers: CORS })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params
  const ctx = await validateMcpToken(req.headers.get("authorization"))
  if (!ctx || ctx.organizationId !== organizationId) {
    return new Response("Bearer Token inválido.", {
      status: 401,
      headers: {
        ...CORS,
        "WWW-Authenticate": `Bearer realm="${BASE}/api/mcp/${organizationId}", resource_metadata="${BASE}/.well-known/oauth-authorization-server"`,
      },
    })
  }

  // Fallback SSE — mantém conexão e responde a mensagens via POST
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const postUrl = `${new URL(req.url).origin}/api/mcp/${organizationId}`
      controller.enqueue(encoder.encode(`event: endpoint\ndata: ${postUrl}\n\n`))
      const interval = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")) } catch { clearInterval(interval) }
      }, 25_000)
      req.signal.addEventListener("abort", () => { clearInterval(interval); controller.close() })
    },
  })

  return new Response(stream, {
    headers: {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
