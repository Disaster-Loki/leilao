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
| API externa | Art Institute of Chicago (`api.artic.edu`) e Wikimedia Commons (imagens) |

## Estrutura

```
leilao/
├── backend/
│   ├── migrations/            migrations SQL versionadas (node-pg-migrate)
│   ├── test/                  testes de integração (node:test + PostgreSQL)
│   └── src/
│       ├── config/            leitura e validação das variáveis de ambiente
│       ├── db/                pool e seed idempotente
│       ├── middleware/        autenticação/JWT, papéis e tratamento de erros
│       ├── modules/           um módulo por domínio: auth, wallet, lots,
│       │                      bids, settlement, receipts, audit, external
│       ├── app.ts             composição do Express (CORS, helmet, rotas)
│       └── server.ts          arranque, agendador, liquidação e shutdown
├── frontend/
│   └── src/
│       ├── api/               cliente HTTP tipado e tratamento de erros
│       ├── auth/              contexto de sessão (login/registo/logout)
│       ├── components/        navbar, cards, countdown, tema e UI reutilizável
│       ├── lib/               utilitários, proxy de imagens, tema e relógio
│       ├── pages/             uma página por rota do produto
│       └── main.tsx           providers e router
├── docker-compose.yml         PostgreSQL + migrate/seed + API + front-end
├── render.yaml                blueprint do back-end no Render
├── frontend/vercel.json      build e rewrites do front-end no Vercel
└── README.md
```

### Modelo de organização

- **Back-end por domínio:** cada módulo em `backend/src/modules` tem rotas,
  validação e serviço próprios. Regras financeiras e de lances ficam nos serviços,
  nunca nas rotas. O acesso ao banco é sempre parametrizado e transacional quando
  envolve saldo, lances ou liquidação.
- **Front-end por página + componentes reutilizáveis:** as páginas representam as
  rotas; a lógica transversal (sessão, cliente HTTP, tema, formatação) vive em
  `auth`, `api` e `lib`. Não há estado global além da sessão e do tema.
- **Configuração por ambiente:** segredos e URLs vêm de `.env`; o repositório
  versiona apenas `.env.example` e `.env.test` (este último só com valores de teste).
- **Evolução da base de dados:** migrations versionadas em `backend/migrations`
  e seed idempotente com dados de teste.
- **Fronteira com a API externa:** o navegador nunca chama o Art Institute
  diretamente; o backend faz a busca e guarda o snapshot no lote. As imagens
  públicas são resolvidas no Wikimedia Commons (o AIC bloqueia hotlink via
  Cloudflare); `/external/image` fica como proxy de recurso para URLs antigas do AIC.

## Pré-requisitos

- Node.js 22 ou superior
- PostgreSQL 14 ou superior
- Git

## Como rodar com Docker Compose (recomendado)

> Requer apenas [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/). Não é necessário instalar Node.js ou PostgreSQL localmente.

```bash
# Clone o repositório e entre na pasta
git clone <url-do-repo> && cd leilao

# Suba tudo (banco, migrações, seed, back-end e front-end)
docker compose up
```

O Compose usa apenas imagens oficiais (`postgres:16-alpine` e `node:22-alpine`);
não há Dockerfiles no repositório. O backend executa as migrations pendentes e
o seed idempotente. Os dados permanecem no volume `pgdata` entre arranques; para
apagar a base local e começar de novo, use `docker compose down -v` antes de
subir os serviços. O PostgreSQL fica exposto no host em **5433** para não colidir
com uma instalação local na 5432.

Aguarde até ver `Seed concluído.` no log do serviço `migrate`. Depois abra:

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
| `MIN_DEPOSIT_CENTS` | Depósito mínimo em centavos (padrão `1`) |
| `MAX_DEPOSIT_CENTS` | Limite por depósito em centavos (padrão `100000000000`) |
| `MAX_WALLET_CENTS` | Saldo total máximo por carteira em centavos (padrão BIGINT máximo) |

### frontend/.env

