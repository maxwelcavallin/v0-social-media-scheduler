import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

// Exclusão em massa de workspaces. Apenas administradores da empresa podem usar.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { workspaceIds } = await request.json()
  if (!Array.isArray(workspaceIds) || workspaceIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um workspace." }, { status: 400 })
  }

  // Só administradores da empresa podem excluir workspaces.
  const adminCheck = await sql`
    SELECT cm.id FROM company_member cm
    WHERE cm.user_id = ${session.user.id} AND cm.role = 'admin'
    LIMIT 1
  `
  if (adminCheck.length === 0) {
    return NextResponse.json({ error: "Apenas administradores podem excluir workspaces." }, { status: 403 })
  }

  // Restringe aos workspaces em que o usuário é membro (defesa contra IDs arbitrários).
  const owned = await sql`
    SELECT organization_id FROM "member"
    WHERE user_id = ${session.user.id} AND organization_id = ANY(${workspaceIds})
  `
  const allowedIds: string[] = owned.map((r: any) => r.organization_id)
  if (allowedIds.length === 0) {
    return NextResponse.json({ error: "Nenhum workspace válido para excluir." }, { status: 403 })
  }

  // Exclui em ordem de dependência (mesma ordem do DELETE individual).
  await sql`DELETE FROM post_queue WHERE post_id IN (SELECT id FROM posts WHERE workspace_id = ANY(${allowedIds}))`
  await sql`DELETE FROM post_targets WHERE post_id IN (SELECT id FROM posts WHERE workspace_id = ANY(${allowedIds}))`
  await sql`DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE workspace_id = ANY(${allowedIds}))`
  await sql`DELETE FROM posts WHERE workspace_id = ANY(${allowedIds})`
  await sql`DELETE FROM social_accounts WHERE workspace_id = ANY(${allowedIds})`
  await sql`DELETE FROM "member" WHERE organization_id = ANY(${allowedIds})`
  await sql`DELETE FROM "organization" WHERE id = ANY(${allowedIds})`

  return NextResponse.json({ success: true, deleted: allowedIds.length })
}
