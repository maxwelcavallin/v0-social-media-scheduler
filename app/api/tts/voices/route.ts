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
    SELECT id, name, description, type, base_voice, voice_style, voice_maturity, narrative_role, tonality, sample_urls, preview_url, created_at
    FROM tts_voices
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
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
  const { name, description, type, base_voice, voice_style, voice_maturity, narrative_role, tonality, sample_urls, preview_url } = body

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  const [voice] = await sql`
    INSERT INTO tts_voices (workspace_id, name, description, type, base_voice, voice_style, voice_maturity, narrative_role, tonality, sample_urls, preview_url, created_by)
    VALUES (
      ${workspaceId},
      ${name},
      ${description ?? null},
      ${type ?? null},
      ${base_voice ?? null},
      ${voice_style ?? null},
      ${voice_maturity ?? null},
      ${narrative_role ?? null},
      ${tonality ?? null},
      ${sample_urls ? JSON.stringify(sample_urls) : null},
      ${preview_url ?? null},
      ${session.user.id}
    )
    RETURNING *
  `

  return NextResponse.json({ voice }, { status: 201 })
}
