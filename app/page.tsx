import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CalendarDays,
  Instagram,
  Facebook,
  LayoutDashboard,
  Users,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background font-sans" data-version="119">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo-dog.png" alt="SocialDog" width={32} height={32} className="rounded-lg" />
            <span className="font-semibold text-lg text-foreground">SocialDog</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Planos
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <Badge variant="secondary" className="mb-6 text-primary border-primary/20">
          Plataforma de agendamento social
        </Badge>
        <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight text-balance mb-6">
          Gerencie redes sociais <br />
          <span className="text-primary">de todos seus clientes</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty mb-10">
          Agende posts no Instagram e Facebook, organize clientes em workspaces e monitore tudo em um calendário unificado.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild className="gap-2">
            <Link href="/register">
              Criar conta grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Ver demonstração</Link>
          </Button>
        </div>

        {/* Social platforms */}
        <div className="flex items-center justify-center gap-6 mt-16">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "oklch(0.92 0.05 15)" }}>
              <Instagram className="w-4 h-4" style={{ color: "oklch(0.52 0.25 15)" }} />
            </div>
            <span className="text-sm font-medium">Instagram</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "oklch(0.92 0.05 242)" }}>
              <Facebook className="w-4 h-4" style={{ color: "oklch(0.46 0.18 242)" }} />
            </div>
            <span className="text-sm font-medium">Facebook</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <Badge variant="outline" className="text-xs text-muted-foreground">
            LinkedIn em breve
          </Badge>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/40 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4 text-balance">
              Tudo que uma agência de marketing precisa
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              Do agendamento ao relatório, o SocialDog centraliza a gestão de todas as suas contas sociais.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: "Workspaces por cliente",
                desc: "Organize suas contas por cliente. Cada workspace tem suas próprias redes sociais conectadas.",
              },
              {
                icon: CalendarDays,
                title: "Calendário unificado",
                desc: "Visualize todos os posts agendados em um calendário. Filtre por workspace ou veja tudo de uma vez.",
              },
              {
                icon: LayoutDashboard,
                title: "Múltiplos formatos",
                desc: "Suporte a feed, reels e carrosséis. Adapte o conteúdo para cada plataforma.",
              },
              {
                icon: Zap,
                title: "Publicação automática",
                desc: "Agende e esqueça. O sistema publica automaticamente nos horários definidos.",
              },
              {
                icon: Instagram,
                title: "Login via Meta",
                desc: "Conecte-se uma vez pelo Facebook e descubra automaticamente todas as suas páginas e contas Instagram.",
              },
              {
                icon: CheckCircle2,
                title: "Multi-plataforma",
                desc: "Publique o mesmo conteúdo no Instagram e Facebook ao mesmo tempo, com um único clique.",
              },
            ].map((feat) => (
              <div key={feat.title} className="bg-card rounded-xl p-6 border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feat.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4 text-balance">
          Pronto para escalar sua agência?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto text-pretty">
          Crie sua conta agora e comece a agendar posts gratuitamente.
        </p>
        <Button size="lg" asChild className="gap-2">
          <Link href="/register">
            Criar conta grátis
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo-dog.png" alt="SocialDog" width={24} height={24} className="rounded-md" />
            <span className="font-semibold text-sm text-foreground">SocialDog</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Política de Privacidade
            </Link>
            <Link href="/data-deletion" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Exclusão de Dados
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 SocialDog. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
