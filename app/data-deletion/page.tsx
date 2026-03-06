import Link from "next/link"
import { ArrowLeft, Trash2, Mail, AlertTriangle } from "lucide-react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
  title: "Exclusão de Dados — SocialDog",
  description: "Saiba como solicitar a exclusão dos seus dados no SocialDog.",
}

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-dog.png" alt="SocialDog" width={28} height={28} className="rounded-lg" />
            <span className="font-bold text-base text-foreground">SocialDog</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold text-foreground text-balance">
            Exclusão de Dados
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mb-10">
          Última atualização: 6 de março de 2026
        </p>

        <div className="flex flex-col gap-8">
          <section>
            <p className="text-muted-foreground leading-relaxed">
              O SocialDog respeita seu direito à privacidade e à autodeterminação informacional. Esta página descreve como você pode solicitar a exclusão dos seus dados pessoais da nossa plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD), o GDPR e as Políticas da Plataforma Meta.
            </p>
          </section>

          {/* Steps */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Como solicitar a exclusão</h2>
            <div className="flex flex-col gap-3">
              {[
                {
                  step: "1",
                  title: "Pelo painel do SocialDog",
                  description: "Acesse Configurações da sua conta e clique em \"Excluir minha conta\". Todos os seus dados serão removidos automaticamente em até 30 dias.",
                },
                {
                  step: "2",
                  title: "Por e-mail",
                  description: "Envie um e-mail para lgpd@list.dog com o assunto \"Solicitação de Exclusão de Dados\" informando o e-mail cadastrado na plataforma. Confirmaremos o recebimento em até 5 dias úteis.",
                },
                {
                  step: "3",
                  title: "Via remoção do aplicativo Meta",
                  description: "Se você conectou o SocialDog via Facebook, acesse Configurações do Facebook > Aplicativos e Sites, encontre o SocialDog e clique em \"Remover\". Isso revogará o acesso e solicitará a exclusão dos dados automaticamente.",
                },
              ].map((item) => (
                <Card key={item.step}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-primary-foreground">{item.step}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* What gets deleted */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">O que será excluído</h2>
            <div className="flex flex-col gap-2">
              {[
                "Sua conta de usuário e informações de perfil (nome, e-mail).",
                "Todos os workspaces criados por você e seus respectivos dados.",
                "Posts agendados e publicados através da plataforma.",
                "Mídias (imagens e vídeos) enviadas para agendamento.",
                "Tokens de acesso do Facebook e Instagram armazenados.",
                "Dados de contas sociais conectadas (páginas do Facebook, contas do Instagram).",
                "Registros de sessão e dados de autenticação.",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive/60 mt-1.5 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          {/* What is retained */}
          <section>
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg border border-border">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Dados que podem ser retidos</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Alguns dados anonimizados podem ser retidos para fins estatísticos e de melhoria do serviço (sem qualquer identificação pessoal). Dados transacionais podem ser retidos pelo prazo exigido por lei (até 5 anos para fins fiscais e contábeis, conforme legislação brasileira).
                </p>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Prazo de exclusão</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { prazo: "Imediato", desc: "Revogação dos tokens de acesso às redes sociais." },
                { prazo: "Até 5 dias", desc: "Confirmação do recebimento da solicitação por e-mail." },
                { prazo: "Até 30 dias", desc: "Exclusão completa de todos os dados pessoais dos nossos sistemas." },
              ].map((item) => (
                <div key={item.prazo} className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-base font-bold text-primary">{item.prazo}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Contato</h2>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4 px-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Duvidas ou solicitações</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Entre em contato pelo e-mail{" "}
                      <a href="mailto:lgpd@list.dog" className="text-primary hover:underline font-medium">
                        lgpd@list.dog
                      </a>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Respondemos em até 5 dias úteis com a confirmação da exclusão ou instruções adicionais.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">© 2026 SocialDog. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Política de Privacidade
            </Link>
            <Link href="/data-deletion" className="text-sm text-primary font-medium">
              Exclusão de Dados
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
