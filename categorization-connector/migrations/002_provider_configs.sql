CREATE TYPE provider_type_enum AS ENUM ('dnsbl', 'feed', 'api', 'webhook');

CREATE TABLE IF NOT EXISTS provider_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_key TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    provider_type provider_type_enum NOT NULL,
    endpoint TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'none', -- 'none', 'api_key', 'basic', 'bearer', 'vault'
    auth_payload JSONB DEFAULT '{}',
    fetch_interval_seconds INTEGER,
    ttl_seconds INTEGER DEFAULT 86400,
    last_fetched_at TIMESTAMPTZ,
    last_hash TEXT,
    config_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_config_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_key TEXT NOT NULL,
    changed_by TEXT,
    old_value JSONB,
    new_value JSONB,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_provider_key_enabled ON provider_configs(provider_key, enabled);

-- Initial bootstrap data (optional, usually handled by config.py on first run)
-- INSERT INTO provider_configs (provider_key, display_name, provider_type, endpoint, enabled) VALUES ('urlhaus', 'URLHaus', 'feed', 'https://urlhaus.abuse.ch/downloads/csv/', true);
