# Casa de Leilões

Plataforma de leilões online em que um leiloeiro publica lotes (obras de arte
obtidas da API pública do Art Institute of Chicago) e licitantes disputam cada
lote com lances ao vivo, usando saldo simulado.

> Projeto desenvolvido para o teste técnico Elite Dev da Verzel.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + Vite + TypeScript |
| Back-end | Node.js + Express 5 + TypeScript |
| Banco de dados | PostgreSQL (migrations com `node-pg-migrate`) |
| API externa | Art Institute of Chicago (`api.artic.edu`) |

## Estrutura

```
leilao/
├── backend/
│   ├── migrations/            migrations SQL versionadas (node-pg-migrate)
│   └── src/
│       ├── config/            leitura e validação das variáveis de ambiente
│       ├── db/                pool, reset, seed idempotente
│       ├── middleware/        autenticação/JWT, papéis e tratamento de erros
│       ├── modules/           um módulo por domínio: auth, wallet, lots,
│       │                      bids, settlement, receipts, audit, external
│       ├── app.ts             composição do Express (CORS, helmet, rotas)
│       └── server.ts          arranque, agendador de liquidação e graceful stop
├── frontend/
│   └── src/
│       ├── api/               cliente HTTP tipado e tratamento de erros
│       ├── auth/              contexto de sessão (login/registo/logout)
│       ├── components/        navbar, cards, countdown, tema e UI reutilizável
│       ├── i18n/              tradução dos códigos de erro da API
│       ├── lib/               utilitários, proxy de imagens e tema
│       ├── pages/             uma página por rota do produto
│       └── main.tsx           providers e router
├── docker-compose.yml         PostgreSQL + migrate/seed + API + front-end
├── run_tests.sh               testes de integração da API (curl + jq)
└── README.md
```

### Modelo de organização

- **Back-end por domínio:** cada módulo em `backend/src/modules` tem rotas,
  validação e serviço próprios. Regras financeiras e de lances ficam nos serviços,
  nunca nas rotas. O acesso ao banco é sempre parametrizado e transacional quando
  envolve saldo, lances ou liquidação.
- **Front-end por página + componentes reutilizáveis:** as páginas representam as
  rotas; a lógica transversal (sessão, cliente HTTP, tema, formatação) vive em
  `auth`, `api`, `lib` e `i18n`. Não há estado global além da sessão e do tema.
- **Configuração por ambiente:** segredos e URLs vêm de `.env`; o repositório só
  versiona `.env.example`.
- **Evolução da base de dados:** migrations versionadas em `backend/migrations`,
  script de reset para desenvolvimento e seed idempotente com dados de teste.
- **Fronteira com a API externa:** o navegador nunca chama o Art Institute
  diretamente; o backend faz a busca, guarda o snapshot no lote e serve as imagens
  por proxy (`/external/image`), para a aplicação continuar funcional se a API cair.

## Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL 14 ou superior
- Git

## Como rodar com Docker Compose (recomendado)

> Requer apenas [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/). Não é necessário instalar Node.js ou PostgreSQL localmente.

```bash
# Clone o repositório e entre na pasta
git clone <url-do-repo> && cd leilao

# Suba tudo (banco, reset, migração, seed, back-end e front-end)
docker compose up
```

O serviço `migrate` apaga o schema `public` antes de migrar e semear, por isso
cada `docker compose up` começa com a base de dados limpa.

Aguarde até ver `✅ Seed concluído` no log do serviço `migrate`. Depois abra:

| Serviço | URL |
|---|---|
| Front-end | http://localhost:5173 |
| API | http://localhost:3000 |

Para parar e apagar os volumes (banco):

```bash
docker compose down -v
```

## Como rodar localmente

### 1. Banco de dados

Crie um utilizador e um banco dedicados:

```bash
sudo -u postgres psql
```

```sql
CREATE USER leilao WITH PASSWORD 'leilao123';
CREATE DATABASE leilao OWNER leilao;
\q
```

### 2. Back-end

```bash
cd backend
cp .env.example .env      # depois edite os segredos
npm install
npm run reset             # opcional: apaga tudo antes de recomeçar
npm run migrate:dev       # cria as tabelas
npm run seed              # insere as contas de teste
npm run dev               # sobe a API em http://localhost:3000
```

Verifique com `curl http://localhost:3000/health`.

### 3. Front-end

```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # abre em http://localhost:5173
```

## Build de produção

### Back-end

```bash
cd backend
npm run build   # compila TypeScript → dist/
npm run start   # node dist/server.js
```

### Front-end

```bash
cd frontend
npm run build   # gera dist/ estático
# sirva com qualquer servidor HTTP estático (nginx, Caddy, etc.)
# Configure o servidor para redirigir todas as rotas para index.html (SPA)
```

## Variáveis de ambiente

