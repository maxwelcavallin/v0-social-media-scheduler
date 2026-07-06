# Esquema do Banco de Dados (Neon / PostgreSQL)

> Documentação viva. Consulte este arquivo antes de escrever queries — evita
> consultar o banco diretamente. Mantenha atualizado a cada alteração de schema.

Última atualização: 2026-07-06

## Visão geral do fluxo Meta (Facebook/Instagram)

O Facebook concede permissão de forma **global por (app + usuário)** — não existe
conceito de "workspace" no lado do Meta. Desmarcar uma página numa reconexão
**revoga** o acesso do app àquela página em todo lugar (causa do erro 190 entre
contas do mesmo usuário).

Para conciliar isso com múltiplos workspaces, o modelo tem TRÊS camadas:

- **`connected_accounts`** — pool GLOBAL por **empresa** (`company_id`). É a fonte
  de verdade das contas conectadas (Facebook, Instagram-via-Facebook e Instagram
  direto). A conexão (OAuth) acontece **uma única vez na Visão Geral** e grava aqui;
  qualquer workspace da empresa (atual ou futuro) enxerga essas contas.
- **`social_accounts`** — vínculo LOCAL por workspace. Cada linha representa uma
  conta efetivamente usada em um workspace. O seletor de contas cria essas linhas
  a partir do `connected_accounts`, SEM refazer o OAuth (sem revogação).
- **`meta_page_catalog`** — catálogo legado por usuário (mantido para auto-cura e
  compatibilidade). O pool por empresa (`connected_accounts`) é o modelo atual.

Conexão: `/api/social/meta/*` e `/api/social/instagram/*` derivam a empresa da
sessão (via `lib/company.ts`) e gravam em `connected_accounts`. Seleção por
workspace: `GET/POST /api/social/meta/catalog`. Lista do pool na Visão Geral:
`GET /api/social/accounts`. Exclusão em massa de workspaces (admins):
`POST /api/workspaces/bulk-delete`.

---

## Tabela: `connected_accounts`

Pool global de contas conectadas, por empresa. Alimenta o seletor de contas dos workspaces.

| Coluna | Tipo | Null | Descrição |
|---|---|---|---|
| `id` | uuid (PK) | NO | Identificador. Default `gen_random_uuid()`. |
| `company_id` | text | NO | Empresa dona da conexão (`company.id`). |
| `connected_by_user_id` | text | NO | Usuário do app que conectou (`session.user.id`). |
| `platform` | text | NO | `facebook` ou `instagram`. |
| `external_id` | text | NO | ID da entidade na plataforma (page_id do FB ou id da conta IG). |
| `page_id` | text | YES | ID da página do Facebook (NULL para Instagram direto). |
| `name` | text | YES | Nome de exibição. |
| `username` | text | YES | @username (Instagram). |
| `picture_url` | text | YES | Foto de perfil/página. |
| `access_token` | text | NO | Token de publicação (page token do FB ou token do IG). |
| `user_access_token` | text | YES | User Access Token (para auto-cura; NULL no IG direto). |
| `token_expires_at` | timestamptz | YES | Expiração do token, quando aplicável. |
| `fb_user_id` | text | YES | ID do usuário do Facebook dono das páginas. |
| `source` | text | NO | Origem: `facebook` ou `instagram_direct`. Default `facebook`. |
| `created_at` | timestamptz | NO | Default `now()`. |
| `updated_at` | timestamptz | NO | Default `now()`. |

Índice único: `(company_id, platform, external_id)`. Índice de busca: `(company_id)`.

---

## Tabela: `meta_page_catalog`

Catálogo global de páginas Meta concedidas, por usuário do app.

| Coluna | Tipo | Null | Descrição |
|---|---|---|---|
| `id` | uuid (PK) | NO | Identificador. Default `gen_random_uuid()`. |
| `connected_by_user_id` | text | NO | ID do usuário do app (Better Auth `session.user.id`) que conectou. |
| `fb_user_id` | text | YES | ID do usuário do Facebook dono das páginas. |
| `page_id` | text | NO | ID da página do Facebook. |
| `page_name` | text | YES | Nome da página. |
| `page_access_token` | text | NO | Page Access Token (longa duração) atual. |
| `user_access_token` | text | YES | User Access Token (longa duração) usado para auto-cura. |
| `picture_url` | text | YES | Foto da página. |
| `ig_business_account_id` | text | YES | ID da conta Instagram Business vinculada à página. |
| `ig_username` | text | YES | @ do Instagram vinculado. |
| `ig_name` | text | YES | Nome do Instagram vinculado. |
| `ig_profile_picture_url` | text | YES | Foto do Instagram vinculado. |
| `created_at` | timestamptz | NO | Default `now()`. |
| `updated_at` | timestamptz | NO | Default `now()`. |

