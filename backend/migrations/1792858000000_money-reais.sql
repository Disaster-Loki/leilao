-- Up Migration

-- Bases antigas ainda têm as colunas em centavos. A migration inicial já foi
-- alterada para criar reais, por isso bases novas não precisam desta conversão.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'wallets'
       AND column_name = 'total_cents'
  ) THEN
    RETURN;
  END IF;

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

  ALTER TABLE wallets RENAME CONSTRAINT wallets_total_cents_check TO wallet_total_reais_nonnegative;
  ALTER TABLE wallets RENAME CONSTRAINT wallets_committed_cents_check TO wallet_committed_reais_nonnegative;
  ALTER TABLE wallets RENAME CONSTRAINT wallets_check TO wallet_committed_not_above_total;
  ALTER TABLE bids RENAME CONSTRAINT bids_amount_cents_check TO bid_amount_reais_positive;
  ALTER TABLE lots RENAME CONSTRAINT lots_start_price_cents_check TO lots_start_price_reais_check;
  ALTER TABLE lots RENAME CONSTRAINT lots_min_increment_cents_check TO lots_min_increment_reais_check;
  ALTER TABLE receipts RENAME CONSTRAINT receipts_amount_cents_check TO receipts_amount_reais_check;
END $$;

-- Down Migration

DO $$
BEGIN
  IF to_regclass('public._money_reais_conversion') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_total_reais_nonnegative') THEN
    ALTER TABLE wallets RENAME CONSTRAINT wallet_total_reais_nonnegative TO wallets_total_cents_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_committed_reais_nonnegative') THEN
    ALTER TABLE wallets RENAME CONSTRAINT wallet_committed_reais_nonnegative TO wallets_committed_cents_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_committed_not_above_total') THEN
    ALTER TABLE wallets RENAME CONSTRAINT wallet_committed_not_above_total TO wallets_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_amount_reais_positive') THEN
    ALTER TABLE bids RENAME CONSTRAINT bid_amount_reais_positive TO bids_amount_cents_check;
  END IF;
  ALTER TABLE lots RENAME CONSTRAINT lots_start_price_reais_check TO lots_start_price_cents_check;
  ALTER TABLE lots RENAME CONSTRAINT lots_min_increment_reais_check TO lots_min_increment_cents_check;
  ALTER TABLE receipts RENAME CONSTRAINT receipts_amount_reais_check TO receipts_amount_cents_check;

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

  DROP TABLE _money_reais_conversion;
END $$;
