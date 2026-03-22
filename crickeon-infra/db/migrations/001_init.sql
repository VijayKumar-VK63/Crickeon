BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'player')),
  elo_rating INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(16) UNIQUE NOT NULL,
  host_user_id UUID NOT NULL REFERENCES users(id),
  state VARCHAR(20) NOT NULL CHECK (state IN ('waiting', 'auction', 'match', 'results')),
  min_players INTEGER NOT NULL DEFAULT 4 CHECK (min_players >= 4),
  max_players INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  starts_at TIMESTAMPTZ
);

CREATE TABLE room_members (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE cricket_players (
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

CREATE TABLE auctions (
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

CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL,
  demand_index NUMERIC(4,2) NOT NULL,
  role_scarcity_index NUMERIC(4,2) NOT NULL,
  is_winning BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auction_id, user_id, amount)
);

CREATE TABLE teams (
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

CREATE TABLE team_players (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  cricket_player_id UUID NOT NULL REFERENCES cricket_players(id),
  acquired_price BIGINT NOT NULL,
  is_playing_xi BOOLEAN NOT NULL DEFAULT FALSE,
  batting_position SMALLINT,
  PRIMARY KEY (team_id, cricket_player_id)
);

CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  format VARCHAR(40) NOT NULL CHECK (format IN ('round_robin_playoffs')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'running', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id UUID NOT NULL REFERENCES teams(id),
  team_b_id UUID NOT NULL REFERENCES teams(id),
  toss_winner_team_id UUID REFERENCES teams(id),
  toss_decision VARCHAR(10) CHECK (toss_decision IN ('bat', 'bowl')),
  pitch_type VARCHAR(20) NOT NULL CHECK (pitch_type IN ('flat', 'green', 'dusty')),
  weather VARCHAR(40),
  seed INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'live', 'completed')),
  winner_team_id UUID REFERENCES teams(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ball_by_ball_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings SMALLINT NOT NULL CHECK (innings IN (1,2)),
  over_number SMALLINT NOT NULL,
  ball_number SMALLINT NOT NULL,
  batting_team_id UUID NOT NULL REFERENCES teams(id),
  bowling_team_id UUID NOT NULL REFERENCES teams(id),
  batsman_player_id UUID REFERENCES cricket_players(id),
  bowler_player_id UUID REFERENCES cricket_players(id),
  runs_scored SMALLINT NOT NULL,
  is_wicket BOOLEAN NOT NULL DEFAULT FALSE,
  dismissal_type VARCHAR(30),
  extras SMALLINT NOT NULL DEFAULT 0,
  pressure_index NUMERIC(4,2) NOT NULL DEFAULT 0,
  commentary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, innings, over_number, ball_number)
);

CREATE TABLE standings (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  runs_for INTEGER NOT NULL DEFAULT 0,
  overs_faced NUMERIC(6,1) NOT NULL DEFAULT 0,
  runs_against INTEGER NOT NULL DEFAULT 0,
  overs_bowled NUMERIC(6,1) NOT NULL DEFAULT 0,
  net_run_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, team_id)
);

CREATE TABLE match_event_store (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  stream_version INTEGER NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  event_payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, stream_version)
);

CREATE TABLE anti_cheat_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  reason VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE replay_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  over_number SMALLINT NOT NULL,
  snapshot_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_state ON rooms(state);
CREATE INDEX idx_auctions_room_status ON auctions(room_id, status);
CREATE INDEX idx_bids_auction_created ON bids(auction_id, created_at DESC);
CREATE INDEX idx_team_players_team ON team_players(team_id);
CREATE INDEX idx_matches_tournament_status ON matches(tournament_id, status);
CREATE INDEX idx_ball_events_match_innings_over ON ball_by_ball_events(match_id, innings, over_number, ball_number);
CREATE INDEX idx_standings_rank ON standings(tournament_id, points DESC, net_run_rate DESC);
CREATE INDEX idx_event_store_match_version ON match_event_store(match_id, stream_version);
CREATE INDEX idx_players_role_country ON cricket_players(role, country);

COMMIT;
