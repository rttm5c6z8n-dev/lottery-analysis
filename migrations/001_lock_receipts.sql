-- Cloudflare Pages D1 binding name: LOCK_DB.
-- Apply once to a dedicated D1 database; never apply to the V3.1 browser store.
CREATE TABLE IF NOT EXISTS lock_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  period TEXT NOT NULL CHECK(length(period)=5),
  digest TEXT NOT NULL CHECK(length(digest)=64),
  scope TEXT NOT NULL CHECK(scope IN ('single-ticket','five-tickets')),
  planned_draw_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  latest_official_period TEXT NOT NULL,
  latest_official_date TEXT NOT NULL,
  source_url TEXT NOT NULL,
  UNIQUE(period,digest)
);
CREATE INDEX IF NOT EXISTS idx_lock_receipts_period ON lock_receipts(period);
