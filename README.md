# Casa de Leilões

Plataforma de leilões online em que um leiloeiro publica lotes (obras de arte
obtidas da API pública do Art Institute of Chicago) e licitantes disputam cada
lote com lances ao vivo, usando saldo simulado.

> Projeto desenvolvido para o teste técnico Elite Dev da Verzel.

## Acesso rápido

| O quê | Onde |
|---|---|
| Aplicação (front-end) | https://leilao-lemon.vercel.app |
| API (back-end) | https://leilao-eof8.onrender.com |
| Health check | https://leilao-eof8.onrender.com/health |

> **Atenção:** o back-end está no plano gratuito do Render, que adormece após
> inatividade. A primeira chamada pode demorar 30-60 s (e o health check pode
> devolver `503` enquanto acorda). Abra a API uma vez e tente de novo.

**Contas de teste** (senha de todas: `Leilao@123`):

| Papel | E-mail |
|---|---|
| Leiloeiro | leiloeiro@leilao.com |
| Licitante | ana@leilao.com |
| Licitante | bruno@leilao.com |

Existe um lote ao vivo (Water Lilies, Monet) com 3 lances. Dica: abra duas
janelas, uma como Ana e outra como Bruno, e acompanhe a disputa em tempo real.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + Vite + TypeScript |
| Back-end | Node.js + Express 5 + TypeScript |
| Banco de dados | PostgreSQL (migrations com `node-pg-migrate`) |
| API externa | Art Institute of Chicago (`api.artic.edu`) e Wikimedia Commons (imagens) |
| Hospedagem | Vercel (front), Render (API), Neon (PostgreSQL) |

### Por que cada tecnologia

| Tecnologia | Motivo |
|---|---|
| **PostgreSQL** | O coração do sistema é dinheiro e concorrência. Precisa de transações reais e de `SELECT ... FOR UPDATE`, algo que um banco NoSQL tornaria mais arriscado. |
| **Express (e não NestJS)** | O escopo é de um produto base com prazo curto. A segurança não depende do framework: vem de bcrypt, verificação de papel em cada rota, validação com Zod, regras de dinheiro no servidor e transações. Express com módulos por domínio entrega a mesma organização sem o custo do boilerplate. |
| **TypeScript** | Com dinheiro e regras de estado, os tipos apanham erros antes de executar. |
| **SQL direto com `pg`** | A transação crítica de lances fica explícita e auditável, em vez de escondida num ORM. |
| **Zod** | Validação de toda a entrada, com mensagens e códigos de erro estáveis. |
| **bcryptjs + JWT** | Senhas cifradas; sessão sem estado no header `Authorization`, o que evita problemas de cookies entre domínios (Vercel e Render). |
| **React + Vite** | Rápido de construir e de publicar como site estático. |
| **node-pg-migrate** | Evolução do banco versionada, em SQL puro e legível. |
| **node:test** | Runner nativo do Node, sem dependências extra para os testes. |

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
├── docker-compose.yml         PostgreSQL + API + front-end
├── render.yaml                blueprint do back-end no Render
├── frontend/vercel.json       build e rewrites do front-end no Vercel
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
não há Dockerfiles no repositório. O back-end instala, compila (`tsc`), aplica as
migrations pendentes, executa o seed idempotente e arranca com `NODE_ENV=production`
(`node dist/server.js`). O front-end é compilado (`vite build`) e servido como site
estático, sem servidor de desenvolvimento.

Os dados permanecem no volume `pgdata` entre arranques. Para apagar a base local e
começar de novo, use `docker compose down -v`. O PostgreSQL fica exposto no host em
**5433** para não colidir com uma instalação local na 5432.

A primeira execução demora alguns minutos (instala dependências e compila). Aguarde
até ver `Seed concluído.` no log. Depois abra:

| Serviço | URL |
|---|---|
| Front-end | http://localhost:5173 |
| API | http://localhost:3000 |

