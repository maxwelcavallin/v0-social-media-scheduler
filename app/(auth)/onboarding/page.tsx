"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Building2 } from "lucide-react"

const schema = z.object({
  name: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres"),
  document_type: z.enum(["cpf", "cnpj"]),
  document: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function formatDocument(value: string, type: "cpf" | "cnpj") {
  const digits = value.replace(/\D/g, "")
  if (type === "cpf") {
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  }
  return digits
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

export default function OnboardingPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [docValue, setDocValue] = useState("")

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { document_type: "cnpj" },
  })

  const docType = watch("document_type")

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDocument(e.target.value, docType)
    setDocValue(formatted)
    setValue("document", formatted)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Erro ao criar empresa.")
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Erro inesperado. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Image src="/logo-dog.png" alt="SocialDog" width={36} height={36} className="rounded-xl" />
          <span className="font-bold text-xl text-foreground">SocialDog</span>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Configure sua empresa</CardTitle>
            <CardDescription>
              Estes dados são necessários para organizar seus workspaces e contratar planos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Nome da empresa</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Acme Ltda."
                  {...register("name")}
                />
                {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Tipo de documento</Label>
                <div className="flex gap-2">
                  {(["cnpj", "cpf"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setValue("document_type", type)
                        setDocValue("")
                        setValue("document", "")
                      }}
                      className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                        docType === type
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-input hover:bg-muted"
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="document">{docType === "cnpj" ? "CNPJ" : "CPF"}</Label>
                <Input
                  id="document"
                  type="text"
                  placeholder={docType === "cnpj" ? "00.000.000/0001-00" : "000.000.000-00"}
                  value={docValue}
                  onChange={handleDocChange}
                />
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</>
                  : "Continuar para o dashboard"
                }
              </Button>

              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="text-xs text-muted-foreground text-center hover:underline"
              >
                Pular por agora
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