### backend/.env

| Variável | Descrição |
|---|---|
| `PORT` | Porta da API (padrão 3000) |
| `DATABASE_URL` | Connection string do PostgreSQL. Caracteres especiais na senha precisam de percent-encoding (`@` vira `%40`) |
| `JWT_SECRET` | Segredo para assinar tokens de login |
| `HMAC_SECRET` | Segredo da cadeia de hashes da auditoria. Deve ficar fora do banco |
| `FRONTEND_URL` | Origem permitida no CORS |

### frontend/.env

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL base da API |

## Papéis e permissões

| Ação | Leiloeiro | Licitante | Público |
|---|---|---|---|
| Criar/cancelar lotes | Sim | Não | Não |
| Depositar saldo | Não | Sim | Não |
| Dar lances | Não | Sim | Não |
| Ver carteira | Sim | Sim | Não |
| Ver auditoria | Sim | Sim | Sim |

As permissões são verificadas **no servidor** em cada rota (middleware
`requireRole`), não apenas escondidas na interface.

## Decisões técnicas

- **Dinheiro em centavos inteiros** (`BIGINT`, campos `*_cents`), nunca `float`,
  para evitar erros de arredondamento.
- **IDs em UUID**, para que links públicos (auditoria, comprovante) não sejam
  adivinháveis.
- **Estado do lote híbrido:** o banco guarda apenas `cancelled_at` e
  `settled_at`; agendado, ao vivo e encerrado são calculados pelo relógio
  (`start_at` / `end_at`), evitando inconsistências se um agendador atrasar.
- **Erros com código estável** (ex.: `INSUFFICIENT_BALANCE`). A API devolve o
  código em inglês e o front traduz para português.
- **Código em inglês, interface e documentação em português.**
- **Senhas** com bcrypt; autenticação por JWT no header `Authorization`.
- **Validação de entrada** com Zod em todas as rotas.
- **API externa isolada:** o Art Institute só é consultado na busca do leiloeiro e
  na criação do lote, onde o servidor guarda um snapshot (título, artista, imagem,
  atributos). Busca com timeout de 5 s, cache de 5 min e erro `503` claro. Vitrine,
  sala, lances, auditoria e comprovante nunca dependem da API.
- **Snapshot feito no servidor:** o front envia só o `externalId`; os dados do item
  vêm da API, não do cliente.
- **Proxy de imagens:** o backend serve as imagens do Art Institute em
  `/external/image?src=...` com cache e User-Agent de browser, evitando bloqueios
  de hotlink e mantendo a vitrine/comprovante independentes do cliente externo.
- **Cancelamento:** só o dono do lote e só antes de liquidado. Usa o mesmo
  bloqueio de linha (`FOR UPDATE`) dos lances. Se já houver líder, o valor
  comprometido é libertado (volta ao disponível) na mesma transação.
- Só aparecem na busca obras de domínio público e com imagem.
- **Lances atômicos:** cada lance corre numa transação PostgreSQL que bloqueia o
  lote (`SELECT ... FOR UPDATE`) e depois as carteiras envolvidas, sempre por ordem
  de id (evita deadlock). Validação, saldo comprometido, gravação do lance e
  prorrogação acontecem na mesma transação. A hora do lance vem do relógio do banco
  (`clock_timestamp()`), nunca do cliente.
- **Anti-sniping:** lance aceito com 2 min ou menos para o fim move o fim para
  `agora + 2 min`.
- **Cadeia de hashes:** cada lance guarda `prev_hash` e `hash` (HMAC-SHA256 com
  `HMAC_SECRET`). _Detalhes completos na secção de auditoria._
- **Pseudónimos:** o histórico mostra `Licitante #XXXXXX`, derivado por HMAC de
  (utilizador, lote). Nunca expõe nome, email ou ID.
- **Liquidação idempotente:** ao fim do lote, uma única transação bloqueia o lote,
  debita o vencedor (total e comprometido), credita o leiloeiro, regista os
  movimentos e emite o comprovante. `settled_at` garante que nunca cobra duas vezes,
  mesmo com pedidos simultâneos. Lotes sem lances fecham sem vencedor.
- **Dois gatilhos de liquidação:** um agendador (a cada 10 s) e uma liquidação
  "preguiçosa" ao ler vitrine, lote, carteira ou arremates. Em hospedagens que
  adormecem o servidor, o agendador pára, mas a próxima leitura liquida o que estiver vencido.
- **Movimentos com sinal:** em `wallet_transactions`, depósito e venda são positivos
  e compra é negativa; a soma dos movimentos de um utilizador é sempre igual ao saldo total.
- **Comprovante público e anônimo:** link por UUID (não adivinhável), com o vencedor
  como pseudónimo e o hash final da cadeia de lances.

## Credenciais de teste (seed)