| Variável | Descrição |
|---|---|
| `API_URL` | URL base da API (pública) |

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
- **Imagens (fluxo atual):** ao pesquisar ou criar um lote, o backend consulta o
  Art Institute of Chicago para os metadados e procura a imagem correspondente no
  Wikimedia Commons, primeiro pelo número de inventário (`main_reference_number`).
  Quando encontra um ficheiro, guarda no snapshot do lote o URL HTTPS do CDN
  Wikimedia; o front-end usa esse URL diretamente. Se não houver imagem no
  Commons, o backend mantém como alternativa o URL IIIF do AIC. Para URLs IIIF
  antigos ou de fallback, `imageSrc()` no front-end deteta `artic.edu` e encaminha
  a imagem por `/external/image?src=...`; o backend valida o host e o caminho e
  aplica cache em memória. Se a URL estiver ausente, inválida ou a imagem não
  carregar, o componente apresenta o placeholder “Imagem indisponível”.
- **Cancelamento:** só o dono do lote e só antes de liquidado. Usa o mesmo
  bloqueio de linha (`FOR UPDATE`) dos lances. Se já houver líder, o valor
  comprometido é libertado (volta ao disponível) na mesma transação.
- **Republicação de obras:** o enunciado não impede voltar a leiloar uma obra
  já arrematada, por isso não existe regra extra de bloqueio. A busca e a criação
  continuam a liquidar primeiro os lotes vencidos, para o estado da vitrine estar
  sempre atualizado.
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

## Fusos horários e datas

Instantes são guardados em colunas PostgreSQL `TIMESTAMPTZ` e transportados como
ISO 8601 UTC (com `Z` ou offset explícito). O backend força `TZ=UTC` no arranque;
Docker Compose e Render também declaram `TZ=UTC`. O endpoint `/time` lê
`clock_timestamp()` da base de dados e devolve um instante UTC sem cache.

A interface formata datas e horas na zona local do navegador, sem fuso fixo, e
mostra o nome dessa zona junto das horas relevantes. O formulário
`datetime-local` converte explicitamente a hora local para um instante UTC no
envio. A contagem regressiva sincroniza-se com `/time`, compensa metade do RTT,
usa o relógio monotónico do navegador, atualiza a cada segundo, volta a medir a
cada 60 segundos e quando a página fica visível. O estado definitivo do lote é
calculado pelo relógio da base de dados, não pelo relógio do utilizador.

Não foi necessária migration de data/hora: a migration inicial já criou todas
as colunas temporais como `TIMESTAMPTZ`. Converter novamente poderia deslocar
instantes existentes.

## Dinheiro e precisão numérica

Todos os valores monetários ficam em centavos inteiros em colunas PostgreSQL
`BIGINT`. No backend, cálculos, comparações, incrementos, saldos e liquidação
usam `BigInt`; a API REST transmite centavos em strings decimais (por exemplo,
`"12345600"`), porque JSON não serializa `BigInt` e o tipo JavaScript `Number`
perde precisão acima de $2^{53}-1$. O front converte os textos recebidos para
`BigInt`, calcula sem ponto flutuante e formata somente para exibição.

`MIN_DEPOSIT_CENTS`, `MAX_DEPOSIT_CENTS` e `MAX_WALLET_CENTS` configuram os
limites. Por padrão, o depósito máximo é R$ 1.000.000.000,00 e o saldo máximo
é o BIGINT positivo do PostgreSQL. Os valores são lidos em centavos; erros de
limite devolvem códigos estáveis e mensagem em português.

A cadeia HMAC existente já canonicalizava `amountCents` como texto decimal
antes de serializar o array. A migração mantém exatamente essa representação;
assim, hashes já gravados permanecem válidos e novos lances com `BigInt` geram
os mesmos bytes canónicos.

## Mensagens e idioma

As mensagens de erro legíveis escritas pela aplicação e as validações da API
estão centralizadas em `backend/src/messages.ts` e são devolvidas em português.
O formato preserva o campo `error` e os códigos estáveis em inglês (por exemplo,
`BID_BELOW_MINIMUM`), usados pelo front-end para lógica e traduções. Mensagens
genéricas do protocolo/framework, como `403 Forbidden`, `404 Not Found` e
`500 Internal Server Error`, permanecem em inglês de propósito: não são erros
específicos da aplicação e não devem ser mascarados.

## Credenciais de teste (seed)

Rodar `npm run seed` na pasta `backend`.

| Papel | Email | Senha |
|---|---|---|
| Leiloeiro | leiloeiro@leilao.com | `Leilao@123` |
| Licitante | ana@leilao.com | `Leilao@123` |
| Licitante | bruno@leilao.com | `Leilao@123` |

