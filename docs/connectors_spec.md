# Connectors Module Specification

## 1. OpenAPI 3.0 Specification

```yaml
openapi: 3.0.0
info:
  title: Vigilancia CTI - Connectors API
  version: 1.0.0
  description: API for managing global connectors and alert ingestion.

paths:
  /v1/connectors:
    get:
      summary: List all connectors
      responses:
        '200':
          description: A list of connectors
    post:
      summary: Create a new connector
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Connector'
      responses:
        '201':
          description: Connector created

  /v1/connectors/{connector_id}:
    get:
      summary: Get connector details
    patch:
      summary: Update connector configuration

  /v1/ingest/{connector_id}/alerts:
    post:
      summary: Ingest alerts from a connector
      parameters:
        - name: X-Trace-Id
          in: header
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/AlertEnvelope'
      responses:
        '202':
          description: Alerts accepted for processing

components:
  schemas:
    Connector:
      type: object
      required: [name, type, mode_ingest, auth_method]
      properties:
        connector_id: { type: string, format: uuid }
        name: { type: string }
        type: { type: string }
        vendor: { type: string }
        version: { type: string }
        mode_ingest: { type: string, enum: [push_webhook, pull_polling] }
        auth_method: { type: string, enum: [hmac, oauth2, mtls, api_key] }
        config: { type: object }

    AlertEnvelope:
      type: object
      required: [event_id, event_time, client_id, category, severity, title]
      properties:
        event_id: { type: string, format: uuid }
        event_time: { type: string, format: date-time }
        client_id: { type: integer }
        category: { type: string }
        severity: { type: string, enum: [low, medium, high, critical] }
        title: { type: string }
        description: { type: string }
        observables: { type: array, items: { type: object } }
        evidence: { type: object }
        tags: { type: array, items: { type: string } }
        confidence: { type: number, minimum: 0, maximum: 1 }
        raw: { type: object }
```

## 2. JSON Schemas

### AlertEnvelope Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["event_id", "event_time", "client_id", "category", "severity", "title"],
  "properties": {
    "event_id": { "type": "string", "format": "uuid" },
    "event_time": { "type": "string", "format": "date-time" },
    "client_id": { "type": "integer" },
    "category": { "type": "string" },
    "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "observables": { "type": "array" },
    "evidence": { "type": "object" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "raw": { "type": "object", "maxProperties": 100 }
  }
}
```

### Base Config Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "scan_interval_minutes": { "type": "integer", "minimum": 1 },
    "sources": { "type": "array", "items": { "type": "string" } },
    "filters": { "type": "object" },
    "include_raw": { "type": "boolean", "default": true }
  },
  "additionalProperties": true
}
```

## 3. Database Design (PostgreSQL)

```sql
CREATE TABLE connectors (
    connector_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    vendor VARCHAR(100),
    version VARCHAR(20),
    description TEXT,
    mode_ingest VARCHAR(20) NOT NULL,
    mode_export VARCHAR(20) DEFAULT 'none',
    auth_method VARCHAR(20) NOT NULL,
    config_schema JSONB,
    config JSONB,
    ingest_url TEXT,
    export_base_url TEXT,
    secrets_ref TEXT,
    status VARCHAR(20) DEFAULT 'offline',
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_error_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE connector_runs (
    run_id UUID PRIMARY KEY,
    connector_id UUID REFERENCES connectors(connector_id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    result VARCHAR(20),
    alerts_received INTEGER DEFAULT 0,
    alerts_accepted INTEGER DEFAULT 0,
    alerts_rejected INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    trace_id UUID
);

CREATE TABLE normalized_alerts (
    event_id UUID PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    connector_id UUID REFERENCES connectors(connector_id),
    client_id INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    observables JSONB,
    evidence JSONB,
    tags JSONB,
    confidence NUMERIC(3,2),
    raw JSONB,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    stored_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_connector ON normalized_alerts(connector_id);
CREATE INDEX idx_alerts_client ON normalized_alerts(client_id);
CREATE INDEX idx_alerts_event ON normalized_alerts(event_id);
```

## 4. Recommended Architecture

The system should use an asynchronous processing pattern to handle high volumes of alerts:

1.  **Ingest Layer (Data Plane):** Receives the `POST` request, validates authentication and basic schema, generates a `trace_id`, and pushes the raw payload to a **Message Queue** (e.g., RabbitMQ, Kafka). Returns `202 Accepted` immediately.
2.  **Worker Layer:** Consumes messages from the queue. Performs normalization, enrichment, PII redaction, and idempotency checks.
3.  **Persistence Layer:** Stores the normalized alerts in the database.
4.  **Control Plane:** Monitors the workers and queue depth, providing the UI with real-time status and logs.
