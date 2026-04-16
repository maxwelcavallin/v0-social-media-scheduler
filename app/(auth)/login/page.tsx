import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Image src="/logo-dog.png" alt="SocialDog" width={36} height={36} className="rounded-xl" />
          <span className="font-bold text-xl text-foreground">SocialDog</span>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Bem-vindo de volta</CardTitle>
            <CardDescription>Entre com sua conta para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Form nativo — o browser segue o redirect 302 da API, 
                garantindo que o Set-Cookie seja aceito em qualquer contexto */}
            <form action="/api/auth/login" method="POST" className="flex flex-col gap-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-3 py-2">
                  {decodeURIComponent(error)}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" placeholder="voce@empresa.com" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required />
              </div>

              <Button type="submit" className="w-full mt-2">
                Entrar
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Não tem conta?{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">Criar conta grátis</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
