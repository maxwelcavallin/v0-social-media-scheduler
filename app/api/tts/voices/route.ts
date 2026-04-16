import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export const dynamic = "force-dynamic"

// Busca o workspace_id do usuário
async function getWorkspaceId(userId: string): Promise<string | null> {
  const rows = await sql`
    SELECT o.id FROM organization o
    JOIN member m ON m.organization_id = o.id
    WHERE m.user_id = ${userId}
    LIMIT 1
  `
  return rows[0]?.id ?? null
}

// GET — lista vozes do workspace
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const workspaceId = await getWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ voices: [] })

  const voices = await sql`
    SELECT id, name, description, voice_type, eleven_voice_id, sample_url, settings, is_favorite, created_at
    FROM tts_voices
    WHERE workspace_id = ${workspaceId}
    ORDER BY is_favorite DESC, created_at DESC
  `

  return NextResponse.json({ voices })
}

// POST — cria nova voz (clone ou favorita de voz existente)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const workspaceId = await getWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 })

  const body = await req.json()
  const { name, description, voice_type, eleven_voice_id, sample_url, settings } = body

  if (!name || !voice_type) {
    return NextResponse.json({ error: "Nome e tipo são obrigatórios" }, { status: 400 })
  }

  const [voice] = await sql`
    INSERT INTO tts_voices (workspace_id, name, description, voice_type, eleven_voice_id, sample_url, settings)
    VALUES (
      ${workspaceId},
      ${name},
      ${description ?? null},
      ${voice_type},
      ${eleven_voice_id ?? null},
      ${sample_url ?? null},
      ${settings ? JSON.stringify(settings) : null}
    )
    RETURNING *
  `

  return NextResponse.json({ voice }, { status: 201 })
}
