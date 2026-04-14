import { NextRequest, NextResponse } from "next/server"
import { del, put } from "@vercel/blob"
import sql from "@/lib/db"
import sharp from "sharp"

export const maxDuration = 300 // 5 min — pode ter muitos arquivos

// Segurança: só aceita chamada do cron da Vercel ou com CRON_SECRET
function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev sem secret configurado
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

const DAYS_TO_KEEP = 60
const PREVIEW_WIDTH = 800 // px — largura máxima do preview de imagem

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  // Busca mídias elegíveis: criadas há mais de 60 dias, ainda não limpas
  const candidates = await sql`
    SELECT id, url, media_type
    FROM post_media
    WHERE
      cleaned_at IS NULL
      AND url IS NOT NULL
      AND url != ''
      AND created_at < NOW() - INTERVAL '${DAYS_TO_KEEP} days'
    LIMIT 50
  `

  if (candidates.length === 0) {
    return NextResponse.json({ cleaned: 0, message: "Nenhuma mídia elegível para limpeza." })
  }

  let cleaned = 0
  let errors = 0

  for (const media of candidates) {
    try {
      let previewUrl: string | null = null

      if (media.media_type === "image") {
        // Baixa a imagem original e gera preview comprimido via sharp
        const res = await fetch(media.url)
        if (!res.ok) throw new Error(`Falha ao baixar: ${res.status}`)

        const original = Buffer.from(await res.arrayBuffer())

        // Redimensiona para max 800px e converte para JPEG com qualidade 70
        const preview = await sharp(original)
          .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer()

        // Deriva o pathname original para nomear o preview
        const originalPathname = new URL(media.url).pathname
        const baseName = originalPathname.replace(/\.[^.]+$/, "")
        const previewPathname = `${baseName}_preview.jpg`

        const blob = await put(previewPathname, preview, {
          access: "public",
          contentType: "image/jpeg",
        })
        previewUrl = blob.url
      }
      // Vídeos: não geramos preview (requereria ffmpeg) — apenas deletamos e marcamos como limpo
      // previewUrl permanece null para vídeos

      // Deleta o arquivo original do Blob
      await del(media.url)

      // Atualiza o banco com preview_url e cleaned_at
      await sql`
        UPDATE post_media
        SET
          preview_url = ${previewUrl},
          cleaned_at = NOW()
        WHERE id = ${media.id}
      `

      cleaned++
    } catch (err: any) {
      console.error(`[media-cleanup] Erro no item ${media.id}:`, err.message)
      errors++
    }
  }

  return NextResponse.json({
    cleaned,
    errors,
    message: `${cleaned} arquivo(s) limpos, ${errors} erro(s).`,
  })
}
