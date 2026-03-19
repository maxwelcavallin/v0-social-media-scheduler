"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AccountSelector } from "@/components/posts/account-selector"
import {
  Upload,
  X,
  Loader2,
  CalendarDays,
  Send,
  Plus,
  Trash2,
  Film,
  ImageIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const schema = z.object({
  content: z.string().max(2200, "Legenda deve ter no máximo 2200 caracteres").optional(),
  postType: z.enum(["feed", "reel", "carousel", "story"]),
  scheduleType: z.enum(["now", "scheduled"]),
  accountIds: z.array(z.string()).min(1, "Selecione ao menos uma conta"),
})

type FormData = z.infer<typeof schema>

interface Account {
  id: string
  platform: string
  account_name: string
  account_username?: string
  profile_picture_url?: string
}

interface Props {
  workspaceId: string
  accounts: Account[]
  children?: React.ReactNode
}

const postTypeOptions = [
  { value: "feed", label: "Feed (Foto/Vídeo)" },
  { value: "reel", label: "Reel" },
  { value: "carousel", label: "Carrossel" },
  { value: "story", label: "Story" },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function toBrasiliaLocal(date: Date): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
  return fmt.format(date).replace(" ", "T")
}

function minDateStr() {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 5)
  return toBrasiliaLocal(d)
}

// ── component ─────────────────────────────────────────────────────────────────

