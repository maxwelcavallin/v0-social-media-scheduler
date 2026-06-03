import { put } from "@vercel/blob"

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "video/mp4":  "mp4",
}

export interface McpMediaInput {
  type: "image" | "video"
  // Opção A — URL pública
  url?: string
  // Opção B — base64
  media_type?: string
  data?: string
}

export interface ResolvedMedia {
  url: string          // URL pública permanente no Vercel Blob
  media_type: "image" | "video"
}

/**
 * Faz o download da mídia (URL ou base64), valida o tipo e sobe para o Vercel Blob.
 * Retorna a URL pública permanente que as APIs do Instagram/Facebook conseguem acessar.
 */
export async function uploadMcpMedia(
  item: McpMediaInput,
  postId: string,
  index: number
): Promise<ResolvedMedia> {
  let buffer: Buffer
  let mimeType: string

  if (item.url) {
    // Opção A — download da URL pública
    const res = await fetch(item.url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`Falha ao baixar mídia (${res.status}): ${item.url}`)
    const contentType = res.headers.get("content-type")?.split(";")[0].trim() ?? ""
    mimeType = contentType || (item.type === "video" ? "video/mp4" : "image/jpeg")
    buffer = Buffer.from(await res.arrayBuffer())
  } else if (item.data && item.media_type) {
    // Opção B — base64
    mimeType = item.media_type
    buffer = Buffer.from(item.data, "base64")
  } else {
    throw new Error(`Item de mídia ${index + 1} inválido: forneça 'url' ou ('data' + 'media_type').`)
  }

  if (!ALLOWED_MIME[mimeType]) {
    throw new Error(
      `Tipo de mídia não suportado: ${mimeType}. Tipos aceitos: ${Object.keys(ALLOWED_MIME).join(", ")}`
    )
  }

  const ext = ALLOWED_MIME[mimeType]
  const filename = `mcp/${postId}/${index}.${ext}`

  const blob = await put(filename, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  })

  const mediaType: "image" | "video" = mimeType.startsWith("video") ? "video" : "image"
  return { url: blob.url, media_type: mediaType }
}
