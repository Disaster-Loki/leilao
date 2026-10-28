-- All currency columns were BIGINT from the initial migration. This migration
-- keeps existing values untouched and verifies the financial invariants.
--
-- Bases antigas (Docker/Neon) podem ainda estar em centavos quando esta
-- migration corre. Bases novas já estão em reais. A conversão para reais é
-- feita depois, na migration 1792860000000_money-reais.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'wallets'
       AND column_name = 'total_cents'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_total_cents_nonnegative') THEN
      ALTER TABLE wallets ADD CONSTRAINT wallet_total_cents_nonnegative CHECK (total_cents >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_committed_cents_nonnegative') THEN
      ALTER TABLE wallets ADD CONSTRAINT wallet_committed_cents_nonnegative CHECK (committed_cents >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_committed_not_above_total') THEN
      ALTER TABLE wallets ADD CONSTRAINT wallet_committed_not_above_total CHECK (committed_cents <= total_cents) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_amount_cents_positive') THEN
      ALTER TABLE bids ADD CONSTRAINT bid_amount_cents_positive CHECK (amount_cents > 0) NOT VALID;
    END IF;

    ALTER TABLE wallets VALIDATE CONSTRAINT wallet_total_cents_nonnegative;
    ALTER TABLE wallets VALIDATE CONSTRAINT wallet_committed_cents_nonnegative;
    ALTER TABLE wallets VALIDATE CONSTRAINT wallet_committed_not_above_total;
    ALTER TABLE bids VALIDATE CONSTRAINT bid_amount_cents_positive;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_total_reais_nonnegative') THEN
      ALTER TABLE wallets ADD CONSTRAINT wallet_total_reais_nonnegative CHECK (total_reais >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_committed_reais_nonnegative') THEN
      ALTER TABLE wallets ADD CONSTRAINT wallet_committed_reais_nonnegative CHECK (committed_reais >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_committed_not_above_total') THEN
      ALTER TABLE wallets ADD CONSTRAINT wallet_committed_not_above_total CHECK (committed_reais <= total_reais) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_amount_reais_positive') THEN
      ALTER TABLE bids ADD CONSTRAINT bid_amount_reais_positive CHECK (amount_reais > 0) NOT VALID;
    END IF;

    ALTER TABLE wallets VALIDATE CONSTRAINT wallet_total_reais_nonnegative;
    ALTER TABLE wallets VALIDATE CONSTRAINT wallet_committed_reais_nonnegative;
    ALTER TABLE wallets VALIDATE CONSTRAINT wallet_committed_not_above_total;
    ALTER TABLE bids VALIDATE CONSTRAINT bid_amount_reais_positive;
  END IF;
END $$;

-- Down Migration
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bid_amount_reais_positive;
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bid_amount_cents_positive;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_not_above_total;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_reais_nonnegative;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_total_reais_nonnegative;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_committed_cents_nonnegative;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallet_total_cents_nonnegative;
