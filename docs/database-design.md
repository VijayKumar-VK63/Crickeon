# Database Design Notes

- Schema is 3NF-oriented with many-to-many decomposition via `room_members` and `team_players`.
- Bids are immutable append records; winner tracked in `auctions.highest_bidder_user_id` and `bids.is_winning`.
- Match events use dual-write strategy:
  - query-optimized table: `ball_by_ball_events`
  - event-sourcing stream: `match_event_store`
- Replay snapshots are checkpoints every N overs for fast playback restore.
- Standings table is denormalized read model derived from match results and maintained by tournament/stat processors.