export function CreatePostDialog({ workspaceId, accounts, children }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Media
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [uploadedMedia, setUploadedMedia] = useState<Array<{ url: string; type: string; name: string }> | null>(null)
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Multiple schedule dates
  const [scheduleDates, setScheduleDates] = useState<string[]>([""])

  const [charCount, setCharCount] = useState(0)

  const MAX_SIZE_MB = 15
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      postType: "feed",
      scheduleType: "now",
      accountIds: [],
    },
  })

  const scheduleType = watch("scheduleType")
  const accountIds = watch("accountIds") || []
  const postType = watch("postType")

  // ── media handlers ───────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const oversized = files.find((f) => f.size > MAX_SIZE_BYTES)
    if (oversized) {
      setError(`"${oversized.name}" excede o limite de ${MAX_SIZE_MB}MB.`)
      e.target.value = ""
      return
    }

    setError(null)
    const maxFiles = postType === "carousel" ? 10 : 1
    const newFiles = files.slice(0, maxFiles - mediaFiles.length)

    // Reset uploaded state when user changes media
    setUploadedMedia(null)
    setUploadedCoverUrl(null)

    const newMediaFiles = [...mediaFiles, ...newFiles].slice(0, maxFiles)
    setMediaFiles(newMediaFiles)
    const previews = newFiles.map((f) => URL.createObjectURL(f))
    setMediaPreviews((prev) => [...prev, ...previews].slice(0, maxFiles))

    // Auto-upload immediately when video is selected
    const hasVideo = newMediaFiles.some((f) => f.type.startsWith("video/"))
    if (hasVideo) {
      await uploadMediaFiles(newMediaFiles)
    }
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("A capa do reel deve ser uma imagem.")
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Capa excede o limite de ${MAX_SIZE_MB}MB.`)
      return
    }
    setError(null)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setUploadedCoverUrl(null)
  }

  const uploadMediaFiles = async (files: File[]) => {
    setIsUploadingMedia(true)
    setUploadProgress(0)
    setError(null)

    try {
      const results: Array<{ url: string; type: string; name: string }> = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const data = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          const formData = new FormData()
          formData.append("file", file)

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const filePct = Math.round((e.loaded / e.total) * 100)
              const overall = Math.round(((i + filePct / 100) / files.length) * 100)
              setUploadProgress(overall)
            }
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)) }
              catch { reject(new Error("Resposta inválida do servidor")) }
            } else {
              try {
                const err = JSON.parse(xhr.responseText)
                reject(new Error(err.error || `Erro ${xhr.status}`))
              } catch {
                reject(new Error(`Erro ${xhr.status} ao fazer upload`))
              }
            }
          }
          xhr.onerror = () => reject(new Error("Falha na conexão durante o upload"))
          xhr.ontimeout = () => reject(new Error("Tempo esgotado no upload"))
          xhr.timeout = 120000
          xhr.open("POST", "/api/media/upload")
          xhr.send(formData)
        })
        results.push({
          url: data.url,
          type: data.type || (file.type.startsWith("video") ? "video" : "image"),
          name: file.name,
        })
      }
      setUploadProgress(100)
      setUploadedMedia(results)
    } catch (err: any) {
      setError(err.message || "Erro ao fazer upload da mídia.")
      setUploadedMedia(null)
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const removeMedia = (idx: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== idx))
    setMediaPreviews((prev) => prev.filter((_, i) => i !== idx))
    setUploadedMedia(null)
  }

  // ── schedule date handlers ───────────────────────────────────────────────

  const addScheduleDate = () => {
    setScheduleDates((prev) => [...prev, ""])
  }

  const removeScheduleDate = (idx: number) => {
    setScheduleDates((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateScheduleDate = (idx: number, value: string) => {
    setScheduleDates((prev) => prev.map((d, i) => (i === idx ? value : d)))
  }

  // ── submit ───────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError(null)

    try {
      // Use already-uploaded media if available, otherwise upload now (image-only fast path)
      let finalMedia = uploadedMedia
      if (!finalMedia && mediaFiles.length > 0) {
        await uploadMediaFiles(mediaFiles)
        // uploadMediaFiles sets uploadedMedia via setState but we need the value now
        // so we do an inline upload here for images
        const results: Array<{ url: string; type: string; name: string }> = []
        for (const file of mediaFiles) {
          const formData = new FormData()
          formData.append("file", file)
          const res = await fetch("/api/media/upload", { method: "POST", body: formData })
          const uploadData = await res.json()
          if (!res.ok) throw new Error(uploadData.error || "Erro ao fazer upload")
          results.push({
            url: uploadData.url,
            type: uploadData.type || (file.type.startsWith("video") ? "video" : "image"),
            name: file.name,
          })
        }
        finalMedia = results
      }

      // Upload cover if reel + cover selected
      let finalCoverUrl = uploadedCoverUrl
      if (postType === "reel" && coverFile && !finalCoverUrl) {
        const formData = new FormData()
        formData.append("file", coverFile)
        const res = await fetch("/api/media/upload", { method: "POST", body: formData })
        const coverData = await res.json()
        if (!res.ok) throw new Error(coverData.error || "Erro ao fazer upload da capa")
        finalCoverUrl = coverData.url
        setUploadedCoverUrl(finalCoverUrl)
      }

      // Determine schedule dates
      const dates: Array<string | null> = data.scheduleType === "scheduled"
        ? scheduleDates
            .filter((d) => d.trim() !== "")
            .map((d) => {
              const hasTz = /[Z+\-]\d{2}:\d{2}$/.test(d) || d.endsWith("Z")
              return hasTz ? new Date(d).toISOString() : new Date(`${d}-03:00`).toISOString()
            })
        : [null]

      if (dates.length === 0) {
        setError("Adicione ao menos uma data de agendamento.")
        setLoading(false)
        return
      }

      // Create one post per scheduled date
      const errors: string[] = []
      for (const scheduledAt of dates) {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            content: data.content || "",
            postType: data.postType,
            scheduleType: data.scheduleType,
            scheduledAt,
            accountIds: data.accountIds,
            media: finalMedia || [],
            coverUrl: finalCoverUrl,
          }),
        })
        const json = await res.json()
        if (!res.ok) errors.push(json.error || "Erro ao criar post")
      }

      if (errors.length > 0) {
        setError(errors.join("; "))
        setLoading(false)
        return
      }

      handleClose()
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Erro inesperado. Tente novamente.")
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    reset()
    setMediaFiles([])
    setMediaPreviews([])
    setCoverFile(null)
    setCoverPreview(null)
    setUploadedMedia(null)
    setUploadedCoverUrl(null)
    setUploadProgress(0)
    setIsUploadingMedia(false)
    setScheduleDates([""])
    setCharCount(0)
    setError(null)
    setLoading(false)
  }

  const isVideoSelected = mediaFiles.some((f) => f.type.startsWith("video/"))
  const mediaReady = mediaFiles.length === 0 || (isVideoSelected ? (uploadedMedia !== null && !isUploadingMedia) : true)
  const minDate = minDateStr()

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Criar novo post</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <form onSubmit={handleSubmit(onSubmit)} id="post-form">
            <div className="px-6 py-4 flex flex-col gap-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {accounts.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Conecte pelo menos uma conta social antes de criar posts.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Accounts */}
                  <div className="flex flex-col gap-2">
                    <Label>Publicar em</Label>
                    <AccountSelector
                      accounts={accounts}
                      selected={accountIds}
                      onChange={(ids) => setValue("accountIds", ids)}
                      error={errors.accountIds?.message}
                    />
                  </div>

                  {/* Post Type */}
                  <div className="flex flex-col gap-2">
                    <Label>Formato do post</Label>
                    <Select
                      defaultValue="feed"
                      onValueChange={(v) => {
                        setValue("postType", v as any)
                        setMediaFiles([])
                        setMediaPreviews([])
                        setUploadedMedia(null)
                        setCoverFile(null)
                        setCoverPreview(null)
                        setUploadedCoverUrl(null)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {postTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ── Media Upload ─────────────────────────────────────── */}
                  <div className="flex flex-col gap-2">
                    <Label>
                      Mídia
                      <span className="text-xs text-muted-foreground ml-2 font-normal">
                        máx. {MAX_SIZE_MB}MB
                        {postType === "carousel" && " · até 10 itens"}
                        {postType === "reel" && " · somente vídeo"}
                      </span>
                    </Label>

                    {/* Upload loading overlay for video */}
                    {isUploadingMedia && (
                      <div className="flex flex-col gap-2 p-4 border border-border rounded-xl bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                          <div className="flex-1 flex flex-col gap-1">
                            <span className="text-sm font-medium">Enviando vídeo... {uploadProgress}%</span>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-200 rounded-full"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Aguarde o upload concluir antes de continuar.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Previews */}
                    {!isUploadingMedia && mediaPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {mediaPreviews.map((src, idx) => {
                          const isVid = mediaFiles[idx]?.type.startsWith("video/")
                          return (
                            <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group bg-black">
                              {isVid ? (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                  <Film className="w-8 h-8 text-muted-foreground" />
                                </div>
                              ) : (
                                <img src={src} alt="" className="w-full h-full object-cover" />
                              )}
                              {uploadedMedia && (
                                <div className="absolute bottom-1 left-1 bg-green-500/90 rounded-full p-0.5">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeMedia(idx)}
                                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={postType === "reel" ? "video/*" : "image/*,video/*"}
                      multiple={postType === "carousel"}
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {!isUploadingMedia && (postType !== "carousel" ? mediaPreviews.length < 1 : mediaPreviews.length < 10) && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                      >
                        <Upload className="w-6 h-6" />
                        <span className="text-sm">
                          {postType === "reel" ? "Selecionar vídeo" : "Selecionar imagem ou vídeo"}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* ── Reel cover image ─────────────────────────────────── */}
                  {postType === "reel" && !isUploadingMedia && mediaReady && mediaFiles.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <Label>
                        Capa do Reel
                        <span className="text-xs text-muted-foreground ml-2 font-normal">opcional · imagem estática</span>
                      </Label>

                      {coverPreview ? (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group">
                          <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => { setCoverFile(null); setCoverPreview(null); setUploadedCoverUrl(null) }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                        >
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-sm">Selecionar imagem de capa</span>
                        </button>
                      )}

                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverChange}
                      />
                    </div>
                  )}

                  {/* ── Caption ──────────────────────────────────────────── */}
                  {postType !== "story" && !isUploadingMedia && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Legenda</Label>
                        <span className={cn("text-xs", charCount > 2000 ? "text-destructive" : "text-muted-foreground")}>
                          {charCount}/2200
                        </span>
                      </div>
                      <Textarea
                        placeholder="Escreva sua legenda..."
                        className="resize-none min-h-[100px]"
                        {...register("content", {
                          onChange: (e) => setCharCount(e.target.value.length),
                        })}
                      />
                      {errors.content && (
                        <span className="text-xs text-destructive">{errors.content.message}</span>
                      )}
                    </div>
                  )}

                  {/* ── Schedule ─────────────────────────────────────────── */}
                  {!isUploadingMedia && (
                    <div className="flex flex-col gap-3">
                      <Label>Publicação</Label>
                      <Tabs
                        defaultValue="now"
                        onValueChange={(v) => {
                          setValue("scheduleType", v as "now" | "scheduled")
                          if (v === "scheduled" && scheduleDates.length === 0) {
                            setScheduleDates([""])
                          }
                        }}
                      >
                        <TabsList>
                          <TabsTrigger value="now" className="gap-2">
                            <Send className="w-3.5 h-3.5" />
                            Agora
                          </TabsTrigger>
                          <TabsTrigger value="scheduled" className="gap-2">
                            <CalendarDays className="w-3.5 h-3.5" />
                            Agendar
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="now">
                          <p className="text-sm text-muted-foreground mt-2">
                            O post será publicado imediatamente após a confirmação.
                          </p>
                        </TabsContent>

                        <TabsContent value="scheduled" className="mt-3">
                          <div className="flex flex-col gap-3">
                            {scheduleDates.map((date, idx) => (
                              <div key={idx} className="flex items-end gap-2">
                                <div className="flex-1 flex flex-col gap-1.5">
                                  {idx === 0 && <Label htmlFor={`schedule-${idx}`}>Data e hora</Label>}
                                  <Input
                                    id={`schedule-${idx}`}
                                    type="datetime-local"
                                    min={minDate}
                                    value={date}
                                    onChange={(e) => updateScheduleDate(idx, e.target.value)}
                                  />
                                </div>
                                {scheduleDates.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={() => removeScheduleDate(idx)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            ))}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 self-start"
                              onClick={addScheduleDate}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Adicionar outro horário
                            </Button>

                            {scheduleDates.length > 1 && (
                              <p className="text-xs text-muted-foreground">
                                Serão criados {scheduleDates.filter(d => d).length} agendamentos para o mesmo post.
                              </p>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </>
              )}
            </div>
          </form>
        </ScrollArea>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading || isUploadingMedia}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="post-form"
            disabled={loading || isUploadingMedia || accounts.length === 0 || (isVideoSelected && !uploadedMedia)}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {scheduleType === "now" ? "Publicando..." : "Agendando..."}
              </>
            ) : isUploadingMedia ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando mídia...
              </>
            ) : scheduleType === "now" ? (
              <>
                <Send className="w-4 h-4" />
                Publicar
              </>
            ) : (
              <>
                <CalendarDays className="w-4 h-4" />
                {scheduleDates.filter(d => d).length > 1
                  ? `Agendar ${scheduleDates.filter(d => d).length} posts`
                  : "Agendar"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