O seed cria automaticamente um **lote ao vivo (Water Lilies — Monet)** com 3 lances já feitos (Ana está ganhando), para que o avaliador possa percorrer o fluxo completo sem montar nada do zero. Pode ser executado várias vezes: se o lote ainda estiver aberto, reutiliza-o; se já tiver terminado, cria um novo lote ao vivo com os mesmos dados.

Após o seed, os URLs do lote e da auditoria são impressos no terminal.

## Testes automatizados

Todos os testes do backend vivem em `backend/test` e usam o runner nativo
`node:test`. Não é preciso
navegador, `curl` ou `jq`.

```bash
cd backend

npm test                  # testes unitários do backend
npm run test:integration  # testes de integração contra PostgreSQL real
npm run test:all          # ambos
```

Na pasta `frontend`, `npm test` executa os testes de dinheiro e fuso horário.

Os testes unitários não precisam de base de dados. Os de integração leem
`backend/.env.test`, **apagam e recriam o schema `public`** da base indicada e
recusam correr se o nome da base não contiver `test`. Os ficheiros correm em
série (`--test-concurrency=1`) porque partilham esse schema. Crie a base uma vez:

```bash
sudo -u postgres psql -c "CREATE DATABASE leilao_test OWNER leilao;"
# ou, se o utilizador já tiver permissão:
createdb -h localhost -U leilao leilao_test
```

Na revisão de precisão monetária, foram executados com sucesso os testes
unitários, de integração (PostgreSQL real), de front-end e de migração/seed.
Execute `npm run test:all` na pasta `backend` e `npm test` na pasta `frontend`.

O HTTP para `api.artic.edu` e para o Wikimedia Commons é simulado nos testes,
por isso correm offline e de forma determinística; a base de dados é real.

