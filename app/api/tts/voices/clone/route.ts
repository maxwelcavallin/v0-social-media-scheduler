import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

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

// POST — envia amostras ao ElevenLabs e cria Instant Voice Clone
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const workspaceId = await getWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY não configurada" }, { status: 500 })

  const body = await req.json()
  const { name, description, sample_urls } = body

  if (!name || !sample_urls?.length) {
    return NextResponse.json({ error: "Nome e ao menos 1 amostra são obrigatórios" }, { status: 400 })
  }

  // Baixa os arquivos do Blob e envia ao ElevenLabs como multipart
  const formData = new FormData()
  formData.append("name", name)
  if (description) formData.append("description", description)
  formData.append("labels", JSON.stringify({ workspace_id: workspaceId }))

  for (const url of sample_urls) {
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ error: `Falha ao baixar amostra: ${url}` }, { status: 400 })
    const blob = await res.blob()
    const filename = url.split("/").pop() || "sample.mp3"
    formData.append("files", blob, filename)
  }

  const cloneRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  })

  const cloneData = await cloneRes.json()

  if (!cloneRes.ok || !cloneData.voice_id) {
    console.error("[TTS Clone]", cloneData)
    return NextResponse.json(
      { error: cloneData?.detail?.message || cloneData?.detail || "Erro ao clonar voz no ElevenLabs" },
      { status: 400 }
    )
  }

  // Salva a voz clonada no banco
  const [voice] = await sql`
    INSERT INTO tts_voices (workspace_id, name, description, voice_type, eleven_voice_id, sample_url)
    VALUES (
      ${workspaceId},
      ${name},
      ${description ?? null},
      'cloned',
      ${cloneData.voice_id},
      ${sample_urls[0]}
    )
    RETURNING *
  `

  return NextResponse.json({ voice }, { status: 201 })
}
