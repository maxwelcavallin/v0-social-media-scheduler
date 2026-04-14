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

    // O Gemini TTS retorna PCM raw (audio/L16, 24kHz, mono) — precisa de header WAV para ser reproduzível
    let finalB64 = audioB64
    let finalMime = mimeType
    if (mimeType.includes("L16") || mimeType.includes("pcm") || mimeType.includes("raw")) {
      const pcmBuffer = Buffer.from(audioB64, "base64")
      finalB64 = pcmToWav(pcmBuffer, 24000, 1, 16).toString("base64")
      finalMime = "audio/wav"
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

    return NextResponse.json({ audioB64: finalB64, mimeType: finalMime })
  } catch (err: any) {
    console.error("[TTS] Erro:", err)
    return NextResponse.json({ error: err.message || "Erro inesperado" }, { status: 500 })
  }
}

// Converte buffer PCM raw para WAV com header RIFF correto
function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitDepth: number): Buffer {
  const byteRate = (sampleRate * channels * bitDepth) / 8
  const blockAlign = (channels * bitDepth) / 8
  const dataSize = pcm.length
  const header = Buffer.alloc(44)

  header.write("RIFF", 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)            // PCM chunk size
  header.writeUInt16LE(1, 20)             // AudioFormat = PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitDepth, 34)
  header.write("data", 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcm])
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
