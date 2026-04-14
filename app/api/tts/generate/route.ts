import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const {
    text,
    voiceName,
    voiceStyle,
    voiceMaturity,
    narrativeRole,
    tonality,
    provider = "gemini",
  } = await req.json()

  if (!text || !voiceName) {
    return NextResponse.json({ error: "Texto e voz são obrigatórios" }, { status: 400 })
  }

  try {
    // Monta o prompt de configuração de voz a partir das opções selecionadas
    const styleInstructions = buildStyleInstructions({ voiceStyle, voiceMaturity, narrativeRole, tonality })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 })

    // Gemini TTS via REST
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: styleInstructions ? `${styleInstructions}\n\n${text}` : text }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.json()
      return NextResponse.json({ error: err?.error?.message || "Erro na API Gemini" }, { status: 502 })
    }

    const geminiData = await geminiRes.json()
    const audioB64 = geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    const mimeType = geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "audio/wav"

    if (!audioB64) {
      return NextResponse.json({ error: "Gemini não retornou áudio" }, { status: 502 })
    }

    // Salva no histórico
    const config = { voiceName, voiceStyle, voiceMaturity, narrativeRole, tonality, provider }
    const textPreview = text.slice(0, 200)
    await sql`
      INSERT INTO tts_history
        (user_id, text, voice, voice_style, voice_maturity, narrative_role, tone, text_preview, full_text, voice_name, config)
      VALUES
        (${session.user.id}, ${text}, ${voiceName}, ${voiceStyle ?? null}, ${voiceMaturity ?? null}, ${narrativeRole ?? null}, ${tonality ?? null}, ${textPreview}, ${text}, ${voiceName}, ${JSON.stringify(config)})
    `

    return NextResponse.json({ audioB64, mimeType })
  } catch (err: any) {
    console.error("[TTS] Erro:", err)
    return NextResponse.json({ error: err.message || "Erro inesperado" }, { status: 500 })
  }
}

function buildStyleInstructions({
  voiceStyle,
  voiceMaturity,
  narrativeRole,
  tonality,
}: {
  voiceStyle?: string
  voiceMaturity?: string
  narrativeRole?: string
  tonality?: string
}) {
  const parts: string[] = []
  if (voiceStyle) parts.push(`Estilo de fala: ${voiceStyle}.`)
  if (voiceMaturity) parts.push(`Maturidade da voz: ${voiceMaturity}.`)
  if (narrativeRole) parts.push(`Papel na narrativa: ${narrativeRole}.`)
  if (tonality) parts.push(`Tom de voz: ${tonality}.`)
  if (parts.length === 0) return ""
  return `Por favor, narre o seguinte texto com as seguintes características de voz:\n${parts.join(" ")}`
}
