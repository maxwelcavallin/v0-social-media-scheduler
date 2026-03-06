import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { put } from "@vercel/blob"

// Allow up to 60s for large file uploads
export const maxDuration = 60

// Next.js body size limit — must match our 15MB cap
export const config = {
  api: {
    bodyParser: false,
  },
}

const MAX_SIZE_MB = 15
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/mov", "video/mpeg", "video/webm"]
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  }

  // Type validation
  const mimeType = file.type.toLowerCase()
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: `Tipo de arquivo não suportado. Envie imagens (JPG, PNG, GIF, WebP) ou vídeos (MP4, MOV, WebM).` },
      { status: 400 }
    )
  }

  // Size validation — 15MB for all types
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Arquivo muito grande. O limite é ${MAX_SIZE_MB}MB.` },
      { status: 400 }
    )
  }

  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType)
  const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg")
  const filename = `posts/${session.user.id}/${Date.now()}.${ext}`

  // Pass file directly to Vercel Blob (File extends Blob, fully supported)
  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  })

  return NextResponse.json({
    url: blob.url,
    pathname: blob.pathname,
    type: isVideo ? "video" : "image",
    size: file.size,
  })
}