Rodar `npm run seed` na pasta `backend`.

| Papel | Email | Senha |
|---|---|---|
| Leiloeiro | leiloeiro@leilao.com | `Leilao@123` |
| Licitante | ana@leilao.com | `Leilao@123` |
| Licitante | bruno@leilao.com | `Leilao@123` |

O seed cria automaticamente um **lote ao vivo (Water Lilies — Monet)** com 3 lances já feitos (Ana está ganhando), para que o avaliador possa percorrer o fluxo completo sem montar nada do zero. O seed é **idempotente**: pode ser executado várias vezes sem duplicar dados.

Após o seed, os URLs do lote e da auditoria são impressos no terminal.

## Testes de integração (`run_tests.sh`)

Pré-requisitos: API a correr e `curl` + `jq` instalados. O script cria os seus
próprios utilizadores e lotes de teste e pode ser executado com a base semeada.

Cobre 12 categorias, 44 verificações:

| Categoria | O que testa |
|---|---|
| Auth | Registo, login, senha fraca, email inválido, email duplicado, credenciais erradas |
| Carteira | Consulta, depósito, depósito negativo, leiloeiro proibido de depositar |
| API externa | Busca por obra na Art Institute API |
| Lotes | Criar (agendado e ao vivo), licitante proibido, cancelamento, cancelado fora da vitrine |
| Lances | Mínimo, auto-lance, saldo insuficiente, incremental, leiloeiro proibido |
| Saldo | Comprometido correto, devolvido ao ser superado |
| Cancelamento com estorno | Comprometido libertado e disponível reposto após cancelar lote com lances |
| Sala | Status ao vivo, histórico de lances |
| Arremates | Listagem pessoal |
| Auditoria | Cadeia de hashes íntegra |
| Segurança | 4 rotas protegidas sem token |

```bash
# a partir da raiz do repositório, com a API já a correr
chmod +x run_tests.sh
BASE_URL=http://localhost:3000 ./run_tests.sh
```

## Histórico à prova de adulteração

**Técnica:** cadeia de hashes com HMAC-SHA256.

Cada lance guarda `prev_hash` (hash do lance anterior, ou `GENESIS` no primeiro) e
`hash = HMAC(HMAC_SECRET, [prev_hash, lote, sequência, licitante, valor, data])`.
O segredo fica em variável de ambiente, fora do banco: quem só tem acesso ao banco
não consegue recalcular hashes válidos.

A página `/audit/:lotId` (pública) recalcula tudo e verifica:
1. **Cadeia:** sequência sem buracos, `prev_hash` encadeado e hash de cada lance.
   Detecta valor alterado, licitante trocado, lance inserido e lance removido do meio.
2. **Lote:** `head_hash` (hash do último lance) e `bid_count` guardados no lote.
   Detecta remoção do último lance, que a cadeia sozinha não vê.
3. **Fecho:** `final_hash` e valor do comprovante, e o movimento financeiro da venda.
   Detecta quem apagou o último lance e também "corrigiu" o lote.

A leitura é feita num snapshot (`REPEATABLE READ`) para que um lance legítimo
simultâneo não cause um falso alarme.

**Limitações assumidas:**
- Quem tiver acesso ao banco **e** ao `HMAC_SECRET` consegue forjar a cadeia.
- Quem apagar o último lance e **também** corrigir lote, comprovante e movimentos
  financeiros de forma coerente não é detetado pela cadeia. A defesa é o comprovante
  partilhado: o vencedor guarda o `finalHash`, que serve de âncora externa.
- A auditoria mostra pseudónimos (`Licitante #XXXXXX`) derivados por HMAC de
  (utilizador, lote), sem dados pessoais.

## Checklist do enunciado

