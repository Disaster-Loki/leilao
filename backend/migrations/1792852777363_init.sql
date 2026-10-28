-- Up Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('auctioneer', 'bidder');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  user_id         UUID PRIMARY KEY REFERENCES users(id),
  total_reais     BIGINT NOT NULL DEFAULT 0 CHECK (total_reais >= 0),
  committed_reais BIGINT NOT NULL DEFAULT 0 CHECK (committed_reais >= 0),
  CHECK (committed_reais <= total_reais)
);

CREATE TABLE lots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auctioneer_id       UUID NOT NULL REFERENCES users(id),
  external_id         TEXT NOT NULL,
  title               TEXT NOT NULL,
  artist              TEXT,
  date_display        TEXT,
  medium              TEXT,
  image_url           TEXT,
  attributes          JSONB NOT NULL DEFAULT '{}',
  start_price_reais   BIGINT NOT NULL CHECK (start_price_reais > 0),
  min_increment_reais BIGINT NOT NULL CHECK (min_increment_reais > 0),
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  cancelled_at        TIMESTAMPTZ,
  settled_at          TIMESTAMPTZ,
  current_bid_reais   BIGINT,
  leader_id           UUID REFERENCES users(id),
  bid_count           INTEGER NOT NULL DEFAULT 0,
  head_hash           TEXT NOT NULL DEFAULT 'GENESIS',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX lots_start_end_idx ON lots (start_at, end_at);

CREATE TABLE bids (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id       UUID NOT NULL REFERENCES lots(id),
  bidder_id    UUID NOT NULL REFERENCES users(id),
  sequence     INTEGER NOT NULL CHECK (sequence > 0),
  amount_reais BIGINT NOT NULL CHECK (amount_reais > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  prev_hash    TEXT NOT NULL,
  hash         TEXT NOT NULL,
  UNIQUE (lot_id, sequence)
);

CREATE TABLE receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id       UUID NOT NULL UNIQUE REFERENCES lots(id),
  winner_id    UUID NOT NULL REFERENCES users(id),
  amount_reais BIGINT NOT NULL CHECK (amount_reais > 0),
  final_hash   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE wallet_tx_type AS ENUM ('deposit', 'purchase', 'sale');

CREATE TABLE wallet_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  type         wallet_tx_type NOT NULL,
  amount_reais BIGINT NOT NULL,
  lot_id       UUID REFERENCES lots(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wallet_tx_user_idx ON wallet_transactions (user_id, created_at DESC);

-- Down Migration

DROP TABLE wallet_transactions;
DROP TYPE wallet_tx_type;
DROP TABLE receipts;
DROP TABLE bids;
DROP TABLE lots;
DROP TABLE wallets;
DROP TABLE users;
DROP TYPE user_role;