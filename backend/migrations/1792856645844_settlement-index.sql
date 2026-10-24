-- Up Migration
CREATE INDEX lots_unsettled_idx ON lots (end_at)
  WHERE settled_at IS NULL AND cancelled_at IS NULL;

-- Down Migration
DROP INDEX lots_unsettled_idx;