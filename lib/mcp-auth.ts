import sql from "@/lib/db"

export interface McpContext {
  organizationId: string
  tokenId: string
}

/** Valida o Bearer Token do cabeçalho Authorization e retorna o contexto MCP */
export async function validateMcpToken(authHeader: string | null): Promise<McpContext | null> {
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const rows = await sql`
    SELECT id, organization_id FROM mcp_tokens WHERE token = ${token}
  `
  if (!rows[0]) return null

  // Atualiza last_used_at assincronamente (fire-and-forget)
  sql`UPDATE mcp_tokens SET last_used_at = NOW() WHERE id = ${rows[0].id}`.catch(() => {})

  return { organizationId: rows[0].organization_id, tokenId: rows[0].id }
}
