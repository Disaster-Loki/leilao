-- Up Migration

-- Bases antigas ainda têm as colunas em centavos. A migration inicial já foi
-- alterada para criar reais, por isso bases novas só precisam de garantir os
-- CHECKs canónicos. A base de produção já tinha a migration de checks antiga
-- aplicada, com nomes em centavos; por isso os CHECKs são removidos e recriados
-- com nomes estáveis em vez de renomeados.

DO $$
DECLARE
  had_cents boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'wallets'
       AND column_name = 'total_cents'
  ) INTO had_cents;

  IF had_cents THEN
    CREATE TABLE _money_reais_conversion (
      converted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE wallets RENAME COLUMN total_cents TO total_reais;
    ALTER TABLE wallets RENAME COLUMN committed_cents TO committed_reais;
    ALTER TABLE lots RENAME COLUMN start_price_cents TO start_price_reais;
    ALTER TABLE lots RENAME COLUMN min_increment_cents TO min_increment_reais;
    ALTER TABLE lots RENAME COLUMN current_bid_cents TO current_bid_reais;
    ALTER TABLE bids RENAME COLUMN amount_cents TO amount_reais;
    ALTER TABLE receipts RENAME COLUMN amount_cents TO amount_reais;
    ALTER TABLE wallet_transactions RENAME COLUMN amount_cents TO amount_reais;
  END IF;

  -- CHECKs antigos e equivalentes já em reais, de bases criadas de novo.
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_total_cents_check;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_committed_cents_check;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_check;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_total_cents_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_cents_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_not_above_total;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_total_reais_check;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_committed_reais_check;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_total_reais_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_reais_nonnegative;

  ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_amount_cents_check;
  ALTER TABLE bids DROP CONSTRAINT IF EXISTS bid_amount_cents_positive;
  ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_amount_reais_check;
  ALTER TABLE bids DROP CONSTRAINT IF EXISTS bid_amount_reais_positive;

  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_start_price_cents_check;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_min_increment_cents_check;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_start_price_reais_check;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_min_increment_reais_check;

  ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_amount_cents_check;
  ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_amount_reais_check;

  IF had_cents THEN
    UPDATE wallets
       SET total_reais = total_reais / 100,
           committed_reais = committed_reais / 100;
    UPDATE lots
       SET start_price_reais = start_price_reais / 100,
           min_increment_reais = min_increment_reais / 100,
           current_bid_reais = current_bid_reais / 100;
    UPDATE bids SET amount_reais = amount_reais / 100;
    UPDATE receipts SET amount_reais = amount_reais / 100;
    UPDATE wallet_transactions SET amount_reais = amount_reais / 100;
  END IF;

  ALTER TABLE wallets ADD CONSTRAINT wallet_total_reais_nonnegative CHECK (total_reais >= 0) NOT VALID;
  ALTER TABLE wallets ADD CONSTRAINT wallet_committed_reais_nonnegative CHECK (committed_reais >= 0) NOT VALID;
  ALTER TABLE wallets ADD CONSTRAINT wallet_committed_not_above_total CHECK (committed_reais <= total_reais) NOT VALID;
  ALTER TABLE bids ADD CONSTRAINT bid_amount_reais_positive CHECK (amount_reais > 0) NOT VALID;
  ALTER TABLE lots ADD CONSTRAINT lots_start_price_reais_check CHECK (start_price_reais > 0) NOT VALID;
  ALTER TABLE lots ADD CONSTRAINT lots_min_increment_reais_check CHECK (min_increment_reais > 0) NOT VALID;
  ALTER TABLE receipts ADD CONSTRAINT receipts_amount_reais_check CHECK (amount_reais > 0) NOT VALID;

  ALTER TABLE wallets VALIDATE CONSTRAINT wallet_total_reais_nonnegative;
  ALTER TABLE wallets VALIDATE CONSTRAINT wallet_committed_reais_nonnegative;
  ALTER TABLE wallets VALIDATE CONSTRAINT wallet_committed_not_above_total;
  ALTER TABLE bids VALIDATE CONSTRAINT bid_amount_reais_positive;
  ALTER TABLE lots VALIDATE CONSTRAINT lots_start_price_reais_check;
  ALTER TABLE lots VALIDATE CONSTRAINT lots_min_increment_reais_check;
  ALTER TABLE receipts VALIDATE CONSTRAINT receipts_amount_reais_check;
END $$;

-- Down Migration

DO $$
BEGIN
  IF to_regclass('public._money_reais_conversion') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_total_reais_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_reais_nonnegative;
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_not_above_total;
  ALTER TABLE bids DROP CONSTRAINT IF EXISTS bid_amount_reais_positive;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_start_price_reais_check;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_min_increment_reais_check;
  ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_amount_reais_check;

  UPDATE wallets
     SET total_reais = total_reais * 100,
         committed_reais = committed_reais * 100;
  UPDATE lots
     SET start_price_reais = start_price_reais * 100,
         min_increment_reais = min_increment_reais * 100,
         current_bid_reais = current_bid_reais * 100;
  UPDATE bids SET amount_reais = amount_reais * 100;
  UPDATE receipts SET amount_reais = amount_reais * 100;
  UPDATE wallet_transactions SET amount_reais = amount_reais * 100;

  ALTER TABLE wallets RENAME COLUMN total_reais TO total_cents;
  ALTER TABLE wallets RENAME COLUMN committed_reais TO committed_cents;
  ALTER TABLE lots RENAME COLUMN start_price_reais TO start_price_cents;
  ALTER TABLE lots RENAME COLUMN min_increment_reais TO min_increment_cents;
  ALTER TABLE lots RENAME COLUMN current_bid_reais TO current_bid_cents;
  ALTER TABLE bids RENAME COLUMN amount_reais TO amount_cents;
  ALTER TABLE receipts RENAME COLUMN amount_reais TO amount_cents;
  ALTER TABLE wallet_transactions RENAME COLUMN amount_reais TO amount_cents;

  ALTER TABLE wallets ADD CONSTRAINT wallets_total_cents_check CHECK (total_cents >= 0);
  ALTER TABLE wallets ADD CONSTRAINT wallets_committed_cents_check CHECK (committed_cents >= 0);
  ALTER TABLE wallets ADD CONSTRAINT wallets_check CHECK (committed_cents <= total_cents);
  ALTER TABLE bids ADD CONSTRAINT bids_amount_cents_check CHECK (amount_cents > 0);
  ALTER TABLE lots ADD CONSTRAINT lots_start_price_cents_check CHECK (start_price_cents > 0);
  ALTER TABLE lots ADD CONSTRAINT lots_min_increment_cents_check CHECK (min_increment_cents > 0);
  ALTER TABLE receipts ADD CONSTRAINT receipts_amount_cents_check CHECK (amount_cents > 0);

  DROP TABLE _money_reais_conversion;
END $$;
