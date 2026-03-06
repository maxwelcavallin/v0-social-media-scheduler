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
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Instagram,
  Facebook,
  ImageIcon,
  Upload,
  X,
  Loader2,
  CalendarDays,
  Send,
} from "lucide-react"
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

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-4 h-4" style={{ color: "oklch(0.52 0.25 15)" }} />,
  facebook: <Facebook className="w-4 h-4" style={{ color: "oklch(0.46 0.18 242)" }} />,
}

const platformColors: Record<string, string> = {
  instagram: "border-[oklch(0.52_0.25_15)]",
  facebook: "border-[oklch(0.46_0.18_242)]",
}

export function CreatePostDialog({ workspaceId, accounts, children }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
  const [charCount, setCharCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const maxFiles = postType === "carousel" ? 10 : 1
    const newFiles = files.slice(0, maxFiles - mediaFiles.length)

    setMediaFiles((prev) => [...prev, ...newFiles].slice(0, maxFiles))
    const previews = newFiles.map((f) => URL.createObjectURL(f))
    setMediaPreviews((prev) => [...prev, ...previews].slice(0, maxFiles))
  }

  const removeMedia = (idx: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== idx))
    setMediaPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const toggleAccount = (accountId: string) => {
    const current = accountIds
    if (current.includes(accountId)) {
      setValue("accountIds", current.filter((id) => id !== accountId))
    } else {
      setValue("accountIds", [...current, accountId])
    }
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError(null)

    try {
      // Upload media
      const uploadedMedia: Array<{ url: string; type: string; name: string }> = []
      for (const file of mediaFiles) {
        const formData = new FormData()
        formData.append("file", file)
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        })
        if (!uploadRes.ok) {
          setError("Erro ao fazer upload da mídia")
          setLoading(false)
          return
        }
        const uploadData = await uploadRes.json()
        uploadedMedia.push({ url: uploadData.url, type: file.type.startsWith("video") ? "video" : "image", name: file.name })
      }

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
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "Erro ao criar post")
        setLoading(false)
        return
      }

      setOpen(false)
      reset()
      setMediaFiles([])
      setMediaPreviews([])
      router.refresh()
    } catch {
      setError("Erro inesperado. Tente novamente.")
      setLoading(false)
    }
  }

  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 5)
  const minDateStr = minDate.toISOString().slice(0, 16)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                  {/* Platform Selection */}
                  <div className="flex flex-col gap-2">
                    <Label>Publicar em</Label>
                    <div className="flex flex-wrap gap-2">
                      {accounts.map((acc) => {
                        const selected = accountIds.includes(acc.id)
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => toggleAccount(acc.id)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                              selected
                                ? cn("bg-accent", platformColors[acc.platform] || "border-primary")
                                : "border-border hover:border-muted-foreground/40"
                            )}
                          >
                            {platformIcons[acc.platform]}
                            <span className="text-foreground">{acc.account_name}</span>
                            {selected && (
                              <Badge variant="secondary" className="text-xs px-1 py-0">✓</Badge>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {errors.accountIds && (
                      <span className="text-xs text-destructive">{errors.accountIds.message}</span>
                    )}
                  </div>

                  {/* Post Type */}
                  <div className="flex flex-col gap-2">
                    <Label>Formato do post</Label>
                    <Select
                      defaultValue="feed"
                      onValueChange={(v) => setValue("postType", v as any)}
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

                  {/* Media Upload */}
                  <div className="flex flex-col gap-2">
                    <Label>
                      Mídia
                      {postType === "carousel" && (
                        <span className="text-xs text-muted-foreground ml-2">máx. 10 itens</span>
                      )}
                    </Label>

                    {mediaPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {mediaPreviews.map((src, idx) => (
                          <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                            <img src={src} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeMedia(idx)}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
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

                    {(postType !== "carousel" ? mediaPreviews.length < 1 : mediaPreviews.length < 10) && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                      >
                        <Upload className="w-6 h-6" />
                        <span className="text-sm">
                          {postType === "reel" ? "Selecionar vídeo" : "Selecionar imagem"}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Caption */}
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

                  {/* Schedule */}
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
                          <Label htmlFor="scheduledAt">Data e hora</Label>
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
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="post-form"
            disabled={loading || accounts.length === 0}
            className="gap-2"
          >
            {loading ? (
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