| Requisito obrigatório | Estado / onde está |
|---|---|
| Deploy público | ⚠️ **Ainda não publicado.** Instruções em [Deploy](#deploy); falta escolher os serviços e preencher as URLs |
| Dois papéis (leiloeiro/licitante) | ✅ Registo com escolha de papel; permissões verificadas no servidor |
| Vitrine com ao vivo/agendados/encerrados | ✅ `/` — cancelados nunca aparecem |
| Painel do leiloeiro | ✅ `/panel` — busca na API, cria/cancela lotes e vê resultados |
| Sala ao vivo | ✅ `/lots/:id` — lance atual, histórico, posição, countdown e feedback |
| Carteira | ✅ `/wallet` — total, comprometido, disponível e depósito simulado |
| Meus arremates + comprovante partilhável | ✅ `/my/bids` e `/receipts/:id` (link público) |
| Auditoria pública | ✅ `/audit/:lotId` — cadeia de hashes verificada sem login |
| Mensagens de lance recusado | ✅ Motivo específico devolvido pela API e traduzido no front |
| Regras de lance e saldo comprometido | ✅ Transações com lock; detalhes em [Decisões técnicas](#decisões-técnicas) |
| Anti-sniping (+2 min) | ✅ Lance nos últimos 2 min estende o fim |
| Liquidação e privacidade | ✅ Débito/crédito idempotentes e pseudónimos HMAC |
| Dados de teste semeados | ✅ Leiloeiro, dois licitantes e lote ao vivo com 3 lances |
| README detalhado | ✅ Este ficheiro (configuração, execução, decisões e limitações) |

## Funcionalidades opcionais implementadas

| Opcional | Estado | Detalhe |
|---|---|---|
| Busca e filtro de lotes | ✅ | Pesquisa por título/artista/técnica, filtros por estado e ordenação por fim/preço/data |
| Cancelamento com estorno automático | ✅ | O leiloeiro cancela lotes ainda não liquidados; o valor comprometido do líder volta a ficar disponível |
| Docker Compose | ✅ | `docker compose up` sobe PostgreSQL, reset/migração/seed, API e front-end |
| Testes automatizados | ✅ | `run_tests.sh` versionado — 12 categorias, 44 verificações de integração |
| Dark Mode | ✅ | Toggle no navbar em todas as páginas (incluindo login); preferência guardada em `localStorage` |

## Limitações e comportamentos conhecidos

- O papel (leiloeiro ou licitante) é escolhido livremente no registo, porque o
  enunciado não define como alguém se torna leiloeiro. Numa aplicação real,
  isso seria restrito.
- Recuperação de senha não foi implementada (fora do escopo do enunciado).
- A imagem do lote depende do servidor de imagens do Art Institute of Chicago.
- O front usa polling (a cada 2–5 s) em vez de WebSocket. Num produto real
  usaria SSE ou WebSocket; polling foi suficiente para os requisitos do teste.

## Uso de inteligência artificial

O desenvolvimento foi feito em **duas fases** com abordagens distintas:

### Fase 1 — Back-end (feito manualmente)

Todo o back-end foi desenvolvido **sem assistência de IA**. Isto incluiu:

- Modelagem do banco de dados e migrations SQL
- Módulos de autenticação, carteira, lotes e lances
- Transações com `SELECT ... FOR UPDATE` para concorrência segura
- Algoritmo da cadeia de hashes HMAC-SHA256
- Lógica de anti-sniping, liquidação idempotente e pseudónimos
- Integração com a API do Art Institute of Chicago

O objetivo era provar domínio real das tecnologias avaliadas (PostgreSQL com
locks, consistência financeira, segurança, testes) antes de qualquer auxílio externo.

### Fase 2 — Front-end (com assistência de IA)

Após o back-end estar completo e testado, a **Antigravity (Claude / GPT)** foi
usada para acelerar a construção da interface React, por ser um trabalho
predominantemente de scaffolding e composição de componentes com padrões já
estabelecidos. A IA:

- Gerou os componentes React com base na estrutura de tipos do back-end já existente
- Criou o design system (CSS custom properties, dark mode, responsividade)
- Compôs as páginas (vitrine, sala de lances, carteira, painel, auditoria, comprovante)
- Corrigiu erros de TypeScript e de build apontados durante o desenvolvimento

Toda a lógica crítica (hooks de polling, countdown sincronizado com o servidor,
deteção de prorrogação anti-sniping) foi revisada e ajustada pelo desenvolvedor.

### Plano de desenvolvimento

O projeto seguiu um plano estruturado:

1. Modelagem e migrations do banco
2. Auth com JWT e bcrypt
3. Carteira com saldo comprometido
4. Integração API externa com snapshot
5. Lotes: criação, vitrine, cancelamento
6. Lances: transação atómica, cadeia de hashes, anti-sniping
7. Liquidação e comprovante
8. Auditoria pública
9. Front-end (com IA): componentes, páginas, design
10. Build de produção, testes e documentação

## Deploy

> ⚠️ **Ainda não está publicado.** O deploy é obrigatório no enunciado e é o
> próximo passo pendente. O README já deixa a configuração necessária para o
> fazer; depois de publicado, substituir esta nota pelas URLs finais.

**Opções recomendadas:**

| Serviço | Para quê |
|---|---|
| [Neon](https://neon.tech) | PostgreSQL serverless (free tier) |
| [Render](https://render.com) | Back-end Node.js (free tier, cold start) |
| [Vercel](https://vercel.com) | Front-end estático (free tier) |

**Configuração do back-end no Render:**
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Variáveis de ambiente: `DATABASE_URL`, `JWT_SECRET`, `HMAC_SECRET`, `FRONTEND_URL`, `PORT`

**Configuração do front-end no Vercel:**
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Variável de ambiente: `VITE_API_URL` (URL do back-end no Render)
- Rewrites: `/* → /index.html` (para o React Router funcionar)