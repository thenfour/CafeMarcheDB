-- Existing rows must be converted with scripts/migrate-event-utc-spans.cjs
-- while application writers are stopped. New rows already use UTC spans.
ALTER TABLE EventSegment ADD COLUMN dateTimeVersion INTEGER NOT NULL DEFAULT 1;
ALTER TABLE EventSegment ALTER COLUMN dateTimeVersion SET DEFAULT 2;

-- after this run
-- node scripts/migrate-event-utc-spans.cjs