| Categoria | O que cobre |
|---|---|
| Auth e papéis | Registo, duplicado, login errado, `/auth/me`, bloqueio de rotas por papel |
| API externa | Busca autenticada e falha `503` isolada sem derrubar a vitrine |
| Lotes | Criação agendada/ao vivo, lance antes da hora, cancelamento e ocultação |
| Lances | Primeiro lance, incremento, auto-lance, saldo e superação |
| Carteira | Total, comprometido e disponível após lances, estorno e liquidação |
| Sala | Histórico, posição do licitante e pseudónimos sem dados pessoais |
| Liquidação | Débito/crédito, lote sem lances, comprovante público e cancelamento bloqueado |
| Anti-sniping | Prorrogação de +2 min no fim do lote |
| Auditoria | Cadeia íntegra e deteção de alteração direta no banco |
| Republicação | A mesma obra pode ser publicada outra vez, como o enunciado permite |

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
| Deploy público | ⚠️ **Ainda não publicado.** Configuração pronta em [Deploy](#deploy); falta executar o deploy e colar as URLs |
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
| Docker Compose | ✅ | `docker compose up` sobe PostgreSQL, migrations/seed, API e front-end; os dados persistem no volume |
| Testes automatizados | ✅ | 31 unitários + 19 de integração no backend (`node:test`, PostgreSQL real e API externa simulada), além de 23 testes do front |
| Dark Mode | ✅ | Toggle no navbar em todas as páginas (incluindo login); preferência guardada em `localStorage` |

## Limitações e comportamentos conhecidos

- O papel (leiloeiro ou licitante) é escolhido livremente no registo, porque o
  enunciado não define como alguém se torna leiloeiro. Numa aplicação real,
  isso seria restrito.
- Recuperação de senha não foi implementada (fora do escopo do enunciado).
- Imagens novas priorizam o CDN do Wikimedia Commons. Se a obra não estiver lá,
  é tentado o URL IIIF do AIC via proxy; se também falhar, mostra-se o placeholder.
- O front usa polling (a cada 1–2 s) em vez de WebSocket. Num produto real
  usaria SSE ou WebSocket; polling foi suficiente para os requisitos do teste.
- O serviço gratuito do Render pode adormecer. O agendador para nesse período;
  a liquidação preguiçosa ocorre na próxima leitura da API.
- Se o Art Institute ou o Wikimedia Commons falharem, a pesquisa/criação pode
  falhar ou a imagem usar o fallback/placeholder. A interface mostra o erro da
  pesquisa, mas não existe ainda um aviso persistente indicando modo degradado.
- O seed é idempotente e mantém um lote ao vivo com três lances; não cria ainda
  exemplos de todos os estados (agendado, encerrado, sem lances e a terminar em
  2–3 minutos). Os dados atuais de produção podem acumular lotes encerrados de
  execuções anteriores do seed.

## Uso de IA

O desenvolvimento foi feito em **três fases** com abordagens distintas:

### Fase 1 — Back-end (feito manualmente)

Todo o back-end foi desenvolvido **sem assistência de IA**. Isto incluiu:

- Modelagem do banco de dados e migrations SQL
- Módulos de autenticação, carteira, lotes e lances
- Transações com `SELECT ... FOR UPDATE` para concorrência segura
- Algoritmo da cadeia de hashes HMAC-SHA256
- Lógica de anti-sniping, liquidação idempotente e pseudónimos
- Integração com a API do Art Institute of Chicago e imagens do Wikimedia Commons

O objetivo era provar domínio real das tecnologias avaliadas (PostgreSQL com
locks, consistência financeira, segurança, testes) antes de qualquer auxílio externo.

### Fase 2 — Front-end (com assistência de IA)

Após o back-end estar completo e testado, a **Claude Sonnet 4.6 e OpenCode Big Pickle** foi
usada para acelerar a construção da interface React, por ser um trabalho
predominantemente de scaffolding e composição de componentes com padrões já
estabelecidos. A IA:

- Gerou os componentes React com base na estrutura de tipos do back-end já existente
- Criou o design system (CSS properties, dark mode, responsividade)
- Compôs as páginas (vitrine, sala de lances, carteira, painel, auditoria, comprovante)
- Corrigiu erros de TypeScript e de build apontados durante o desenvolvimento

Toda a lógica crítica (hooks de polling, countdown sincronizado com o servidor,
deteção de prorrogação anti-sniping) foi revista e ajustada manualmente.

### Fase 3 — Revisão, testes e endurecimento (com IA)

A revisão final contou com apoio de assistentes de IA na auditoria contra o
enunciado, correções, testes e documentação. As alterações foram revistas; a
execução local e o estado atual dos testes são reportados separadamente, pois
dependem de PostgreSQL e permissões locais.

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
10. Build de produção, testes, deploy e documentação

## Deploy

**Deploy configurado; disponibilidade verificada em 27/10/2026:**
- Front-end: https://leilao-lemon.vercel.app
- API: https://leilao-eof8.onrender.com
- Health check: https://leilao-eof8.onrender.com/health

O repositório inclui `render.yaml` (Render Blueprint) e
`frontend/vercel.json`, por isso não é necessário criar Dockerfiles.

**Back-end no Render + PostgreSQL no Neon:**
- Crie uma base PostgreSQL no Neon e copie a connection string (com
  `sslmode=require`).
- Importe o repositório como Blueprint. O `render.yaml` cria apenas o serviço
  Node 22; a base fica no Neon (não é criada outra base no Render).
- Root directory: `backend`
- Build: `npm ci --include=dev && npm run build`
- Start: `npm run start:deploy` (migra, corre o seed idempotente e arranca a API)
- Health check: `/health`
- Variáveis: `DATABASE_URL` (connection string do Neon), `JWT_SECRET`,
  `HMAC_SECRET` (gerados), `FRONTEND_URL` (URL do Vercel) e `TZ=UTC`.
- A variável chama-se **`DATABASE_URL`**, não `DB_DATABASE` ou `DB_HOST`.

**Front-end no Vercel:**
- Importe o mesmo repositório com **Root Directory = `frontend`**.
- Não defina Install/Build/Output manualmente no dashboard: o
  `frontend/vercel.json` já usa `npm ci`, `npm run build`, output `dist` e o
  rewrite `/* → /index.html` para o React Router.
- Variável de ambiente (Production e Preview): `API_URL` = URL pública do
  Render (`https://leilao-eof8.onrender.com`). É uma variável de build; depois
  de a criar ou alterar, faça novo deploy.
- No Render, `FRONTEND_URL` = `https://leilao-lemon.vercel.app` (o backend
  normaliza a origem, por isso pode incluir path ou barra final).
- O teste ao vivo foi concluído durante esta revisão: o health check respondeu
  `ok: true` com `dbTime` UTC. O serviço gratuito estava a acordar e a primeira
  chamada de health check devolveu `503`; repita a chamada após o arranque.
- O `vite.config.ts` expõe o prefixo `API_` ao browser, por isso não é preciso
  `VITE_API_URL`. Nunca uses este prefixo para segredos.