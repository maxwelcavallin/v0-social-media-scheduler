import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { del } from "@vercel/blob"

export const dynamic = "force-dynamic"

async function getWorkspaceId(userId: string): Promise<string | null> {
  const rows = await sql`
    SELECT o.id FROM organization o
    JOIN member m ON m.organization_id = o.id
    WHERE m.user_id = ${userId}
    LIMIT 1
  `
  return rows[0]?.id ?? null
}

// PATCH — atualiza nome, descrição, settings ou toggle favorito
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ voiceId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { voiceId } = await params
  const workspaceId = await getWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 })

  const body = await req.json()
  const { name, description, settings, is_favorite } = body

  const [voice] = await sql`
    UPDATE tts_voices
    SET
      name = COALESCE(${name ?? null}, name),
      description = COALESCE(${description ?? null}, description),
      settings = COALESCE(${settings ? JSON.stringify(settings) : null}::jsonb, settings),
      is_favorite = COALESCE(${is_favorite ?? null}, is_favorite),
      updated_at = NOW()
    WHERE id = ${voiceId} AND workspace_id = ${workspaceId}
    RETURNING *
  `

  if (!voice) return NextResponse.json({ error: "Voz não encontrada" }, { status: 404 })

  return NextResponse.json({ voice })
}

// DELETE — remove voz e arquivo do Blob se existir
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ voiceId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { voiceId } = await params
  const workspaceId = await getWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 })

  const [voice] = await sql`
    SELECT * FROM tts_voices WHERE id = ${voiceId} AND workspace_id = ${workspaceId}
  `
  if (!voice) return NextResponse.json({ error: "Voz não encontrada" }, { status: 404 })

  // Remove arquivo de amostra do Blob se existir
  if (voice.sample_url) {
    try { await del(voice.sample_url) } catch { /* ignorado */ }
  }

  await sql`DELETE FROM tts_voices WHERE id = ${voiceId} AND workspace_id = ${workspaceId}`

  return NextResponse.json({ success: true })
}
