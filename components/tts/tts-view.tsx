"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Mic,
  Play,
  Pause,
  Download,
  Loader2,
  Trash2,
  Volume2,
  ChevronRight,
  RotateCcw,
  History,
  Sparkles,
  Settings,
  ChevronRight as ChevronRightIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Vozes Gemini TTS disponíveis ────────────────────────────────────────────
const GEMINI_VOICES = [
  // Bright / energéticas
  { name: "Zephyr", value: "Zephyr", gender: "Feminino", character: "Brilhante" },
  { name: "Autonoe", value: "Autonoe", gender: "Feminino", character: "Brilhante" },
  { name: "Leda", value: "Leda", gender: "Feminino", character: "Jovial" },
  { name: "Aoede", value: "Aoede", gender: "Feminino", character: "Suave" },
  { name: "Callirrhoe", value: "Callirrhoe", gender: "Feminino", character: "Casual" },
  { name: "Despina", value: "Despina", gender: "Feminino", character: "Suave" },
  { name: "Erinome", value: "Erinome", gender: "Feminino", character: "Clara" },
  { name: "Gacrux", value: "Gacrux", gender: "Feminino", character: "Madura" },
  { name: "Sulafat", value: "Sulafat", gender: "Feminino", character: "Calorosa" },
  { name: "Vindemiatrix", value: "Vindemiatrix", gender: "Feminino", character: "Gentil" },
  { name: "Achernar", value: "Achernar", gender: "Feminino", character: "Suave" },
  { name: "Zubenelgenubi", value: "Zubenelgenubi", gender: "Feminino", character: "Casual" },
  // Masculinas
  { name: "Puck", value: "Puck", gender: "Masculino", character: "Animado" },
  { name: "Charon", value: "Charon", gender: "Masculino", character: "Informativo" },
  { name: "Fenrir", value: "Fenrir", gender: "Masculino", character: "Excitável" },
  { name: "Orus", value: "Orus", gender: "Masculino", character: "Firme" },
  { name: "Kore", value: "Kore", gender: "Masculino", character: "Firme" },
  { name: "Iapetus", value: "Iapetus", gender: "Masculino", character: "Claro" },
  { name: "Rasalgethi", value: "Rasalgethi", gender: "Masculino", character: "Informativo" },
  { name: "Sadachbia", value: "Sadachbia", gender: "Masculino", character: "Animado" },
  { name: "Sadaltager", value: "Sadaltager", gender: "Masculino", character: "Experiente" },
  { name: "Schedar", value: "Schedar", gender: "Masculino", character: "Gentil" },
  { name: "Umbriel", value: "Umbriel", gender: "Masculino", character: "Casual" },
  { name: "Algieba", value: "Algieba", gender: "Masculino", character: "Suave" },
  { name: "Alnilam", value: "Alnilam", gender: "Masculino", character: "Firme" },
  { name: "Altair", value: "Altair", gender: "Masculino", character: "Assertivo" },
  { name: "Oberon", value: "Oberon", gender: "Masculino", character: "Suave" },
  { name: "Pulcherrima", value: "Pulcherrima", gender: "Masculino", character: "Direto" },
  { name: "Wasat", value: "Wasat", gender: "Masculino", character: "Direto" },
]

// ─── Opções de configuração ───────────────────────────────────────────────────
const VOICE_STYLES = [
  { value: "natural", label: "Natural" },
  { value: "narration", label: "Narração" },
  { value: "news", label: "Jornalístico" },
  { value: "storytelling", label: "Contação de histórias" },
  { value: "conversational", label: "Conversacional" },
  { value: "promotional", label: "Promocional / Publicitário" },
  { value: "documentary", label: "Documentário" },
  { value: "audiobook", label: "Audiobook" },
  { value: "podcast", label: "Podcast" },
]

const VOICE_MATURITIES = [
  { value: "child", label: "Criança" },
  { value: "teen", label: "Adolescente" },
  { value: "young-adult", label: "Jovem adulto" },
  { value: "adult", label: "Adulto" },
  { value: "senior", label: "Sênior" },
]

const NARRATIVE_ROLES = [
  { value: "narrator", label: "Narrador" },
  { value: "host", label: "Apresentador" },
  { value: "character", label: "Personagem" },
  { value: "instructor", label: "Instrutor" },
  { value: "assistant", label: "Assistente" },
  { value: "announcer", label: "Locutor" },
  { value: "guide", label: "Guia turístico" },
]

const TONALITIES = [
  { value: "neutral", label: "Neutro" },
  { value: "energetic", label: "Energético" },
  { value: "calm", label: "Calmo" },
  { value: "serious", label: "Sério" },
  { value: "friendly", label: "Amigável" },
  { value: "authoritative", label: "Autoritário" },
  { value: "inspirational", label: "Inspirador" },
  { value: "empathetic", label: "Empático" },
  { value: "humorous", label: "Humorístico" },
  { value: "dramatic", label: "Dramático" },
]

interface HistoryItem {
  id: string
  text_preview: string
  voice_name: string
  config: {
    voiceStyle?: string
    voiceMaturity?: string
    narrativeRole?: string
    tonality?: string
  }
  created_at: string
}

