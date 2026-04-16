"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Plus,
  Mic,
  Star,
  Trash2,
  Play,
  Pause,
  Upload,
  X,
  Loader2,
  AlertCircle,
  Music,
  Wand2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Voice = {
  id: string
  name: string
  description: string | null
  voice_style: "cloned" | "preset"
  eleven_voice_id: string | null
  sample_url: string | null
  settings: Record<string, any> | null
  is_favorite: boolean
  created_at: string
}

type UploadedFile = {
  url: string
  name: string
  size: number
}

// ─── Card de voz ─────────────────────────────────────────────────────────────
function VoiceCard({
  voice,
  onDelete,
  onToggleFavorite,
}: {
  voice: Voice
  onDelete: (id: string) => void
  onToggleFavorite: (id: string, current: boolean) => void
}) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlay = () => {
    if (!voice.sample_url) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    const audio = new Audio(voice.sample_url)
    audioRef.current = audio
    audio.play()
    setPlaying(true)
    audio.onended = () => setPlaying(false)
  }

  return (
    <Card className="group relative bg-card border-border hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{voice.name}</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs flex-shrink-0",
                    voice.voice_style === "cloned"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {voice.voice_style === "cloned" ? "Clonada" : "Preset"}
                </Badge>
              </div>
              {voice.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{voice.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {voice.sample_url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePlay}
                title={playing ? "Pausar" : "Ouvir amostra"}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", voice.is_favorite && "text-yellow-500")}
              onClick={() => onToggleFavorite(voice.id, voice.is_favorite)}
              title={voice.is_favorite ? "Remover dos favoritos" : "Marcar como favorito"}
            >
              <Star className={cn("w-4 h-4", voice.is_favorite && "fill-yellow-500")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(voice.id)}
              title="Excluir voz"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Zona de upload de amostras ───────────────────────────────────────────────
function SampleUploadZone({
  files,
  uploading,
  onAddFiles,
  onRemoveFile,
}: {
  files: UploadedFile[]
  uploading: boolean
  onAddFiles: (newFiles: File[]) => void
  onRemoveFile: (index: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("audio/")
      )
      if (droppedFiles.length) onAddFiles(droppedFiles)
    },
    [onAddFiles]
  )

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files || [])
            if (selected.length) onAddFiles(selected)
            e.target.value = ""
          }}
        />
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Arraste arquivos de áudio ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground mt-1">
          MP3, WAV, M4A, OGG, WebM — máx. 25MB por arquivo
        </p>
        <p className="text-xs text-muted-foreground">
          Recomendado: 1-3 min de áudio limpo, sem música de fundo
        </p>
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Enviando arquivos...</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/50 text-sm">
              <Music className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="truncate flex-1">{file.name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => onRemoveFile(i)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal de nova voz ────────────────────────────────────────────────────────
function NewVoiceDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [tab, setTab] = useState<"clone" | "preset">("clone")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>()
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleAddFiles = async (newFiles: File[]) => {
    setUploading(true)
    setError("")
    const results: UploadedFile[] = []
    for (const file of newFiles) {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/tts/voices/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Erro ao enviar arquivo"); continue }
      results.push({ url: data.url, name: data.name, size: data.size })
    }
    setUploadedFiles((prev) => [...(prev || []), ...results])
    setUploading(false)
  }

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev?.filter((_, i) => i !== index) || [])
  }

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome é obrigatório"); return }
    if (tab === "clone" && (!uploadedFiles || uploadedFiles.length === 0)) {
      setError("Adicione ao menos uma amostra de áudio")
      return
    }
    setSaving(true)
    setError("")
    try {
      if (tab === "clone") {
        const res = await fetch("/api/tts/voices/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            sample_urls: uploadedFiles?.map((f) => f.url),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao clonar voz")
      } else {
        const res = await fetch("/api/tts/voices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            voice_style: "preset",
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao salvar voz")
      }
      onCreated()
      handleClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setName("")
    setDescription("")
    setUploadedFiles([])
    setError("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar nova voz</DialogTitle>
          <DialogDescription>
            Clone uma voz a partir de amostras de áudio ou salve uma voz personalizada.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors",
              tab === "clone" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("clone")}
          >
            <Mic className="w-4 h-4" />
            Clonar voz
          </button>
          <button
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors",
              tab === "preset" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("preset")}
          >
            <Wand2 className="w-4 h-4" />
            Voz personalizada
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voice-name">Nome da voz</Label>
            <Input
              id="voice-name"
              placeholder="Ex: Narrador Comercial"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-desc">Descrição (opcional)</Label>
            <Textarea
              id="voice-desc"
              placeholder="Ex: Voz masculina, tom profissional para anúncios"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {tab === "clone" && (
            <div className="space-y-2">
              <Label>Amostras de voz</Label>
              <SampleUploadZone
                files={uploadedFiles || []}
                uploading={uploading}
                onAddFiles={handleAddFiles}
                onRemoveFile={handleRemoveFile}
              />
              <p className="text-xs text-muted-foreground">
                Quanto mais amostras e mais limpo o áudio, melhor será a qualidade do clone.
              </p>
            </div>
          )}

          {tab === "preset" && (
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              Uma voz personalizada sem clone pode ser usada para salvar configurações de estilo
              e identificar rapidamente a voz no seletor do TTS.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tab === "clone" ? "Clonar voz" : "Salvar voz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── View principal ───────────────────────────────────────────────────────────
export function VoicesView() {
  const router = useRouter()
  const { data, mutate, isLoading } = useSWR<{ voices: Voice[] }>("/api/tts/voices", fetcher)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const voices = data?.voices || []
  const favorites = voices.filter((v) => v.is_favorite)
  const others = voices.filter((v) => !v.is_favorite)

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta voz? Esta ação não pode ser desfeita.")) return
    setDeleting(id)
    await fetch(`/api/tts/voices/${id}`, { method: "DELETE" })
    mutate()
    setDeleting(null)
  }

  const handleToggleFavorite = async (id: string, current: boolean) => {
    await fetch(`/api/tts/voices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: !current }),
    })
    mutate()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/tts")}
          className="h-9 w-9"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Minhas Vozes</h1>
          <p className="text-sm text-muted-foreground">
            Clone vozes a partir de amostras de áudio e salve suas favoritas
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova voz
        </Button>
      </div>

      <Separator />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Vazio */}
      {!isLoading && voices.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Mic className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-medium">Nenhuma voz adicionada</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Clone uma voz a partir de amostras de áudio ou salve uma voz personalizada para usar no TTS.
          </p>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="mt-2">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar primeira voz
          </Button>
        </div>
      )}

      {/* Favoritos */}
      {favorites.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <h2 className="text-sm font-medium">Favoritas</h2>
            <Badge variant="secondary" className="text-xs">{favorites.length}</Badge>
          </div>
          <div className="space-y-2">
            {favorites.map((v) => (
              <VoiceCard
                key={v.id}
                voice={v}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Outras vozes */}
      {others.length > 0 && (
        <div className="space-y-3">
          {favorites.length > 0 && (
            <h2 className="text-sm font-medium text-muted-foreground">Todas as vozes</h2>
          )}
          <div className="space-y-2">
            {others.map((v) => (
              <VoiceCard
                key={v.id}
                voice={v}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Total */}
      {voices.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {voices.length} voz{voices.length !== 1 ? "es" : ""} no workspace
        </p>
      )}

      <NewVoiceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => mutate()}
      />
    </div>
  )
}
