"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

const schema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(50),
  slug: z
    .string()
    .min(2, "Slug deve ter pelo menos 2 caracteres")
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
})

type FormData = z.infer<typeof schema>

interface Props {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function CreateWorkspaceDialog({ open: controlledOpen, onOpenChange, children }: Props) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (onOpenChange ?? setInternalOpen) : setInternalOpen

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const nameValue = watch("name", "")

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30)
    setValue("slug", slug)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "Erro ao criar workspace")
        setLoading(false)
        return
      }

      setOpen(false)
      reset()
      router.refresh()
      router.push(`/workspace/${json.id}`)
    } catch {
      setError("Erro inesperado. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar novo workspace</DialogTitle>
          <DialogDescription>
            Um workspace representa um cliente ou projeto. Você poderá conectar contas sociais a ele.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">Nome do workspace</Label>
            <Input
              id="ws-name"
              placeholder="Ex: Empresa ABC, Cliente XYZ..."
              {...register("name", {
                onChange: handleNameChange,
              })}
            />
            {errors.name && (
              <span className="text-xs text-destructive">{errors.name.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-slug">Identificador (slug)</Label>
            <div className="flex items-center">
              <span className="px-3 h-9 border border-r-0 border-input rounded-l-md bg-muted text-muted-foreground text-sm flex items-center">
                postflow.app/
              </span>
              <Input
                id="ws-slug"
                className="rounded-l-none"
                placeholder="empresa-abc"
                {...register("slug")}
              />
            </div>
            {errors.slug && (
              <span className="text-xs text-destructive">{errors.slug.message}</span>
            )}
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                "Criar workspace"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