export function TTSView() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [voiceName, setVoiceName] = useState("Puck")
  const [voiceStyle, setVoiceStyle] = useState("natural")
  const [voiceMaturity, setVoiceMaturity] = useState("adult")
  const [narrativeRole, setNarrativeRole] = useState("narrator")
  const [tonality, setTonality] = useState("neutral")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioB64, setAudioB64] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState("audio/wav")
  const [playing, setPlaying] = useState(false)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Carrega histórico
  useEffect(() => {
    fetch("/api/tts/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .finally(() => setHistoryLoading(false))
  }, [])

  const generate = async () => {
    if (!text.trim()) { setError("Insira um texto para gerar o áudio."); return }
    setLoading(true)
    setError(null)
    setAudioB64(null)
    setPlaying(false)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }

    try {
      const res = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName, voiceStyle, voiceMaturity, narrativeRole, tonality }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Erro ao gerar áudio"); return }
      setAudioB64(data.audioB64)
      setMimeType(data.mimeType || "audio/wav")
      // Atualiza histórico
      const h = await fetch("/api/tts/history").then((r) => r.json())
      setHistory(h.history || [])
    } catch (e: any) {
      setError(e.message || "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  const togglePlay = () => {
    if (!audioB64) return
    if (!audioRef.current) {
      const src = `data:${mimeType};base64,${audioB64}`
      const audio = new Audio(src)
      audio.onended = () => setPlaying(false)
      audioRef.current = audio
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  const download = () => {
    if (!audioB64) return
    const ext = mimeType.includes("mp3") ? "mp3" : mimeType.includes("ogg") ? "ogg" : "wav"
    const link = document.createElement("a")
    link.href = `data:${mimeType};base64,${audioB64}`
    link.download = `socialdog-tts-${Date.now()}.${ext}`
    link.click()
  }

  const deleteHistory = async (id: string) => {
    await fetch("/api/tts/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setHistory((prev) => prev.filter((h) => h.id !== id))
  }

  const reuseHistory = (item: HistoryItem) => {
    setVoiceName(item.voice_name)
    if (item.config.voiceStyle) setVoiceStyle(item.config.voiceStyle)
    if (item.config.voiceMaturity) setVoiceMaturity(item.config.voiceMaturity)
    if (item.config.narrativeRole) setNarrativeRole(item.config.narrativeRole)
    if (item.config.tonality) setTonality(item.config.tonality)
  }

  const femaleVoices = GEMINI_VOICES.filter((v) => v.gender === "Feminino")
  const maleVoices = GEMINI_VOICES.filter((v) => v.gender === "Masculino")

  const charCount = text.length
  const MAX_CHARS = 5000

  return (
    <div className="flex flex-col gap-6 p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Mic className="w-6 h-6 text-primary" />
            Text to Voice
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere áudios profissionais a partir de textos usando Inteligência Artificial
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Coluna principal */}
        <div className="flex flex-col gap-5">

          {/* Área de texto */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Texto para narrar
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="relative">
                <Textarea
                  placeholder="Cole ou escreva o texto que será narrado pela IA..."
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                  className="min-h-[220px] resize-none text-sm leading-relaxed pr-2"
                />
                <span className={cn(
                  "absolute bottom-3 right-3 text-xs",
                  charCount > MAX_CHARS * 0.9 ? "text-amber-500" : "text-muted-foreground"
                )}>
                  {charCount}/{MAX_CHARS}
                </span>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button onClick={generate} disabled={loading || !text.trim()} className="gap-2 self-end min-w-40">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Gerar áudio
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Player */}
          {audioB64 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-5">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0 shadow-md"
                  >
                    {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Volume2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Áudio gerado</span>
                      <Badge variant="secondary" className="text-xs">{voiceName}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{text.slice(0, 80)}{text.length > 80 ? "..." : ""}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={download} className="gap-1.5 shrink-0">
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </Button>
                </div>

                {/* Waveform decorativo */}
                <div className="flex items-center gap-0.5 mt-4 h-8 px-2">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1 rounded-full transition-all",
                        playing ? "bg-primary animate-pulse" : "bg-primary/30"
                      )}
                      style={{ height: `${20 + Math.sin(i * 0.5) * 14 + Math.cos(i * 0.3) * 8}%` }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configurações de voz */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configurações de voz</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Voz base */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Voz base</Label>
                <Select value={voiceName} onValueChange={setVoiceName}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(() => {
                        const v = GEMINI_VOICES.find(v => v.value === voiceName)
                        return v ? (
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{v.name}</span>
                            <span className="text-muted-foreground text-xs">{v.gender} · {v.character}</span>
                          </span>
                        ) : voiceName
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectGroup>
                      <SelectLabel>Vozes Femininas</SelectLabel>
                      {femaleVoices.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          <span className="font-medium">{v.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{v.character}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Vozes Masculinas</SelectLabel>
                      {maleVoices.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          <span className="font-medium">{v.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{v.character}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Estilo de voz */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Estilo de voz</Label>
                <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Maturidade */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Maturidade da voz</Label>
                <Select value={voiceMaturity} onValueChange={setVoiceMaturity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_MATURITIES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Papel na narrativa */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Papel na narrativa</Label>
                <Select value={narrativeRole} onValueChange={setNarrativeRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NARRATIVE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tom de voz */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Tom de voz</Label>
                <Select value={tonality} onValueChange={setTonality}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONALITIES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral — Configurar Vozes + Histórico */}
        <div className="flex flex-col gap-4">

          {/* Card: Configurar Vozes */}
          <Card
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => router.push("/dashboard/tts/voices")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Settings className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Configurar Vozes</p>
                  <p className="text-xs text-muted-foreground">
                    Clone e gerencie vozes do workspace
                  </p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                  <Mic className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum áudio gerado ainda</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {history.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 px-4 py-3 hover:bg-muted/40 group transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate leading-relaxed">
                          {item.text_preview || "Sem texto"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.voice_name}</Badge>
                          {item.config?.tonality && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {TONALITIES.find(t => t.value === item.config.tonality)?.label || item.config.tonality}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(item.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                            timeZone: "America/Sao_Paulo"
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => reuseHistory(item)}
                          title="Reutilizar configurações"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteHistory(item.id)}
                          title="Excluir"
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
