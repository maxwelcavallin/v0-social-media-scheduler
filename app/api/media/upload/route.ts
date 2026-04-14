import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

export const maxDuration = 60

const MAX_SIZE_MB = 500
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/mov", "video/mpeg", "video/webm"]
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

// This route handles the Vercel Blob client-side upload token generation.
// The file goes directly from the browser to Vercel Blob — never through the serverless function.
// This bypasses the 4.5MB function payload limit entirely.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate file type from pathname extension
        const ext = pathname.split(".").pop()?.toLowerCase() || ""
        const videoExts = ["mp4", "mov", "mpeg", "webm", "quicktime"]
        const imageExts = ["jpg", "jpeg", "png", "gif", "webp"]
        const isVideo = videoExts.includes(ext)
        const isImage = imageExts.includes(ext)

        if (!isVideo && !isImage) {
          throw new Error("Tipo de arquivo não suportado. Envie imagens (JPG, PNG, GIF, WebP) ou vídeos (MP4, MOV, WebM).")
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          tokenPayload: JSON.stringify({
            userId: session.user.id,
            isVideo,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called after upload completes — can update DB here if needed
        console.log("[upload] completed:", blob.url, tokenPayload)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
