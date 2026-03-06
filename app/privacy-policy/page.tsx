import Link from "next/link"
import { Zap, ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Política de Privacidade — SocialDog",
  description: "Política de privacidade do SocialDog: como coletamos, usamos e protegemos seus dados.",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
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
        <h1 className="text-3xl font-bold text-foreground mb-2 text-balance">
          Política de Privacidade
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Última atualização: 6 de março de 2026
        </p>

        <div className="prose prose-sm max-w-none flex flex-col gap-8">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Introdução</h2>
            <p className="text-muted-foreground leading-relaxed">
              O SocialDog ("nós", "nosso" ou "plataforma") é uma ferramenta de agendamento e gerenciamento de publicações em redes sociais. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos as informações dos nossos usuários ao utilizarem nossos serviços.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Ao utilizar o SocialDog, você concorda com as práticas descritas nesta política. Caso não concorde, pedimos que não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Dados que coletamos</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Coletamos as seguintes categorias de dados:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-2 text-muted-foreground">
              <li><strong className="text-foreground">Dados de cadastro:</strong> nome, endereço de e-mail e senha (armazenada com hash seguro).</li>
              <li><strong className="text-foreground">Dados de conexão social:</strong> tokens de acesso do Facebook/Instagram obtidos via OAuth, necessários para publicar em seu nome. Nunca armazenamos sua senha das redes sociais.</li>
              <li><strong className="text-foreground">Conteúdo de publicações:</strong> legendas, imagens, vídeos e configurações de agendamento que você cria na plataforma.</li>
              <li><strong className="text-foreground">Dados de uso:</strong> logs de acesso, endereço IP, tipo de navegador e interações com a plataforma, utilizados para melhorar nossos serviços e segurança.</li>
              <li><strong className="text-foreground">Informações de páginas e contas:</strong> nomes, IDs e fotos de perfil das páginas do Facebook e contas do Instagram que você conectar ao SocialDog.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Como usamos seus dados</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Utilizamos suas informações exclusivamente para:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-2 text-muted-foreground">
              <li>Fornecer, operar e manter os serviços do SocialDog.</li>
              <li>Publicar conteúdo nas redes sociais nos horários agendados por você.</li>
              <li>Autenticar e identificar sua conta com segurança.</li>
              <li>Enviar notificações relacionadas ao uso da plataforma (falhas de publicação, expiração de tokens, etc.).</li>
              <li>Melhorar a plataforma com base em padrões de uso agregados e anônimos.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              <strong className="text-foreground">Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins comerciais.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Integração com a Meta (Facebook e Instagram)</h2>
            <p className="text-muted-foreground leading-relaxed">
              O SocialDog utiliza a API Graph da Meta para conectar suas páginas do Facebook e contas do Instagram Business. Ao autenticar via Facebook, você autoriza o SocialDog a:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-2 text-muted-foreground mt-3">
              <li>Listar as páginas e contas do Instagram Business associadas à sua conta Meta.</li>
              <li>Publicar conteúdo (imagens, vídeos, textos) em seu nome nas datas e horários que você definir.</li>
              <li>Ler informações básicas de perfil das contas conectadas.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Os tokens de acesso obtidos são armazenados de forma criptografada e utilizados somente para as ações descritas acima. Você pode revogar o acesso a qualquer momento nas configurações do Facebook ou dentro da própria plataforma SocialDog.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Armazenamento e segurança</h2>
            <p className="text-muted-foreground leading-relaxed">
              Seus dados são armazenados em servidores seguros com criptografia em trânsito (HTTPS/TLS) e em repouso. Adotamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Senhas são armazenadas usando hashing seguro (bcrypt). Tokens de acesso das redes sociais são criptografados antes de serem persistidos no banco de dados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Compartilhamento de dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Podemos compartilhar suas informações apenas nas seguintes situações:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-2 text-muted-foreground mt-3">
              <li><strong className="text-foreground">Prestadores de serviço:</strong> infraestrutura de nuvem (Vercel, Neon Database) para hospedagem e banco de dados. Esses parceiros estão contratualmente obrigados a proteger seus dados.</li>
              <li><strong className="text-foreground">Exigência legal:</strong> quando obrigados por lei, ordem judicial ou autoridade competente.</li>
              <li><strong className="text-foreground">Com seu consentimento:</strong> em qualquer situação em que você nos autorize explicitamente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Seus direitos</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              De acordo com a Lei Geral de Proteção de Dados (LGPD) e o GDPR, você tem os seguintes direitos:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-2 text-muted-foreground">
              <li><strong className="text-foreground">Acesso:</strong> solicitar uma cópia dos dados que temos sobre você.</li>
              <li><strong className="text-foreground">Correção:</strong> solicitar a correção de dados incorretos ou desatualizados.</li>
              <li><strong className="text-foreground">Exclusão:</strong> solicitar a exclusão de seus dados pessoais. Veja nossa <Link href="/data-deletion" className="text-primary hover:underline">página de exclusão de dados</Link>.</li>
              <li><strong className="text-foreground">Portabilidade:</strong> solicitar seus dados em formato estruturado e legível por máquina.</li>
              <li><strong className="text-foreground">Revogação de consentimento:</strong> retirar seu consentimento a qualquer momento.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Para exercer qualquer um desses direitos, entre em contato conosco pelo e-mail: <strong className="text-foreground">lgpd@list.dog</strong>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Retenção de dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para fornecer os serviços. Após o encerramento da conta, os dados pessoais são excluídos em até 30 dias, exceto quando a retenção for exigida por lei.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos cookies de sessão essenciais para manter você autenticado na plataforma. Não utilizamos cookies de rastreamento ou publicidade de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Alterações nesta política</h2>
            <p className="text-muted-foreground leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Quando isso ocorrer, notificaremos você por e-mail ou por meio de aviso na plataforma. A data da última atualização sempre estará indicada no topo desta página.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas, solicitações ou reclamações relacionadas à privacidade, entre em contato:
            </p>
            <div className="mt-3 p-4 bg-muted rounded-lg">
              <p className="text-sm text-foreground font-medium">SocialDog</p>
              <p className="text-sm text-muted-foreground mt-1">E-mail: lgpd@list.dog</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">© 2026 SocialDog. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="text-sm text-primary font-medium">
              Política de Privacidade
            </Link>
            <Link href="/data-deletion" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Exclusão de Dados
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
