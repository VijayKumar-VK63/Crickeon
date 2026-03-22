BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_type') THEN
    CREATE TYPE wallet_transaction_type AS ENUM (
      'deposit',
      'withdrawal',
      'entry_fee',
      'prize_credit',
      'reward_credit',
      'cosmetic_purchase'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_status') THEN
    CREATE TYPE wallet_transaction_status AS ENUM ('pending', 'committed', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM ('free', 'premium');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type wallet_transaction_type NOT NULL,
  status wallet_transaction_status NOT NULL DEFAULT 'committed',
  amount NUMERIC(14, 2) NOT NULL,
  reference VARCHAR(120) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON wallet_transactions(reference);

CREATE TABLE IF NOT EXISTS league_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_fee NUMERIC(12, 2) NOT NULL,
  prize_pool NUMERIC(14, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_league_room_owner UNIQUE (room_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_league_entries_room ON league_entries(room_id);

CREATE TABLE IF NOT EXISTS premium_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON premium_subscriptions(user_id, status);

CREATE TABLE IF NOT EXISTS cosmetic_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_type VARCHAR(40) NOT NULL,
  cosmetic_key VARCHAR(80) NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_user_cosmetic UNIQUE (user_id, cosmetic_type, cosmetic_key)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(120),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type_time ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user_time ON analytics_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS daily_reward_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_reward_user_date UNIQUE (user_id, claim_date)
);

CREATE INDEX IF NOT EXISTS idx_rewards_user_created ON daily_reward_claims(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS achievement_definitions (
  key VARCHAR(80) PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(40) NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(80) NOT NULL REFERENCES achievement_definitions(key) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS real_world_player_snapshots (
  id BIGSERIAL PRIMARY KEY,
  cricket_player_id UUID NOT NULL REFERENCES cricket_players(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL,
  snapshot_date DATE NOT NULL,
  runs INTEGER NOT NULL DEFAULT 0,
  wickets INTEGER NOT NULL DEFAULT 0,
  strike_rate NUMERIC(6, 2) NOT NULL,
  economy NUMERIC(4, 2) NOT NULL,
  performance_index NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_player_provider_date UNIQUE (cricket_player_id, provider, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_real_snapshot_date ON real_world_player_snapshots(snapshot_date);

COMMIT;
