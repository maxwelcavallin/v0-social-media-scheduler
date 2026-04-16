import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { put } from "@vercel/blob"

export const dynamic = "force-dynamic"

const ACCEPTED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/ogg", "audio/webm"]
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB por arquivo, igual ElevenLabs

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Aceito: MP3, WAV, MP4, M4A, OGG, WebM" },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo: 25MB" }, { status: 400 })
  }

  const ext = file.name.split(".").pop() || "mp3"
  const filename = `tts-voices/${session.user.id}/${Date.now()}.${ext}`

  const blob = await put(filename, file, { access: "public" })

  return NextResponse.json({ url: blob.url, size: file.size, name: file.name })
}
