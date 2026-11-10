-- Up Migration

-- Volta a guardar dinheiro em centavos inteiros (BIGINT).
--
-- Contexto: a migration 1792860000000_money-reais converteu as colunas para
-- reais inteiros com divisão por 100. Essa conversão descartou os centavos que
-- existissem na base antiga. Ao multiplicar agora por 100, os dados existentes
-- ficam com centavos = 00. Isso é inevitável e está documentado no README.
--
-- Cadeia de hashes: o valor faz parte do hash de cada lance. Para não invalidar
-- lotes antigos, os lances existentes ficam com hash_version = 1 (formato legado,
-- que canonicaliza o valor em reais) e os novos lances usam hash_version = 2
-- (formato atual, que canonicaliza o valor em centavos).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'total_cents'
  ) THEN
    RAISE EXCEPTION
      'A base já está em centavos. Aplique primeiro a migration 1792860000000_money-reais.';
  END IF;

  -- Remove constraints antigas em reais antes da conversão.
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_total_reais_check;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_committed_reais_check;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_check;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_total_reais_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_reais_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_not_above_total;

  ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_amount_reais_check;
  ALTER TABLE bids DROP CONSTRAINT IF EXISTS bid_amount_reais_positive;

  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_start_price_reais_check;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_min_increment_reais_check;

  ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_amount_reais_check;

  -- Renomeia as colunas para deixar explícita a unidade.
  ALTER TABLE wallets RENAME COLUMN total_reais TO total_cents;
  ALTER TABLE wallets RENAME COLUMN committed_reais TO committed_cents;
  ALTER TABLE lots RENAME COLUMN start_price_reais TO start_price_cents;
  ALTER TABLE lots RENAME COLUMN min_increment_reais TO min_increment_cents;
  ALTER TABLE lots RENAME COLUMN current_bid_reais TO current_bid_cents;
  ALTER TABLE bids RENAME COLUMN amount_reais TO amount_cents;
  ALTER TABLE receipts RENAME COLUMN amount_reais TO amount_cents;
  ALTER TABLE wallet_transactions RENAME COLUMN amount_reais TO amount_cents;

  -- Converte reais inteiros para centavos inteiros.
  UPDATE wallets
     SET total_cents = total_cents * 100,
         committed_cents = committed_cents * 100;
  UPDATE lots
     SET start_price_cents = start_price_cents * 100,
         min_increment_cents = min_increment_cents * 100,
         current_bid_cents = current_bid_cents * 100;
  UPDATE bids SET amount_cents = amount_cents * 100;
  UPDATE receipts SET amount_cents = amount_cents * 100;
  UPDATE wallet_transactions SET amount_cents = amount_cents * 100;

  -- Constraints coerentes com a nova escala.
  ALTER TABLE wallets ADD CONSTRAINT wallet_total_cents_nonnegative CHECK (total_cents >= 0) NOT VALID;
  ALTER TABLE wallets ADD CONSTRAINT wallet_committed_cents_nonnegative CHECK (committed_cents >= 0) NOT VALID;
  ALTER TABLE wallets ADD CONSTRAINT wallet_committed_not_above_total CHECK (committed_cents <= total_cents) NOT VALID;
  ALTER TABLE bids ADD CONSTRAINT bid_amount_cents_positive CHECK (amount_cents > 0) NOT VALID;
  ALTER TABLE lots ADD CONSTRAINT lots_start_price_cents_check CHECK (start_price_cents > 0) NOT VALID;
  ALTER TABLE lots ADD CONSTRAINT lots_min_increment_cents_check CHECK (min_increment_cents > 0) NOT VALID;
  ALTER TABLE receipts ADD CONSTRAINT receipts_amount_cents_check CHECK (amount_cents > 0) NOT VALID;

  ALTER TABLE wallets VALIDATE CONSTRAINT wallet_total_cents_nonnegative;
  ALTER TABLE wallets VALIDATE CONSTRAINT wallet_committed_cents_nonnegative;
  ALTER TABLE wallets VALIDATE CONSTRAINT wallet_committed_not_above_total;
  ALTER TABLE bids VALIDATE CONSTRAINT bid_amount_cents_positive;
  ALTER TABLE lots VALIDATE CONSTRAINT lots_start_price_cents_check;
  ALTER TABLE lots VALIDATE CONSTRAINT lots_min_increment_cents_check;
  ALTER TABLE receipts VALIDATE CONSTRAINT receipts_amount_cents_check;

  -- Formato do hash por lance. Lances antigos usam o formato legado (v1).
  ALTER TABLE bids ADD COLUMN hash_version SMALLINT NOT NULL DEFAULT 1
    CHECK (hash_version IN (1, 2));
  ALTER TABLE bids ALTER COLUMN hash_version SET DEFAULT 2;

  COMMENT ON COLUMN wallets.total_cents IS 'Saldo total em centavos inteiros (BIGINT).';
  COMMENT ON COLUMN wallets.committed_cents IS 'Saldo comprometido em centavos inteiros (BIGINT).';
  COMMENT ON COLUMN lots.start_price_cents IS 'Lance inicial em centavos inteiros (BIGINT).';
  COMMENT ON COLUMN lots.min_increment_cents IS 'Incremento mínimo em centavos inteiros (BIGINT).';
  COMMENT ON COLUMN lots.current_bid_cents IS 'Lance atual em centavos inteiros (BIGINT).';
  COMMENT ON COLUMN bids.amount_cents IS 'Valor do lance em centavos inteiros (BIGINT).';
  COMMENT ON COLUMN receipts.amount_cents IS 'Valor arrematado em centavos inteiros (BIGINT).';
  COMMENT ON COLUMN wallet_transactions.amount_cents IS 'Movimento em centavos inteiros (BIGINT).';
  COMMENT ON COLUMN bids.hash_version IS
    '1 = valor canonicalizado em reais (lances anteriores à migração para centavos); 2 = valor canonicalizado em centavos.';