Para parar e apagar os volumes (banco):

```bash
docker compose down -v
```

Os segredos do compose são só de desenvolvimento. Para sobrescrever, crie um `.env`
na **raiz** com `POSTGRES_PASSWORD`, `JWT_SECRET` e `HMAC_SECRET`. O Compose **não**
lê os `.env` de `backend/` e `frontend/`.

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

### Resolução de problemas locais

- **Porta 3000 já em uso:** não inicie outra cópia da API enquanto o serviço do
  Docker Compose estiver ativo. Escolha um único modo: pare os serviços com
  `docker compose down` (os dados do volume são preservados) para usar a execução
  local, ou mantenha o Compose. Também pode iniciar a API noutra porta, por
  exemplo `PORT=3001 npm run start`; nesse caso, ajuste `API_URL` do front-end para
  `http://localhost:3001` e reinicie/reconstrua o front.
- **Permissão negada durante o build Vite:** execute `npm install` e os builds
  como o utilizador normal, nunca com `sudo`. O script de build usa o carregador
  `runner` do Vite para evitar ficheiros temporários de configuração em
  `node_modules/.vite-temp`.
- **`getaddrinfo ENOTFOUND ...` ao ligar ao banco:** a senha tem caracteres
  especiais (`@`, `#`, `/`) que quebram a URL. Use percent-encoding (`@` vira `%40`)
  ou uma senha simples em desenvolvimento.
