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
  ImageIcon,
  Upload,
  X,
  Loader2,
  CalendarDays,
  Send,
  Film,
} from "lucide-react"
import { upload } from "@vercel/blob/client"
import { cn } from "@/lib/utils"

const schema = z.object({
  content: z.string().max(2200, "Legenda deve ter no máximo 2200 caracteres").optional(),
  postType: z.enum(["feed", "reel", "carousel", "story"]),
  scheduleType: z.enum(["now", "scheduled"]),
  scheduledAt: z.string().optional(),
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

interface UploadedMedia {
  url: string
  type: string
  name: string
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

const MAX_SIZE_MB = 15
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

// Upload directly from browser to Vercel Blob (bypasses the 4.5MB serverless limit entirely)
async function uploadFileWithProgress(
  file: File,
  onProgress: (pct: number) => void
): Promise<UploadedMedia> {
  const ext = file.name.split(".").pop() || "bin"
  const pathname = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/media/upload",
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  })

  return {
    url: blob.url,
    type: file.type.startsWith("video") ? "video" : "image",
    name: file.name,
  }
}

export function CreatePostDialog({ workspaceId, accounts, children }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Uploaded media state — populated as soon as files are selected
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([])

  // Upload in progress state (shown while a file is being uploaded)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFileName, setUploadingFileName] = useState("")

  // Reel cover image
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploadedCover, setUploadedCover] = useState<UploadedMedia | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverProgress, setCoverProgress] = useState(0)

  const [charCount, setCharCount] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { postType: "feed", scheduleType: "now", accountIds: [] },
  })

  const scheduleType = watch("scheduleType")
  const accountIds = watch("accountIds") || []
  const postType = watch("postType")

  // ── File selection → immediate upload ──────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    e.target.value = ""

    const oversized = files.find((f) => f.size > MAX_SIZE_BYTES)
    if (oversized) {
      setError(`"${oversized.name}" excede o limite de ${MAX_SIZE_MB}MB.`)
      return
    }
    setError(null)

    const maxFiles = postType === "carousel" ? 10 : 1
    const toUpload = files.slice(0, maxFiles - uploadedMedia.length)

    for (const file of toUpload) {
      setUploading(true)
      setUploadProgress(0)
      setUploadingFileName(file.name)

      // Show local preview immediately
      const localPreview = URL.createObjectURL(file)
      setMediaPreviews((prev) => [...prev, localPreview].slice(0, maxFiles))

      try {
        const uploaded = await uploadFileWithProgress(file, (pct) => setUploadProgress(pct))
        setUploadedMedia((prev) => [...prev, uploaded].slice(0, maxFiles))
      } catch (err: any) {
        setError(err.message || "Erro ao fazer upload da mídia")
        setMediaPreviews((prev) => prev.filter((p) => p !== localPreview))
      } finally {
        setUploading(false)
        setUploadProgress(0)
        setUploadingFileName("")
      }
    }
  }

  // ── Cover image for reels ───────────────────────────────────────────────────
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (file.size > MAX_SIZE_BYTES) {
      setError(`Capa excede o limite de ${MAX_SIZE_MB}MB.`)
      return
    }
    setError(null)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setUploadingCover(true)
    setCoverProgress(0)

    try {
      const uploaded = await uploadFileWithProgress(file, (pct) => setCoverProgress(pct))
      setUploadedCover(uploaded)
    } catch (err: any) {
      setError(err.message || "Erro ao fazer upload da capa")
      setCoverFile(null)
      setCoverPreview(null)
    } finally {
      setUploadingCover(false)
      setCoverProgress(0)
    }
  }

  const removeMedia = (idx: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== idx))
    setMediaPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const removeCover = () => {
    setCoverFile(null)
    setCoverPreview(null)
    setUploadedCover(null)
  }

  const handleClose = (v: boolean) => {
    if (uploading || submitting) return
    setOpen(v)
    if (!v) {
      reset()
      setUploadedMedia([])
      setMediaPreviews([])
      setCoverFile(null)
      setCoverPreview(null)
      setUploadedCover(null)
      setError(null)
      setCharCount(0)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    if (uploading || uploadingCover) {
      setError("Aguarde o upload da mídia terminar antes de publicar.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          content: data.content || "",
          postType: data.postType,
          scheduleType: data.scheduleType,
          scheduledAt: data.scheduledAt,
          accountIds: data.accountIds,
          media: uploadedMedia,
          coverMedia: uploadedCover || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Erro ao criar post")
        return
      }

      handleClose(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Erro inesperado. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  // Convert a Date to "YYYY-MM-DDTHH:mm" in America/Sao_Paulo timezone
  const toBrasiliaLocal = (date: Date): string => {
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    })
    return fmt.format(date).replace(" ", "T")
  }

  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 5)
  const minDateStr = toBrasiliaLocal(minDate)

  const isUploading = uploading || uploadingCover
  const canSubmit = !isUploading && !submitting && accounts.length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
                  {/* Publicar em */}
                  <div className="flex flex-col gap-2">
                    <Label>Publicar em</Label>
                    <AccountSelector
                      accounts={accounts}
                      selected={accountIds}
                      onChange={(ids) => setValue("accountIds", ids)}
                      error={errors.accountIds?.message}
                    />
                  </div>

                  {/* Formato */}
                  <div className="flex flex-col gap-2">
                    <Label>Formato do post</Label>
                    <Select
                      defaultValue="feed"
                      onValueChange={(v) => {
                        setValue("postType", v as any)
                        setUploadedMedia([])
                        setMediaPreviews([])
                        setCoverFile(null)
                        setCoverPreview(null)
                        setUploadedCover(null)
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

                  {/* Mídia principal */}
                  <div className="flex flex-col gap-2">
                    <Label>
                      Mídia
                      <span className="text-xs text-muted-foreground ml-2 font-normal">
                        máx. {MAX_SIZE_MB}MB · imagem ou vídeo
                        {postType === "carousel" && " · até 10 itens"}
                      </span>
                    </Label>

                    {/* Previews */}
                    {mediaPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {mediaPreviews.map((src, idx) => {
                          const isVideo = uploadedMedia[idx]?.type === "video"
                          return (
                            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group bg-black">
                              {isVideo ? (
                                <video src={src} className="w-full h-full object-cover" muted />
                              ) : (
                                <img src={src} alt="" className="w-full h-full object-cover" />
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

                    {/* Upload progress overlay */}
                    {uploading && (
                      <div className="flex flex-col gap-2 p-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="truncate">Enviando <strong>{uploadingFileName}</strong>...</span>
                          <span className="ml-auto font-medium text-primary">{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-150 rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Aguarde o upload terminar para continuar.
                        </p>
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

                    {!uploading && (postType !== "carousel" ? uploadedMedia.length < 1 : uploadedMedia.length < 10) && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                      >
                        <Upload className="w-6 h-6" />
                        <span className="text-sm">
                          {postType === "reel"
                            ? "Selecionar vídeo do reel"
                            : postType === "story"
                            ? "Selecionar imagem ou vídeo"
                            : postType === "carousel"
                            ? "Adicionar imagens/vídeos"
                            : "Selecionar mídia"}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Capa do Reel */}
                  {postType === "reel" && (
                    <div className="flex flex-col gap-2">
                      <Label>
                        Imagem de capa
                        <span className="text-xs text-muted-foreground ml-2 font-normal">
                          opcional · JPG ou PNG · máx. {MAX_SIZE_MB}MB
                        </span>
                      </Label>

                      {coverPreview ? (
                        <div className="flex items-center gap-3">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                            <img src={coverPreview} alt="Capa do reel" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={removeCover}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                          {uploadingCover && (
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Enviando capa...</span>
                                <span>{coverProgress}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${coverProgress}%` }} />
                              </div>
                            </div>
                          )}
                          {!uploadingCover && uploadedCover && (
                            <span className="text-xs text-muted-foreground">Capa pronta</span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          className="flex items-center gap-2 border border-dashed border-border rounded-xl px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-all w-fit"
                        >
                          <Film className="w-4 h-4" />
                          Escolher imagem de capa
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

                  {/* Legenda — não exibida para stories */}
                  {postType !== "story" && (
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

                  {/* Agendamento */}
                  <div className="flex flex-col gap-3">
                    <Label>Publicação</Label>
                    <Tabs
                      defaultValue="now"
                      onValueChange={(v) => setValue("scheduleType", v as "now" | "scheduled")}
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
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="scheduledAt">Data e hora (horário de Brasília)</Label>
                          <Input
                            id="scheduledAt"
                            type="datetime-local"
                            min={minDateStr}
                            {...register("scheduledAt")}
                          />
                          {errors.scheduledAt && (
                            <span className="text-xs text-destructive">{errors.scheduledAt.message}</span>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </>
              )}
            </div>
          </form>
        </ScrollArea>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting || uploading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="post-form"
            disabled={!canSubmit}
            className="gap-2 min-w-32"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando mídia...
              </>
            ) : submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {scheduleType === "now" ? "Publicando..." : "Agendando..."}
              </>
            ) : scheduleType === "now" ? (
              <>
                <Send className="w-4 h-4" />
                Publicar
              </>
            ) : (
              <>
                <CalendarDays className="w-4 h-4" />
                Agendar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