END $$;

-- Down Migration

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'total_cents'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_total_cents_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_cents_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_not_above_total;
  ALTER TABLE bids DROP CONSTRAINT IF EXISTS bid_amount_cents_positive;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_start_price_cents_check;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_min_increment_cents_check;
  ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_amount_cents_check;

  ALTER TABLE bids DROP COLUMN IF EXISTS hash_version;

  -- A divisão inteira descarta centavos, tal como aconteceu na migração anterior.
  UPDATE wallets
     SET total_cents = total_cents / 100,
         committed_cents = committed_cents / 100;
  UPDATE lots
     SET start_price_cents = start_price_cents / 100,
         min_increment_cents = min_increment_cents / 100,
         current_bid_cents = current_bid_cents / 100;
  UPDATE bids SET amount_cents = amount_cents / 100;
  UPDATE receipts SET amount_cents = amount_cents / 100;
  UPDATE wallet_transactions SET amount_cents = amount_cents / 100;

  ALTER TABLE wallets RENAME COLUMN total_cents TO total_reais;
  ALTER TABLE wallets RENAME COLUMN committed_cents TO committed_reais;
  ALTER TABLE lots RENAME COLUMN start_price_cents TO start_price_reais;
  ALTER TABLE lots RENAME COLUMN min_increment_cents TO min_increment_reais;
  ALTER TABLE lots RENAME COLUMN current_bid_cents TO current_bid_reais;
  ALTER TABLE bids RENAME COLUMN amount_cents TO amount_reais;
  ALTER TABLE receipts RENAME COLUMN amount_cents TO amount_reais;
  ALTER TABLE wallet_transactions RENAME COLUMN amount_cents TO amount_reais;

  ALTER TABLE wallets ADD CONSTRAINT wallet_total_reais_nonnegative CHECK (total_reais >= 0);
  ALTER TABLE wallets ADD CONSTRAINT wallet_committed_reais_nonnegative CHECK (committed_reais >= 0);
  ALTER TABLE wallets ADD CONSTRAINT wallet_committed_not_above_total CHECK (committed_reais <= total_reais);
  ALTER TABLE bids ADD CONSTRAINT bid_amount_reais_positive CHECK (amount_reais > 0);
  ALTER TABLE lots ADD CONSTRAINT lots_start_price_reais_check CHECK (start_price_reais > 0);
  ALTER TABLE lots ADD CONSTRAINT lots_min_increment_reais_check CHECK (min_increment_reais > 0);
  ALTER TABLE receipts ADD CONSTRAINT receipts_amount_reais_check CHECK (amount_reais > 0);
END $$;
