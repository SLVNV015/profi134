CREATE TABLE IF NOT EXISTS outbox (
    id VARCHAR(255) PRIMARY KEY,
    "type" VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "correlationId" VARCHAR(255) NOT NULL,
    "retryCount" INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'CREATED',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_timestamp ON outbox(status, "timestamp" ASC)
WHERE status = 'CREATED';

CREATE INDEX IF NOT EXISTS idx_outbox_failed ON outbox(status, "updatedAt")
WHERE status = 'FAILED';

CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox(status, "timestamp" ASC)
WHERE status = 'PROCESSED';

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_outbox ON outbox;

CREATE TRIGGER set_timestamp_outbox
    BEFORE UPDATE ON outbox
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