- **`The server does not support SSL connections`:** o SSL só deve ser ativado quando
  a `DATABASE_URL` traz `sslmode=require` (Neon). Ver
  [Problemas encontrados](#problemas-encontrados-e-como-foram-resolvidos).

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
| `DATABASE_URL` | Connection string do PostgreSQL. Caracteres especiais na senha precisam de percent-encoding (`@` vira `%40`). SSL só é usado se a URL tiver `sslmode=require` |
| `JWT_SECRET` | Segredo para assinar tokens de login |
| `HMAC_SECRET` | Segredo da cadeia de hashes da auditoria. Deve ficar fora do banco |
| `FRONTEND_URL` | Origem permitida no CORS |
| `MIN_DEPOSIT_REAIS` | Depósito mínimo em reais (padrão `1`) |
| `MAX_DEPOSIT_REAIS` | Limite por depósito em reais (padrão `1000000000`) |
| `MAX_WALLET_REAIS` | Saldo total máximo por carteira em reais (padrão BIGINT máximo) |

> **Importante:** `HMAC_SECRET` deve ser o mesmo em que o seed foi executado. Se
> mudar o segredo depois de semear, a auditoria acusa "adulterado" nos lotes antigos.

### frontend/.env

| Variável | Descrição |
|---|---|
| `API_URL` | URL base da API (pública). Variável de **build**: ao alterá-la, refaça o build |

## Papéis e permissões

| Ação | Leiloeiro | Licitante | Público |
|---|---|---|---|
| Criar/cancelar lotes | Sim | Não | Não |
| Depositar saldo | Não | Sim | Não |
| Dar lances | Não | Sim | Não |
| Ver carteira | Sim | Sim | Não |
| Ver auditoria e comprovante | Sim | Sim | Sim |

As permissões são verificadas **no servidor** em cada rota (middleware
`requireRole`), não apenas escondidas na interface.

## Decisões técnicas

- **Dinheiro em inteiros** (`BIGINT`), nunca `float`, para evitar erros de
  arredondamento (`0.1 + 0.2` não é `0.3` em ponto flutuante).
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
- **Gestão da conta e dos lotes:** utilizadores podem atualizar nome, e-mail e
  senha em `/account`, confirmando a senha atual. Só se elimina uma conta sem
  lotes, lances, saldo ou movimentos financeiros. Leiloeiros podem editar os
  dados e a obra de um lote agendado enquanto não tiver começado nem recebido
  lances; podem eliminar lotes agendados sem lances (ou cancelados sem lances).
  Lotes com lances não são apagados/editados, para preservar comprovantes,
  saldos e a cadeia de auditoria; continuam disponíveis as operações de
  cancelamento previstas.
- **Republicação de obras:** o enunciado não impede voltar a leiloar uma obra
  já arrematada, por isso não existe regra extra de bloqueio. A busca e a criação
  continuam a liquidar primeiro os lotes vencidos, para o estado da vitrine estar
  sempre atualizado.
- Só aparecem na busca obras de domínio público e com imagem.
- **Lances atómicos:** cada lance corre numa transação PostgreSQL que bloqueia o
  lote (`SELECT ... FOR UPDATE`) e depois as carteiras envolvidas, sempre por ordem
  de id (evita deadlock). Validação, saldo comprometido, gravação do lance e
  prorrogação acontecem na mesma transação. A hora do lance vem do relógio do banco
  (`clock_timestamp()`), nunca do cliente.
- **Anti-sniping:** lance aceito com 2 min ou menos para o fim move o fim para
  `agora + 2 min`, dentro da mesma transação do lance.
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
- **Comprovante público e anónimo:** link por UUID (não adivinhável), com o vencedor
  como pseudónimo e o hash final da cadeia de lances.
- **Tempo real por polling:** a sala consulta `/lots/:id/room` a cada 1-2 s.
  Escolha deliberada: é resiliente a hospedagem gratuita que adormece ou corta
  conexões longas, mantém a autenticação por header e reaproveita um endpoint já
  testado. Evolução natural: SSE.

## Problemas encontrados e como foram resolvidos

Registo dos problemas reais que apareceram durante o desenvolvimento, com a causa e
a solução adotada.

### 1. Duas pessoas dão lance ao mesmo tempo

**Problema:** dois licitantes enviam o mesmo valor no mesmo milissegundo. Se o
servidor validar os dois em paralelo, ambos seriam aceites e o saldo comprometido
ficaria inconsistente.

**Solução (em camadas):**
1. Cada lance corre numa **transação** que começa por `SELECT ... FOR UPDATE` no
   lote. O segundo lance espera na fila e, ao ser processado, já vê o valor
   atualizado, sendo recusado com `BID_BELOW_MINIMUM`.
2. As carteiras envolvidas são bloqueadas **sempre por ordem de id**, o que evita
   deadlock.
3. A constraint `UNIQUE (lot_id, sequence)` é uma segunda barreira: mesmo que o
   código falhasse, o banco recusa dois lances na mesma posição.
4. `CHECK (committed_cents <= total_cents)` impede saldo comprometido maior que o total.
5. A hora do lance usa `clock_timestamp()` e não `now()`: o `now()` congela no
   início da transação e daria uma hora antiga a quem esperou pelo bloqueio,
   podendo aceitar um lance depois do fim.
6. Comparações monetárias com `BigInt` (os `BIGINT` chegam como texto e
   `"9" > "10"` seria verdadeiro).

**Verificação:** testes de integração disparam lances simultâneos e exigem
exatamente um aceite, sem erros `5xx`, com saldo comprometido igual ao lance atual.

### 2. Imagens da API externa que apareciam e desapareciam

**Problema:** as fotos servidas pelo Art Institute of Chicago (IIIF) falhavam no
navegador de forma intermitente. O AIC bloqueia hotlink (pedidos vindos de outros
sites) através do Cloudflare. Além disso, se a API caísse, a foto sumia.

**Solução:**
- O backend procura a mesma obra no **Wikimedia Commons** (domínio público, CDN
  aberto), primeiro pelo número de inventário, e guarda esse URL no snapshot do lote.
- Para URLs antigas ou de fallback do AIC, o front encaminha a imagem por
  `/external/image`, um **proxy no backend** que valida host e caminho e usa cache.
- Se nada carregar, o componente mostra o placeholder “Imagem indisponível”, e o
  resto do lote (título, lances, preços) continua a funcionar.
- Só entram na busca obras de **domínio público e com imagem**.

### 3. A API externa pode cair

**Problema:** o enunciado exige que vitrine, sala, auditoria e comprovante
continuem a funcionar sem a API.

**Solução:** a API só é usada na busca do leiloeiro e no momento de criar o lote,
onde o servidor copia (snapshot) título, artista, atributos e imagem para o banco.
Depois disso, o lote nunca mais depende dela. Na busca há timeout de 5 s, cache de
5 min e erro `503 EXTERNAL_API_UNAVAILABLE` com mensagem clara.

### 4. Erros de arredondamento com dinheiro

**Problema:** `float` não representa decimais com exatidão (`0.1 + 0.2 = 0.30000000000000004`).

**Solução:** todo o dinheiro é guardado como inteiro em `BIGINT`. O back-end calcula
com `BigInt` e a API transmite os valores como texto de dígitos (o `Number` do
JavaScript perde precisão acima de 2^53−1). A formatação só acontece na exibição.

### 5. Cobrança dupla na liquidação

**Problema:** vários pedidos podem tentar liquidar o mesmo lote ao mesmo tempo, e o
agendador não corre se o servidor estiver a dormir.

**Solução:** a liquidação bloqueia o lote com `FOR UPDATE` e só avança se
`settled_at` estiver vazio, por isso só a primeira tem efeito. Há dois gatilhos: o
agendador (10 s) e a liquidação preguiçosa na próxima leitura. `UNIQUE` em
`receipts.lot_id` é uma barreira adicional. Testado com 8 pedidos simultâneos.

### 6. Detetar a remoção do último lance

**Problema:** numa cadeia de hashes, apagar o **último** lance deixa a cadeia restante
perfeitamente válida.

**Solução:** o lote guarda `head_hash` e `bid_count`, e o comprovante guarda
`final_hash`. A auditoria compara os três, além do valor do comprovante e do
movimento financeiro da venda.

### 7. Falso alarme de adulteração na auditoria

**Problema:** se um lance legítimo entrasse enquanto a auditoria lia o lote e os
lances, os dados seriam de instantes diferentes e a página acusaria adulteração.

**Solução:** a auditoria lê tudo numa transação `REPEATABLE READ READ ONLY`
(snapshot único).

### 8. Relógio do utilizador errado

**Problema:** a contagem regressiva baseada no relógio do navegador falha se o
relógio do utilizador estiver desajustado.

**Solução:** o front sincroniza com `/time` (hora do banco), compensa metade do RTT
e usa o relógio monotónico do navegador. O estado do lote é sempre calculado pelo
servidor.

### 9. SSL: funcionava no Neon e falhava no Docker

**Problema:** o código ativava SSL sempre que o host não era `localhost`. No Docker o
host é `db`, e o PostgreSQL do container não suporta SSL (`The server does not
support SSL connections`).

**Solução:** o SSL passa a depender da connection string (`sslmode=require`, como
traz a do Neon), e não do nome do host.

### 10. Variável de ambiente do front-end não chegava ao navegador

**Problema:** o Vite só expõe ao código do browser variáveis com prefixo configurado;
sem isso, `import.meta.env.API_URL` ficava `undefined` e as chamadas iam para
`undefined/auth/login`. Além disso, é uma variável de **build**.

**Solução:** o `vite.config.ts` expõe o prefixo `API_` e a variável é definida no
Vercel (e em `frontend/.env`); após alterar, faz-se novo deploy. Nunca usar este
prefixo para segredos.

### 11. Servidor gratuito que adormece (cold start)

**Problema:** o Render gratuito adormece, a primeira chamada demora e o agendador pára.

**Solução:** a liquidação preguiçosa cobre o período dormente, e o aviso está
documentado em [Acesso rápido](#acesso-rápido).

### 12. Docker Compose sem Dockerfile

**Problema:** o enunciado pede apenas Docker Compose, e a pasta `node_modules` do
host (binários do sistema) conflitava com a do container (Alpine).

**Solução:** apenas imagens oficiais, com a compilação a correr dentro do container
e `node_modules` num volume anónimo; `npm install` em vez de `npm ci`, que falha
(`EBUSY`) ao apagar uma pasta montada.

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

## Reais e precisão numérica

Todos os valores monetários ficam em reais inteiros em colunas PostgreSQL
`BIGINT`. No backend, cálculos, comparações, incrementos, saldos e liquidação
usam `BigInt`; a API REST transmite reais em strings de dígitos (por exemplo,
`"123456"`), porque JSON não serializa `BigInt` e o tipo JavaScript `Number`
perde precisão acima de $2^{53}-1$. O front lê os textos recebidos como
`BigInt`, calcula sem ponto flutuante e formata somente para exibição.

`MIN_DEPOSIT_REAIS`, `MAX_DEPOSIT_REAIS` e `MAX_WALLET_REAIS` configuram os
limites. Por padrão, o depósito máximo é R$ 1.000.000.000 e o saldo máximo
é o BIGINT positivo do PostgreSQL. Os valores são lidos em reais; erros de
limite devolvem códigos estáveis e mensagem em português.

A cadeia HMAC canonicaliza `amountReais` como texto antes de serializar o
array. Novos lances com `BigInt` geram os mesmos bytes canónicos.

## Mensagens e idioma

As mensagens de erro legíveis escritas pela aplicação e as validações da API
estão centralizadas em `backend/src/messages.ts` e são devolvidas em português.
O formato preserva o campo `error` e os códigos estáveis em inglês (por exemplo,
`BID_BELOW_MINIMUM`), usados pelo front-end para lógica e traduções. Mensagens
genéricas do protocolo/framework, como `403 Forbidden`, `404 Not Found` e
`500 Internal Server Error`, permanecem em inglês de propósito: não são erros
específicos da aplicação e não devem ser mascarados.

## Credenciais de teste (seed)

Rodar `npm run seed` na pasta `backend` (o deploy e o Docker já o executam).

| Papel | Email | Senha |
|---|---|---|
| Leiloeiro | leiloeiro@leilao.com | `Leilao@123` |
| Licitante | ana@leilao.com | `Leilao@123` |
| Licitante | bruno@leilao.com | `Leilao@123` |

O seed cria automaticamente um **lote ao vivo (Water Lilies — Monet)** com 3 lances já feitos (Ana está ganhando), para que o avaliador possa percorrer o fluxo completo sem montar nada do zero. Pode ser executado várias vezes: se o lote ainda estiver aberto, reutiliza-o; se já tiver terminado, cria um novo lote ao vivo com os mesmos dados.

Após o seed, os URLs do lote e da auditoria são impressos no terminal.

## Testes automatizados

Os testes do backend usam o runner nativo `node:test`: os unitários ficam em
`backend/test/unit` e os de integração em `backend/test/integration`. A base
de integração fica em `backend/.env.test` e deve ser criada antes da primeira
execução. Não é preciso navegador, `curl` ou `jq`.

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

Os testes unitários, de integração (PostgreSQL real), de front-end e de
migração/seed cobrem a precisão monetária. Execute `npm run test:all` na pasta
`backend` e `npm test` na pasta `frontend`.

O HTTP para `api.artic.edu` e para o Wikimedia Commons é simulado nos testes,
por isso correm offline e de forma determinística; a base de dados é real.

| Categoria | O que cobre |
|---|---|
| Auth e papéis | Registo, duplicado, login errado, `/auth/me`, bloqueio de rotas por papel |
| API externa | Busca autenticada e falha `503` isolada sem derrubar a vitrine |
| Lotes | Criação agendada/ao vivo, lance antes da hora, cancelamento e ocultação |
| Lances | Primeiro lance, incremento, auto-lance, saldo e superação |
| Concorrência | Lances simultâneos: só um aceite, saldo comprometido consistente |
| Carteira | Total, comprometido e disponível após lances, estorno e liquidação |
| Sala | Histórico, posição do licitante e pseudónimos sem dados pessoais |
| Liquidação | Débito/crédito, lote sem lances, comprovante público, idempotência |
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
| Deploy público | ✅ Front: https://leilao-lemon.vercel.app · API: https://leilao-eof8.onrender.com · Banco: Neon (ver [Deploy](#deploy)) |
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
| API externa pode cair | ✅ Snapshot no lote; só a busca e a criação dependem dela |
| Dados de teste semeados | ✅ Leiloeiro, dois licitantes e lote ao vivo com 3 lances |
| README detalhado | ✅ Este ficheiro (configuração, execução, decisões, problemas e limitações) |

## Funcionalidades opcionais implementadas

| Opcional | Estado | Detalhe |
|---|---|---|
| Busca e filtro de lotes | ✅ | Pesquisa por título/artista/técnica, filtros por estado e ordenação por fim/preço/data |
| Cancelamento com estorno automático | ✅ | O leiloeiro cancela lotes ainda não liquidados; o valor comprometido do líder volta a ficar disponível |
| Docker Compose | ✅ | `docker compose up` sobe PostgreSQL, API e front-end em modo produção; os dados persistem no volume |
| Testes automatizados | ✅ | 31 unitários + 19 de integração no backend (`node:test`, PostgreSQL real e API externa simulada), além de 20 testes do front |
| Dark Mode | ✅ | Toggle no navbar em todas as páginas (incluindo login); preferência guardada em `localStorage` |

## Limitações e comportamentos conhecidos

- O papel (leiloeiro ou licitante) é escolhido livremente no registo, porque o
  enunciado não define como alguém se torna leiloeiro. Numa aplicação real,
  isso seria restrito.
- Recuperação de senha não foi implementada (fora do escopo do enunciado).
- Imagens novas priorizam o CDN do Wikimedia Commons. Se a obra não estiver lá,
  é tentado o URL IIIF do AIC via proxy; se também falhar, mostra-se o placeholder.
- O front usa polling (a cada 1–2 s) em vez de WebSocket/SSE. Isso implica até 2 s
  de atraso e mais requisições ao banco do que um push; é adequado à escala do teste.
- O serviço gratuito do Render pode adormecer. O agendador para nesse período;
  a liquidação preguiçosa ocorre na próxima leitura da API. A primeira chamada após
  inatividade pode demorar 30-60 s.
- Se o Art Institute ou o Wikimedia Commons falharem, a pesquisa/criação pode
  falhar ou a imagem usar o fallback/placeholder. A interface mostra o erro da
  pesquisa, mas não existe ainda um aviso persistente indicando modo degradado.
- O seed é idempotente e mantém um lote ao vivo com três lances; não cria ainda
  exemplos de todos os estados (agendado, encerrado, sem lances e a terminar em
  2–3 minutos). Os dados de produção podem acumular lotes encerrados de
  execuções anteriores do seed.
- O lote do seed termina ao fim de algumas horas. Se estiver encerrado, o seed
  (executado a cada arranque no deploy) cria um novo lote ao vivo.

## Deploy

**Deploy realizado; disponibilidade verificada em 27/10/2026:**
- Front-end: https://leilao-lemon.vercel.app
- API: https://leilao-eof8.onrender.com
- Health check: https://leilao-eof8.onrender.com/health
- Banco: PostgreSQL no Neon

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
- O teste ao vivo foi concluído: o health check respondeu `ok: true` com `dbTime`
  UTC. O serviço gratuito estava a acordar e a primeira chamada devolveu `503`;
  repita a chamada após o arranque.
- O `vite.config.ts` expõe o prefixo `API_` ao browser, por isso não é preciso
  `VITE_API_URL`. Nunca use este prefixo para segredos.