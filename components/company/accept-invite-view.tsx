"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Loader2, UserCheck } from "lucide-react"
import Link from "next/link"

interface Props {
  token: string
  invitation: { email: string; role: string; company_name: string }
  isLoggedIn: boolean
  currentUserEmail: string | null
}

export function AcceptInviteView({ token, invitation, isLoggedIn, currentUserEmail }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailMatch = !currentUserEmail || currentUserEmail.toLowerCase() === invitation.email.toLowerCase()

  const onAccept = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/company/invitations/${token}`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { setError(json.error || "Erro ao aceitar convite."); return }
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Erro inesperado.")
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
            <CardTitle className="text-xl">Convite para empresa</CardTitle>
            <CardDescription>
              Você foi convidado para entrar em{" "}
              <span className="font-semibold text-foreground">{invitation.company_name}</span>{" "}
              como <span className="font-medium">{invitation.role === "admin" ? "administrador" : "membro"}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            {!emailMatch && (
              <Alert>
                <AlertDescription>
                  Este convite foi enviado para <strong>{invitation.email}</strong>. Você está logado como <strong>{currentUserEmail}</strong>.
                </AlertDescription>
              </Alert>
            )}

            {!isLoggedIn ? (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Faça login ou crie uma conta com o e-mail <strong>{invitation.email}</strong> para aceitar o convite.
                </p>
                <Link href={`/login?redirect=/invite/${token}`}>
                  <Button className="w-full">Fazer login</Button>
                </Link>
                <Link href={`/register?redirect=/invite/${token}`}>
                  <Button variant="outline" className="w-full">Criar conta</Button>
                </Link>
              </div>
            ) : (
              <Button onClick={onAccept} disabled={loading || !emailMatch} className="w-full gap-2">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Aceitando...</>
                  : <><UserCheck className="w-4 h-4" />Aceitar convite</>
                }
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
