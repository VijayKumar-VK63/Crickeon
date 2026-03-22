BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'player')),
  elo_rating INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(16) UNIQUE NOT NULL,
  host_user_id UUID NOT NULL REFERENCES users(id),
  state VARCHAR(20) NOT NULL CHECK (state IN ('waiting', 'auction', 'match', 'results')),
  min_players INTEGER NOT NULL DEFAULT 4 CHECK (min_players >= 4),
  max_players INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  starts_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS cricket_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_ref VARCHAR(80) UNIQUE,
  full_name VARCHAR(180) NOT NULL,
  country VARCHAR(80) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('batsman', 'bowler', 'all_rounder', 'wicket_keeper')),
  batting_avg NUMERIC(5,2) NOT NULL,
  strike_rate NUMERIC(6,2) NOT NULL,
  bowling_avg NUMERIC(5,2) NOT NULL,
  economy NUMERIC(4,2) NOT NULL,
  fielding_rating NUMERIC(4,2) NOT NULL DEFAULT 6.0,
  form_index NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  cricket_player_id UUID NOT NULL REFERENCES cricket_players(id),
  opening_price BIGINT NOT NULL,
  current_price BIGINT NOT NULL,
  highest_bidder_user_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'sold', 'unsold')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  anti_snipe_window_seconds INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  demand_index NUMERIC(4,2) NOT NULL,
  role_scarcity_index NUMERIC(4,2) NOT NULL,
  is_winning BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bid_amount UNIQUE (auction_id, user_id, amount),
  CONSTRAINT uq_bid_auction_idempotency UNIQUE (auction_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(120) NOT NULL,
  budget_total BIGINT NOT NULL,
  budget_remaining BIGINT NOT NULL,
  chemistry_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, owner_user_id)
);

CREATE TABLE IF NOT EXISTS team_players (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  cricket_player_id UUID NOT NULL REFERENCES cricket_players(id),
  acquired_price BIGINT NOT NULL,
  is_playing_xi BOOLEAN NOT NULL DEFAULT FALSE,
  batting_position SMALLINT,
  PRIMARY KEY (team_id, cricket_player_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_a_id UUID NOT NULL REFERENCES teams(id),
  team_b_id UUID NOT NULL REFERENCES teams(id),
  toss_winner_team_id UUID REFERENCES teams(id),
  toss_decision VARCHAR(10) CHECK (toss_decision IN ('bat', 'bowl')),
  pitch_type VARCHAR(20) NOT NULL,
  seed INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'live', 'completed')),
  winner_team_id UUID REFERENCES teams(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ball_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  stream_version INTEGER NOT NULL,
  innings SMALLINT NOT NULL,
  over_number SMALLINT NOT NULL,
  ball_number SMALLINT NOT NULL,
  runs_scored SMALLINT NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  batsman_player_id UUID REFERENCES cricket_players(id),
  bowler_player_id UUID REFERENCES cricket_players(id),
  commentary TEXT NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, stream_version),
  UNIQUE (match_id, innings, over_number, ball_number)
);

CREATE INDEX IF NOT EXISTS idx_auctions_room_status ON auctions(room_id, status);
CREATE INDEX IF NOT EXISTS idx_bids_auction_created ON bids(auction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_user_id ON bids(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_ball_events_match_id ON ball_events(match_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_owner_user_id ON teams(owner_user_id);

COMMIT;
