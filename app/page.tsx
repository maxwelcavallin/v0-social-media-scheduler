import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Instagram, Facebook, LayoutDashboard, Users, Zap, ArrowRight, CheckCircle2 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background font-sans">
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
          <Button size="lg" asChild>
            <Link href="/register">
              Começar grátis <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12 text-balance">
          Tudo que você precisa para gerenciar redes sociais
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Agendamento inteligente</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Agende posts com antecedência no Instagram e Facebook. Calendário visual para organizar toda a estratégia.
            </p>
          </div>
          <div className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Multi-workspace</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Organize cada cliente em seu próprio workspace. Separe contas, posts e calendários por cliente.
            </p>
          </div>
          <div className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Publicação automática</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Publique automaticamente no horário certo, sem precisar estar online. Foque na estratégia, não na execução.
            </p>
          </div>
          <div className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Instagram className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Instagram completo</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Posts de imagem, carrossel, Reels e Stories. Conecte qualquer conta profissional do Instagram.
            </p>
          </div>
          <div className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Facebook className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Facebook Pages</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Gerencie páginas do Facebook com posts, imagens e vídeos. Conecte múltiplas páginas em um workspace.
            </p>
          </div>
          <div className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Dashboard unificado</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Visualize todos os posts e clientes em um único painel. Filtros por status, data e plataforma.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-foreground mb-4 text-balance">
          Planos simples e transparentes
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Comece grátis. Escale conforme seu negócio cresce.
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <div className="flex flex-col gap-6 p-8 rounded-xl border border-border bg-card">
            <div>
              <h3 className="font-semibold text-foreground text-lg mb-1">Grátis</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">R$0</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {["1 workspace", "2 contas sociais", "30 posts/mês", "Calendário básico"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" asChild className="mt-auto">
              <Link href="/register">Começar grátis</Link>
            </Button>
          </div>
          <div className="flex flex-col gap-6 p-8 rounded-xl border-2 border-primary bg-card relative">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Popular</Badge>
            <div>
              <h3 className="font-semibold text-foreground text-lg mb-1">Pro</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">R$97</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {["Workspaces ilimitados", "Contas ilimitadas", "Posts ilimitados", "Calendário avançado", "Suporte prioritário"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-auto">
              <Link href="/register">Começar agora</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo-dog.png" alt="SocialDog" width={24} height={24} className="rounded" />
            <span className="text-sm font-medium text-foreground">SocialDog</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link href="/data-deletion" className="hover:text-foreground transition-colors">Exclusão de dados</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
