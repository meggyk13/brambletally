-- Migration 0015: Shuffle tool state (docs/plan.md "Planned: Shuffle").
-- Tracks when a "box" was last drawn, skipped, or dismissed. No FK on the
-- object half of box_key — it's a loose reference, same as reports.target_id.

CREATE TABLE shuffle_state (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  box_key       TEXT NOT NULL,       -- '<kind>:<object_id>'
  last_shown_at TEXT,                -- NULL = never drawn
  snoozed_until TEXT,                -- set by "skip" — hidden until this passes
  dismissed_at  TEXT,                -- set by "not applicable" — hidden forever
  PRIMARY KEY (user_id, box_key)
);
CREATE INDEX idx_shuffle_state_user ON shuffle_state(user_id);
