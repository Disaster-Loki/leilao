#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run_tests.sh  —  Testes de integração da Casa de Leilões
#
# O que é testado:
#   1. Health / vitrine pública
#   2. Registo e login (leiloeiro e licitantes)
#   3. Validações de segurança (senha fraca, email duplicado)
#   4. Carteira (consulta, depósito, permissões)
#   5. Busca na API externa
#   6. Criação e cancelamento de lote
#   7. Regras de lance (mínimo, saldo, auto-lance, leiloeiro proibido)
#   8. Saldo comprometido / devolvido
#   9. Sala ao vivo (status, histórico)
#  10. Meus arremates
#  11. Auditoria pública (cadeia de hashes)
#  12. Segurança — rotas protegidas sem token
#
# Uso:
#   chmod +x run_tests.sh
#   BASE_URL=http://localhost:3000 ./run_tests.sh
#
# Pré-requisitos: curl, jq
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
ERRORS=()
TOKEN=""

# ── helpers ──────────────────────────────────────────────────────────────────
green() { printf "\033[32m  ✔ %s\033[0m\n" "$1"; }
red()   { printf "\033[31m  ✖ %s\033[0m\n" "$1"; }
blue()  { printf "\n\033[34m▶ %s\033[0m\n" "$1"; }

ok()   { PASS=$((PASS + 1)); green "$1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+=("$1"); red "$1"; }

req() {
  local method="$1" path="$2" expected="$3"
  shift 3
  local code
  local args=(-s -o /tmp/lb -w "%{http_code}" -X "$method" "$BASE$path" -H "Content-Type: application/json")
  [ -n "$TOKEN" ] && args+=(-H "Authorization: Bearer $TOKEN")
  code=$(curl "${args[@]}" "$@" 2>/dev/null) || code="000"
  BODY=$(cat /tmp/lb 2>/dev/null || echo "{}")
  [ "$code" = "$expected" ]
}

jq_val() { echo "$BODY" | jq -r "$1" 2>/dev/null || echo ""; }

# ─────────────────────────────────────────────────────────────────────────────
blue "1. Vitrine pública (health)"
TOKEN=""
if req GET /lots 200; then ok "API está no ar"
else fail "API não responde em $BASE"; echo "Abortando."; exit 1; fi

# ─────────────────────────────────────────────────────────────────────────────
blue "2. Registo e login"
S="$RANDOM"
AUC_EMAIL="leiloeiro_$S@test.com"
B1_EMAIL="ana_$S@test.com"
B2_EMAIL="bruno_$S@test.com"

req POST /auth/register 201 -d "{\"email\":\"$AUC_EMAIL\",\"name\":\"Leiloeiro T\",\"password\":\"Teste@1234\",\"role\":\"auctioneer\"}" \
  && ok "Registo leiloeiro" || fail "Registo leiloeiro"

req POST /auth/register 201 -d "{\"email\":\"$B1_EMAIL\",\"name\":\"Ana T\",\"password\":\"Teste@1234\",\"role\":\"bidder\"}" \
  && ok "Registo Ana" || fail "Registo Ana"

req POST /auth/register 201 -d "{\"email\":\"$B2_EMAIL\",\"name\":\"Bruno T\",\"password\":\"Teste@1234\",\"role\":\"bidder\"}" \
  && ok "Registo Bruno" || fail "Registo Bruno"

# Validações
req POST /auth/register 400 -d "{\"email\":\"w_$S@t.com\",\"name\":\"T\",\"password\":\"abc\",\"role\":\"bidder\"}" \
  && ok "Rejeita senha fraca (<8 chars)" || fail "Deve rejeitar senha fraca"

req POST /auth/register 400 -d "{\"email\":\"w_$S@t.com\",\"name\":\"T\",\"password\":\"abcdefgh\",\"role\":\"bidder\"}" \
  && ok "Rejeita senha sem número" || fail "Deve rejeitar senha sem número"

req POST /auth/register 400 -d "{\"email\":\"nao-e-email\",\"name\":\"T\",\"password\":\"Teste@1234\",\"role\":\"bidder\"}" \
  && ok "Rejeita email inválido" || fail "Deve rejeitar email inválido"

req POST /auth/register 409 -d "{\"email\":\"$AUC_EMAIL\",\"name\":\"Dup\",\"password\":\"Teste@1234\",\"role\":\"auctioneer\"}" \
  && ok "Rejeita email duplicado" || fail "Deve rejeitar email duplicado"

# Logins
req POST /auth/login 200 -d "{\"email\":\"$AUC_EMAIL\",\"password\":\"Teste@1234\"}" \
  && { AUC_TOKEN=$(jq_val '.token'); ok "Login leiloeiro"; } || { fail "Login leiloeiro"; AUC_TOKEN=""; }

req POST /auth/login 200 -d "{\"email\":\"$B1_EMAIL\",\"password\":\"Teste@1234\"}" \
  && { B1_TOKEN=$(jq_val '.token'); ok "Login Ana"; } || { fail "Login Ana"; B1_TOKEN=""; }

req POST /auth/login 200 -d "{\"email\":\"$B2_EMAIL\",\"password\":\"Teste@1234\"}" \
  && { B2_TOKEN=$(jq_val '.token'); ok "Login Bruno"; } || { fail "Login Bruno"; B2_TOKEN=""; }

req POST /auth/login 401 -d "{\"email\":\"$AUC_EMAIL\",\"password\":\"errada\"}" \
  && ok "Rejeita senha errada" || fail "Deve rejeitar senha errada"

# ─────────────────────────────────────────────────────────────────────────────
blue "3. Carteira"
TOKEN="$B1_TOKEN"
req GET /wallet 200 && ok "Consulta carteira" || fail "Consulta carteira"

req POST /wallet/deposit 201 -d '{"amountCents":500000}' \
  && ok "Depósito R\$5.000,00 (Ana)" || fail "Depósito Ana"

TOKEN="$B2_TOKEN"
req POST /wallet/deposit 201 -d '{"amountCents":500000}' \
  && ok "Depósito R\$5.000,00 (Bruno)" || fail "Depósito Bruno"

TOKEN="$AUC_TOKEN"
req POST /wallet/deposit 403 -d '{"amountCents":100}' \
  && ok "Leiloeiro não pode depositar" || fail "Leiloeiro não deve poder depositar"

TOKEN="$B1_TOKEN"
req POST /wallet/deposit 400 -d '{"amountCents":-1}' \
  && ok "Rejeita depósito negativo" || fail "Deve rejeitar depósito negativo"

# ─────────────────────────────────────────────────────────────────────────────
blue "4. API externa"
TOKEN="$AUC_TOKEN"
req GET "/external/artworks?q=monet" 200 \
  && { EXT_ID=$(jq_val '.[0].externalId'); ok "Busca externa (Monet)"; } \
  || { fail "Busca externa"; EXT_ID="16568"; }

# ─────────────────────────────────────────────────────────────────────────────
blue "5. Criação e cancelamento de lote"
TOKEN="$AUC_TOKEN"
NOW_E=$(date +%s)
S_PAST=$(date -u -d "@$((NOW_E-3600))" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -r $((NOW_E-3600)) +"%Y-%m-%dT%H:%M:%SZ")
S_FUT=$(date -u -d "@$((NOW_E+3600))" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -r $((NOW_E+3600)) +"%Y-%m-%dT%H:%M:%SZ")
E_FUT=$(date -u -d "@$((NOW_E+7200))" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -r $((NOW_E+7200)) +"%Y-%m-%dT%H:%M:%SZ")

# Lote agendado (para cancelar)
req POST /lots 201 -d "{\"externalId\":\"$EXT_ID\",\"startPriceCents\":100000,\"minIncrementCents\":10000,\"startAt\":\"$S_FUT\",\"endAt\":\"$E_FUT\"}" \
  && { SCHED_ID=$(jq_val '.id'); ok "Cria lote agendado"; } || { fail "Cria lote agendado"; SCHED_ID=""; }

# Lote ao vivo
req POST /lots 201 -d "{\"externalId\":\"$EXT_ID\",\"startPriceCents\":50000,\"minIncrementCents\":5000,\"startAt\":\"$S_PAST\",\"endAt\":\"$E_FUT\"}" \
  && { LIVE_ID=$(jq_val '.id'); ok "Cria lote ao vivo"; } || { fail "Cria lote ao vivo"; LIVE_ID=""; }

# Licitante não pode criar lote
TOKEN="$B1_TOKEN"
req POST /lots 403 -d "{\"externalId\":\"$EXT_ID\",\"startPriceCents\":100000,\"minIncrementCents\":10000,\"startAt\":\"$S_FUT\",\"endAt\":\"$E_FUT\"}" \
  && ok "Licitante não pode criar lote" || fail "Licitante não deve criar lote"

# Cancela lote agendado
TOKEN="$AUC_TOKEN"
if [ -n "$SCHED_ID" ]; then
  req POST "/lots/$SCHED_ID/cancel" 204 \
    && ok "Cancela lote sem lances" || fail "Cancela lote sem lances"

  # Não aparece na vitrine
  TOKEN=""
  req GET /lots 200 && \
    echo "$BODY" | jq -e "[.live,.scheduled,.ended|.[]|select(.id==\"$SCHED_ID\")]|length==0" >/dev/null 2>&1 \
    && ok "Cancelado não aparece na vitrine" || fail "Cancelado não deve aparecer na vitrine"
fi

# ─────────────────────────────────────────────────────────────────────────────
blue "6. Regras de lance"
if [ -z "$LIVE_ID" ]; then
  echo "  (Pulando — lote ao vivo não criado)"
else
  # Lance abaixo do mínimo
  TOKEN="$B1_TOKEN"
  req POST "/lots/$LIVE_ID/bids" 400 -d '{"amountCents":1}' \
    && ok "Rejeita lance abaixo do mínimo" || fail "Deve rejeitar lance abaixo do mínimo"

  # 1º lance válido — Ana (= lance inicial)
  req POST "/lots/$LIVE_ID/bids" 201 -d '{"amountCents":50000}' \
    && ok "1º lance aceito (Ana, R\$500,00)" || fail "1º lance deve ser aceito"

  # Ana não pode cobrir o próprio lance
  req POST "/lots/$LIVE_ID/bids" 400 -d '{"amountCents":60000}' \
    && ok "Rejeita auto-lance (já está ganhando)" || fail "Deve rejeitar auto-lance"

  # Bruno supera Ana
  TOKEN="$B2_TOKEN"
  req POST "/lots/$LIVE_ID/bids" 201 -d '{"amountCents":55000}' \
    && ok "2º lance aceito (Bruno, R\$550,00)" || fail "2º lance deve ser aceito"

  # Saldo insuficiente
  TOKEN="$B1_TOKEN"
  req POST "/lots/$LIVE_ID/bids" 400 -d '{"amountCents":9999999999}' \
    && ok "Rejeita saldo insuficiente" || fail "Deve rejeitar saldo insuficiente"

  # Lance incremental abaixo do mínimo (55000 + 5000 = 60000 mínimo, 55001 não chega)
  req POST "/lots/$LIVE_ID/bids" 400 -d '{"amountCents":55001}' \
    && ok "Rejeita incremental abaixo do mínimo" || fail "Deve rejeitar incremental abaixo do mínimo"

  # Ana supera Bruno com valor correto
  req POST "/lots/$LIVE_ID/bids" 201 -d '{"amountCents":60000}' \
    && ok "3º lance aceito (Ana, R\$600,00)" || fail "3º lance deve ser aceito"

  # Leiloeiro não pode dar lances
  TOKEN="$AUC_TOKEN"
  req POST "/lots/$LIVE_ID/bids" 403 -d '{"amountCents":70000}' \
    && ok "Leiloeiro não pode dar lances" || fail "Leiloeiro não deve dar lances"

  # ── Saldo comprometido ────────────────────────────────────────────────────
  blue "7. Saldo comprometido"
  TOKEN="$B1_TOKEN"
  req GET /wallet 200 && {
    C=$(jq_val '.committedCents')
    [ "$C" = "60000" ] \
      && ok "Ana: comprometido correto (R\$600,00)" \
      || fail "Ana: comprometido esperado 60000, got $C"
  } || fail "Carteira Ana"

  TOKEN="$B2_TOKEN"
  req GET /wallet 200 && {
    C=$(jq_val '.committedCents')
    [ "$C" = "0" ] \
      && ok "Bruno: saldo devolvido após ser superado" \
      || fail "Bruno: comprometido esperado 0, got $C"
  } || fail "Carteira Bruno"
fi

# ─────────────────────────────────────────────────────────────────────────────
blue "8. Sala ao vivo"
TOKEN=""
if [ -n "$LIVE_ID" ]; then
  req GET "/lots/$LIVE_ID/room" 200 && {
    STATUS=$(jq_val '.lot.status')
    BC=$(jq_val '.bids | length')
    [ "$STATUS" = "live" ] && ok "Sala: status=live" || fail "Sala deve ter status=live"
    ok "Sala: $BC lances no histórico"
  } || fail "Sala ao vivo"
fi

# ─────────────────────────────────────────────────────────────────────────────
blue "9. Meus arremates"
TOKEN="$B1_TOKEN"
req GET /my/bids 200 && ok "Meus arremates acessível" || fail "Meus arremates"

# ─────────────────────────────────────────────────────────────────────────────
blue "10. Auditoria pública"
TOKEN=""
if [ -n "$LIVE_ID" ]; then
  req GET "/audit/$LIVE_ID" 200 && {
    V=$(jq_val '.valid')
    [ "$V" = "true" ] \
      && ok "Auditoria: cadeia íntegra ✓" \
      || fail "Auditoria reportou adulteração inesperada"
  } || fail "Auditoria pública"
fi

# ─────────────────────────────────────────────────────────────────────────────
blue "11. Cancelamento com estorno"
if [ -n "$LIVE_ID" ]; then
  TOKEN="$B1_TOKEN"
  req GET /wallet 200 && {
    COMMITTED_BEFORE=$(jq_val '.committedCents')
    AVAILABLE_BEFORE=$(jq_val '.availableCents')
  } || { COMMITTED_BEFORE=0; AVAILABLE_BEFORE=0; }

  TOKEN="$AUC_TOKEN"
  req POST "/lots/$LIVE_ID/cancel" 204 \
    && ok "Cancela lote com lances" || fail "Deve cancelar lote com lances"

  TOKEN="$B1_TOKEN"
  req GET /wallet 200 && {
    C=$(jq_val '.committedCents')
    A=$(jq_val '.availableCents')
    [ "$C" = "0" ] && ok "Ana: comprometido libertado" \
      || fail "Ana: comprometido deveria ser 0, got $C"
    [ "$A" = "$((AVAILABLE_BEFORE + COMMITTED_BEFORE))" ] \
      && ok "Ana: saldo disponível reposto pelo estorno" \
      || fail "Ana: disponível esperado $((AVAILABLE_BEFORE + COMMITTED_BEFORE)), got $A"
  } || fail "Carteira Ana após cancelamento"
fi

# ─────────────────────────────────────────────────────────────────────────────
blue "12. Segurança — rotas protegidas"
TOKEN=""
req GET /wallet 401     && ok "Carteira exige token"        || fail "Carteira deve exigir token"
req POST /lots 401 -d '{}' && ok "Criar lote exige token"  || fail "Criar lote deve exigir token"
req GET /my/bids 401    && ok "Meus arremates exige token"  || fail "Meus arremates deve exigir token"
req GET "/lots/mine" 401 && ok "Panel exige token"          || fail "Panel deve exigir token"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
printf "  \033[32m%d passaram\033[0m  \033[31m%d falharam\033[0m\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "Falhas:"
  for e in "${ERRORS[@]}"; do red "  $e"; done
  echo ""
  exit 1
fi

green "Todos os testes passaram!"
exit 0
