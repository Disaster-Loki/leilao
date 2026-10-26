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
├── backend/    API (Express + TypeScript)
├── frontend/   Interface (React + Vite)
└── README.md
```

## Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL 14 ou superior
- Git

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
- **Cancelamento:** só o dono do lote, e só se não houver lances (`LOT_HAS_BIDS`).
  Usa o mesmo bloqueio de linha (`FOR UPDATE`) dos lances.
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

Rodar `npm run seed` na pasta `backend`. Senha de todos: `123456`.

| Papel | Email | Saldo inicial |
|---|---|---|
| Leiloeiro | leiloeiro@leilao.com | 0,00 |
| Licitante | ana@leilao.com | 5.000,00 |
| Licitante | bruno@leilao.com | 5.000,00 |

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

> _A ser preenchido após deploy em produção._

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