Índices:
- UNIQUE `meta_page_catalog_user_page_uidx (connected_by_user_id, page_id)`
- `meta_page_catalog_user_idx (connected_by_user_id)`

Populado em: `app/api/social/meta/process/route.ts` (Step 6 e Step 6b).

---

## Tabela: `social_accounts`

Vínculo de uma página/conta a um workspace (o que é efetivamente publicável ali).

| Coluna | Tipo | Null | Descrição |
|---|---|---|---|
| `id` | uuid (PK) | NO | Identificador. |
| `workspace_id` | text | NO | Workspace dono do vínculo. |
| `platform` | varchar | NO | `facebook` ou `instagram`. |
| `account_name` | varchar | NO | Nome de exibição. |
| `account_username` | varchar | YES | @ (Instagram). |
| `account_id` | text | NO | ID externo: page_id (FB) ou ig_business_account_id (IG). |
| `page_id` | text | YES | Page ID do Facebook (para IG, é a página vinculada). |
| `access_token` | text | NO | Page Access Token usado para publicar. |
| `token_expires_at` | timestamp | YES | Expiração do token (se conhecida). |
| `profile_picture_url` | text | YES | Foto. |
| `is_active` | boolean | YES | Conta ativa. |
| `last_sync_at` | timestamp | YES | Última sincronização. |
| `created_at` | timestamp | YES | — |
| `updated_at` | timestamp | YES | — |
| `webhook_secret` | text | YES | Segredo de webhook. |
| `needs_reconnect` | boolean | NO | `true` quando o acesso foi revogado/token morto. |
| `mcp_allowed` | boolean | NO | Se a conta pode ser usada via MCP. |
| `user_access_token` | text | YES | User token (longa duração) para auto-cura de page token. |
| `fb_user_id` | text | YES | ID do usuário do Facebook. |

Índice de unicidade lógico: `(workspace_id, platform, account_id)` (usado no
`ON CONFLICT` do upsert).

---

## Tabela: `posts`

| Coluna | Tipo | Null | Descrição |
|---|---|---|---|
| `id` | uuid (PK) | NO | — |
| `workspace_id` | text | NO | Workspace dono do post. |
| `content` | text | NO | Texto/legenda. |
| `status` | varchar | NO | Estado do post (draft/scheduled/published/failed etc.). |
| `scheduled_at` | timestamp | YES | Quando publicar. |
| `published_at` | timestamp | YES | Quando publicou. |
| `error_message` | text | YES | Último erro. |
| `created_by` | text | NO | Usuário criador. |
| `created_at` | timestamp | YES | — |
| `updated_at` | timestamp | YES | — |
| `review_token` | text | YES | Token de aprovação externa. |
| `review_status` | text | YES | Estado da revisão. |
| `review_notes` | text | YES | Notas da revisão. |
| `review_at` | timestamptz | YES | Data da revisão. |
| `post_type` | varchar | NO | `feed`, `story`, `reel`, etc. |

Observação: mídias (`media_urls`, `media_types`, `cover_url`) são resolvidas no
fluxo de publicação; confirmar tabela/coluna de origem antes de assumir.

---

## Tabela: `post_targets`

Destinos de um post (uma linha por conta social alvo).

| Coluna | Tipo | Null | Descrição |
|---|---|---|---|
| `id` | uuid (PK) | NO | — |
| `post_id` | uuid | NO | FK lógica para `posts.id`. |
| `social_account_id` | uuid | NO | FK lógica para `social_accounts.id`. |
| `post_type` | varchar | NO | Tipo por alvo. |
| `platform_post_id` | text | YES | ID retornado pela plataforma após publicar. |
| `status` | varchar | NO | `pending`, `published`, `failed`. |
| `error_message` | text | YES | Erro do alvo. |
| `created_at` | timestamp | YES | — |

---

## Tabela: `post_queue`

Fila de publicação processada pelo cron `/api/queue/process`.

| Coluna | Tipo | Null | Descrição |
|---|---|---|---|
| `id` | uuid (PK) | NO | — |
| `post_id` | uuid | NO | FK lógica para `posts.id`. |
| `scheduled_at` | timestamp | NO | Quando processar. |
| `attempts` | integer | YES | Tentativas feitas. |
| `max_attempts` | integer | YES | Limite de tentativas. |
| `status` | varchar | NO | Estado do item na fila. |
| `last_error` | text | YES | Último erro. |
| `created_at` | timestamp | YES | — |
| `updated_at` | timestamp | YES | — |
