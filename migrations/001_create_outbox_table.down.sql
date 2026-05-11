DROP INDEX IF EXISTS idx_outbox_status_timestamp;

DROP INDEX IF EXISTS idx_outbox_processed;

DROP INDEX IF EXISTS idx_outbox_failed;

DROP TABLE IF EXISTS outbox;
