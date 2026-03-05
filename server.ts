// Configuración inicial del servidor Express y Base de Datos SQLite
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import punycode from "punycode";
import { v4 as uuidv4 } from "uuid";
import ipaddr from "ipaddr.js";
import fs from "fs";
import crypto from "crypto";

// Cargar variables de entorno desde .env
dotenv.config();

// Utilidades para manejar rutas en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicialización de la base de datos local
const db = new Database("surveillance.db");

// Determinar el modo de la aplicación (development | production)
const APP_MODE = process.env.APP_MODE || 'development';
console.log(`[SYSTEM] Iniciando en modo: ${APP_MODE}`);

/**
 * Gestor de Secretos (Simulación de Vault/AWS SM)
 */
class SecretsManager {
  private static mockSecrets: Record<string, string> = {
    'vault/sentinel_secret': 'super-secret-key-123',
    'vault/crowdstrike_key': 'cs-secret-abc-456',
    'vault/generic_hmac': 'default-hmac-secret-xyz'
  };

  static async getSecret(ref: string): Promise<string | null> {
    if (!ref) return null;
    // En producción esto llamaría a una API externa (Vault, AWS Secrets Manager, etc.)
    return this.mockSecrets[ref] || process.env[ref] || null;
  }
}

/**
 * Cola de Mensajes (Simulación de RabbitMQ/Kafka mediante SQLite)
 */
class MessageQueue {
  static async push(connectorId: string, traceId: string, payload: any) {
    db.prepare(`
      INSERT INTO alert_ingestion_queue (connector_id, trace_id, payload)
      VALUES (?, ?, ?)
    `).run(connectorId, traceId, JSON.stringify(payload));
  }

  static async startWorker(processFn: (item: any) => Promise<void>) {
    setInterval(async () => {
      const items = db.prepare("SELECT * FROM alert_ingestion_queue WHERE status = 'pending' LIMIT 5").all() as any[];
      for (const item of items) {
        db.prepare("UPDATE alert_ingestion_queue SET status = 'processing', attempts = attempts + 1 WHERE id = ?").run(item.id);
        try {
          await processFn(item);
          db.prepare("UPDATE alert_ingestion_queue SET status = 'completed', processed_at = CURRENT_TIMESTAMP WHERE id = ?").run(item.id);
        } catch (e) {
          console.error(`[QUEUE] Error processing item ${item.id}:`, e);
          db.prepare("UPDATE alert_ingestion_queue SET status = 'failed' WHERE id = ?").run(item.id);
        }
      }
    }, 2000);
  }
}

/**
 * Inicialización del Esquema de la Base de Datos
 * Crea todas las tablas necesarias si no existen.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS client_modules (
    client_id INTEGER NOT NULL,
    module_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    PRIMARY KEY (client_id, module_name),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS client_technical_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    asset_uid TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'domain', 'email_domain', 'ip', 'brand', 'logo', 'product', 'technology', 'app', 'social', 'third_party', 'vip'
    data TEXT NOT NULL, -- JSON string
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS client_details (
    client_id INTEGER PRIMARY KEY,
    data TEXT NOT NULL, -- JSON string for all fields in the image
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS client_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    position TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- 'super_admin', 'analyst', 'client'
    client_id INTEGER,
    status TEXT DEFAULT 'active', -- 'active', 'inactive'
    is_temp_password INTEGER DEFAULT 0,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    client_alert_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'new', -- 'new', 'in_progress', 'resolved', 'false_positive'
    severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- New Connectors Module Tables
  CREATE TABLE IF NOT EXISTS alert_ingestion_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connector_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS connectors (
    connector_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    vendor TEXT,
    version TEXT,
    description TEXT,
    mode_ingest TEXT NOT NULL, -- push_webhook | pull_polling
    mode_export TEXT DEFAULT 'none', -- pull_api | push_webhook | none
    auth_method TEXT NOT NULL, -- hmac | oauth2 | mtls | api_key
    config_schema TEXT, -- JSON string
    config TEXT, -- JSON string
    ingest_url TEXT,
    export_base_url TEXT,
    secrets_ref TEXT,
    status TEXT DEFAULT 'offline', -- online | offline | degraded | paused
    last_success_at DATETIME,
    last_attempt_at DATETIME,
    last_error_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS connector_runs (
    run_id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    result TEXT, -- success | partial | fail
    alerts_received INTEGER DEFAULT 0,
    alerts_accepted INTEGER DEFAULT 0,
    alerts_rejected INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    trace_id TEXT,
    FOREIGN KEY (connector_id) REFERENCES connectors(connector_id)
  );

  CREATE TABLE IF NOT EXISTS normalized_alerts (
    event_id TEXT PRIMARY KEY,
    event_time DATETIME NOT NULL,
    connector_id TEXT NOT NULL,
    client_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL, -- low | medium | high | critical
    title TEXT NOT NULL,
    description TEXT,
    observables TEXT, -- JSON array
    evidence TEXT, -- JSON object
    tags TEXT, -- JSON array
    confidence REAL,
    raw TEXT,
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    stored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connector_id) REFERENCES connectors(connector_id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS connector_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL, -- INFO | WARN | ERROR
    connector_id TEXT,
    run_id TEXT,
    direction TEXT, -- ingest_in | export_out | internal
    event TEXT,
    http_status INTEGER,
    latency_ms INTEGER,
    message TEXT,
    trace_id TEXT,
    redaction_applied INTEGER DEFAULT 0,
    FOREIGN KEY (connector_id) REFERENCES connectors(connector_id),
    FOREIGN KEY (run_id) REFERENCES connector_runs(run_id)
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_connector ON normalized_alerts(connector_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_client ON normalized_alerts(client_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_event ON normalized_alerts(event_id);
  CREATE INDEX IF NOT EXISTS idx_logs_connector ON connector_logs(connector_id);
  CREATE INDEX IF NOT EXISTS idx_logs_trace ON connector_logs(trace_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'alert_new', 'alert_update'
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_dashboard_config (
    user_id INTEGER PRIMARY KEY,
    config TEXT NOT NULL, -- JSON string
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS provider_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_key TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    enabled INTEGER DEFAULT 0,
    provider_type TEXT NOT NULL, -- 'dnsbl', 'feed', 'api', 'webhook'
    endpoint TEXT NOT NULL,
    auth_type TEXT DEFAULT 'none',
    auth_payload TEXT DEFAULT '{}', -- JSON string
    fetch_interval_seconds INTEGER,
    ttl_seconds INTEGER DEFAULT 86400,
    last_fetched_at DATETIME,
    last_hash TEXT,
    config_json TEXT DEFAULT '{}', -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS provider_config_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_key TEXT NOT NULL,
    changed_by TEXT,
    old_value TEXT,
    new_value TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL, -- 'info', 'warn', 'error', 'debug'
    component TEXT NOT NULL, -- 'connector', 'api', 'auth', 'db', 'system'
    message TEXT NOT NULL,
    details TEXT, -- JSON string
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

  // Inserción de datos iniciales (Seeding)
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  
  if (userCount.count === 0) {
    console.log("[SYSTEM] Base de datos vacía. Por favor, ejecute el script de instalación para crear el Super Admin.");
  }

  const providerCount = db.prepare("SELECT COUNT(*) as count FROM provider_configs").get() as { count: number };
  if (providerCount.count === 0) {
    const insertProvider = db.prepare(`
      INSERT INTO provider_configs (provider_key, display_name, enabled, provider_type, endpoint, auth_type, auth_payload, config_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertProvider.run(
      'urlhaus', 
      'URLHaus (feed)', 
      1, 
      'feed', 
      'https://urlhaus.abuse.ch/downloads/csv/', 
      'none', 
      '{}', 
      JSON.stringify({ csv_columns: ["timestamp", "url", "md5", "domain"], date_format: "iso" })
    );

    insertProvider.run(
      'abuseipdb', 
      'AbuseIPDB (API)', 
      0, 
      'api', 
      'https://api.abuseipdb.com/api/v2/check', 
      'api_key', 
      JSON.stringify({ api_key: "" }), 
      JSON.stringify({ rate_limit_per_minute: 60 })
    );

    insertProvider.run(
      'otx', 
      'OTX (API)', 
      0, 
      'api', 
      'https://otx.alienvault.com/api/v1/indicators/', 
      'api_key', 
      JSON.stringify({ api_key: "" }), 
      '{}'
    );

    insertProvider.run(
      'spamhaus_dnsbl', 
      'Spamhaus ZEN', 
      0, 
      'dnsbl', 
      'zen.spamhaus.org', 
      'none', 
      '{}', 
      JSON.stringify({ force_license_ack: false })
    );
  }

  const settingsCount = db.prepare("SELECT COUNT(*) as count FROM system_settings").get() as { count: number };
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)");
    insertSetting.run('language', 'es');
    insertSetting.run('theme', 'dark');
    insertSetting.run('session_timeout', '3600');
    insertSetting.run('category_labels', JSON.stringify({
      "Exposicion de informacion": "Exposición de Información",
      "Fugas de credenciales": "Fugas de Credenciales",
      "Exposicion de sistemas y vulnerabilidades": "Sistemas y Vulnerabilidades",
      "Monitorizacion de dominios": "Monitorización de Dominios",
      "Monitorizacion Web / Defacement": "Web / Defacement",
      "Listas de categorizacion": "Listas de Categorización",
      "Contenidos ofensivos": "Contenidos Ofensivos",
      "Abuso y suplantacion de marca": "Abuso de Marca",
      "Fraude de aplicaciones": "Fraude de Apps",
      "Exposicion Bancaria y carding": "Banca y Carding"
    }));
  }

  const logsCount = db.prepare("SELECT COUNT(*) as count FROM system_logs").get() as { count: number };
  if (logsCount.count === 0) {
    const insertLog = db.prepare("INSERT INTO system_logs (level, component, message) VALUES (?, ?, ?)");
    insertLog.run('info', 'system', 'Sistema iniciado correctamente');
    insertLog.run('info', 'connector', 'Conector URLHaus sincronizado: 1250 nuevos indicadores');
    insertLog.run('warn', 'auth', 'Intento de login fallido para usuario: root');
    insertLog.run('error', 'connector', 'Error de conexión con AbuseIPDB: Timeout');
    insertLog.run('debug', 'db', 'Query optimizada: SELECT * FROM alerts WHERE status = "new"');
  }

const CATEGORIES = [
  "Exposicion de informacion",
  "Fugas de credenciales",
  "Exposicion de sistemas y vulnerabilidades",
  "Monitorizacion de dominios",
  "Monitorizacion Web / Defacement",
  "Listas de categorizacion",
  "Contenidos ofensivos",
  "Abuso y suplantacion de marca",
  "Fraude de aplicaciones",
  "Exposicion Bancaria y carding"
];

/**
 * Función principal para arrancar el servidor Express
 */
async function startServer() {
  const app = express();
  app.use(express.json());

  // --- RUTAS DE LA API ---

  /**
   * Login de usuario
   */
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT users.*, clients.name as client_name FROM users LEFT JOIN clients ON users.client_id = clients.id WHERE username = ? AND password = ?").get(username, password) as any;
    
    if (user) {
      db.prepare("INSERT INTO access_logs (user_id, action, ip) VALUES (?, ?, ?)").run(user.id, 'LOGIN_SUCCESS', req.ip);
      res.json(user);
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  });

  /**
   * Logout de usuario
   */
  app.post("/api/logout", (req, res) => {
    const username = req.headers["x-user"];
    if (username) {
      const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
      if (user) {
        db.prepare("INSERT INTO access_logs (user_id, action, ip) VALUES (?, ?, ?)").run(user.id, 'LOGOUT', req.ip);
      }
    }
    res.json({ success: true });
  });

  // --- ENDPOINTS CONECTORES (V1) ---

  // Control Plane: Connectors CRUD
  app.get("/v1/connectors", (req, res) => {
    const connectors = db.prepare("SELECT * FROM connectors").all();
    res.json(connectors.map((c: any) => ({
      ...c,
      config_schema: JSON.parse(c.config_schema || "{}"),
      config: JSON.parse(c.config || "{}")
    })));
  });

  app.post("/v1/connectors", (req, res) => {
    const { name, type, vendor, version, description, mode_ingest, mode_export, auth_method, config_schema, config, secrets_ref } = req.body;
    const connector_id = uuidv4();
    const ingest_url = `/v1/ingest/${connector_id}/alerts`;

    try {
      db.prepare(`
        INSERT INTO connectors (
          connector_id, name, type, vendor, version, description, 
          mode_ingest, mode_export, auth_method, config_schema, config, 
          ingest_url, secrets_ref, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        connector_id, name, type, vendor, version, description,
        mode_ingest, mode_export || 'none', auth_method, 
        JSON.stringify(config_schema || {}), JSON.stringify(config || {}),
        ingest_url, secrets_ref, 'offline'
      );
      res.status(201).json({ connector_id, ingest_url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/v1/connectors/:id", (req, res) => {
    const connector = db.prepare("SELECT * FROM connectors WHERE connector_id = ?").get(req.params.id) as any;
    if (!connector) return res.status(404).json({ error: "Conector no encontrado" });
    res.json({
      ...connector,
      config_schema: JSON.parse(connector.config_schema || "{}"),
      config: JSON.parse(connector.config || "{}")
    });
  });

  app.patch("/v1/connectors/:id", (req, res) => {
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => [
      'name', 'vendor', 'version', 'description', 'mode_ingest', 
      'mode_export', 'auth_method', 'config_schema', 'config', 
      'secrets_ref', 'status'
    ].includes(k));

    if (fields.length === 0) return res.status(400).json({ error: "No hay campos válidos para actualizar" });

    const setClause = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => (typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]));
    values.push(req.params.id);

    try {
      db.prepare(`UPDATE connectors SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE connector_id = ?`).run(...values);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/v1/connectors/:id/test", async (req, res) => {
    const connector_id = req.params.id;
    const connector = db.prepare("SELECT * FROM connectors WHERE connector_id = ?").get(connector_id) as any;
    if (!connector) return res.status(404).json({ error: "Conector no encontrado" });

    const dummyAlert = [{
      event_id: uuidv4(),
      event_time: new Date().toISOString(),
      client_id: 1,
      category: "Test",
      severity: "info",
      title: "Prueba de Conexión",
      description: "Alerta de prueba generada automáticamente para verificar el flujo de ingestión.",
      observables: [],
      raw: { test: true }
    }];

    const trace_id = uuidv4();
    
    // Log the test attempt
    db.prepare("INSERT INTO connector_logs (connector_id, level, message, trace_id) VALUES (?, ?, ?, ?)")
      .run(connector_id, 'info', 'Iniciando prueba de conexión manual...', trace_id);

    // Push to queue directly to simulate ingestion
    await MessageQueue.push(connector_id, trace_id, dummyAlert);

    res.json({ success: true, message: "Prueba iniciada. Las alertas han sido encoladas." });
  });

  app.get("/v1/connectors/:id/status", (req, res) => {
    const status = db.prepare("SELECT status, last_success_at, last_attempt_at, last_error_code FROM connectors WHERE connector_id = ?").get(req.params.id);
    if (!status) return res.status(404).json({ error: "Conector no encontrado" });
    res.json(status);
  });

  app.get("/v1/connectors/:id/runs", (req, res) => {
    const runs = db.prepare("SELECT * FROM connector_runs WHERE connector_id = ? ORDER BY started_at DESC LIMIT 50").all(req.params.id);
    res.json(runs);
  });

  app.get("/v1/connectors/:id/logs", (req, res) => {
    const { from, to, level, trace_id } = req.query;
    let query = "SELECT * FROM connector_logs WHERE connector_id = ?";
    const params: any[] = [req.params.id];

    if (from) { query += " AND timestamp >= ?"; params.push(from); }
    if (to) { query += " AND timestamp <= ?"; params.push(to); }
    if (level) { query += " AND level = ?"; params.push(level); }
    if (trace_id) { query += " AND trace_id = ?"; params.push(trace_id); }

    query += " ORDER BY timestamp DESC LIMIT 100";
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  });

  // Data Plane: Ingest
  app.post("/v1/ingest/:id/alerts", async (req, res) => {
    const connector_id = req.params.id;
    const trace_id = req.headers["x-trace-id"] || uuidv4();
    const timestamp = req.headers["x-timestamp"];
    const nonce = req.headers["x-nonce"];
    const signature = req.headers["authorization"];

    const connector = db.prepare("SELECT * FROM connectors WHERE connector_id = ?").get(connector_id) as any;
    if (!connector) return res.status(404).json({ error: "Conector no encontrado" });

    // 1. Validación de Autenticación (HMAC Real)
    if (connector.auth_method === 'hmac') {
      const secret = await SecretsManager.getSecret(connector.secrets_ref);
      if (!secret) {
        return res.status(500).json({ error: "Configuración de seguridad incompleta (secret not found)" });
      }

      if (!signature || !timestamp || !nonce) {
        return res.status(401).json({ error: "Faltan cabeceras de autenticación HMAC" });
      }

      // Verificar ventana de tiempo (5 minutos)
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp as string)) > 300) {
        return res.status(401).json({ error: "Timestamp fuera de ventana permitida" });
      }

      const bodyStr = JSON.stringify(req.body);
      const expectedSignature = crypto.createHmac('sha256', secret)
        .update(`${timestamp}${nonce}${bodyStr}`)
        .digest('hex');

      // Soportar tanto "HMAC <sig>" como "<sig>"
      const providedSig = signature.startsWith('HMAC ') ? signature.substring(5) : signature;

      if (providedSig !== expectedSignature) {
        return res.status(401).json({ error: "Firma HMAC inválida" });
      }
    }

    // 2. Encolar para procesamiento asíncrono (Message Queue)
    await MessageQueue.push(connector_id, trace_id as string, req.body);

    // 3. Responder inmediatamente (202 Accepted)
    res.status(202).json({ 
      status: "accepted", 
      trace_id,
      message: "Alertas recibidas y encoladas para procesamiento"
    });
  });

  app.get("/v1/export/:id/delta", (req, res) => {
    const { since, client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: "client_id es obligatorio" });

    let query = "SELECT * FROM normalized_alerts WHERE client_id = ?";
    const params: any[] = [client_id];

    if (since) {
      query += " AND stored_at > ?";
      params.push(since);
    }

    const alerts = db.prepare(query).all(...params);
    res.json(alerts);
  });

  /**
   * Obtener información del usuario actual (Simulación de sesión)
   * Se utiliza el header 'x-user' para identificar al usuario en esta demo.
   */
  app.get("/api/me", (req, res) => {
    const username = req.headers["x-user"];
    if (!username) {
      return res.status(401).json({ error: "No autenticado" });
    }
    const user = db.prepare("SELECT users.*, clients.name as client_name FROM users LEFT JOIN clients ON users.client_id = clients.id WHERE username = ?").get(username) as any;
    if (user) {
      // Registrar acceso en logs de auditoría
      db.prepare("INSERT INTO access_logs (user_id, action, ip) VALUES (?, ?, ?)").run(user.id, 'API_ACCESS', req.ip);
      res.json({ ...user, system_mode: APP_MODE });
    } else {
      res.status(401).json({ error: "Usuario no encontrado" });
    }
  });

  /**
   * Listar todos los usuarios del sistema
   */
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT users.*, clients.name as client_name FROM users LEFT JOIN clients ON users.client_id = clients.id").all();
    res.json(users);
  });

  /**
   * Crear un nuevo usuario con contraseña temporal
   */
  app.post("/api/users", (req, res) => {
    const { username, email, role, client_id } = req.body;
    const tempPassword = Math.random().toString(36).slice(-8);
    const result = db.prepare("INSERT INTO users (username, email, password, role, client_id, is_temp_password) VALUES (?, ?, ?, ?, ?, 1)").run(username, email, tempPassword, role, client_id || null);
    res.json({ id: result.lastInsertRowid, username, tempPassword });
  });

  app.patch("/api/users/:id", (req, res) => {
    const { status, role, client_id, email } = req.body;
    db.prepare("UPDATE users SET status = COALESCE(?, status), role = COALESCE(?, role), client_id = COALESCE(?, client_id), email = COALESCE(?, email) WHERE id = ?").run(status, role, client_id, email, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/users/:id", (req, res) => {
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/users/:id/logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM access_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(req.params.id);
    res.json(logs);
  });

  app.post("/api/users/:id/reset-password", (req, res) => {
    const tempPassword = Math.random().toString(36).slice(-8);
    db.prepare("UPDATE users SET password = ?, is_temp_password = 1 WHERE id = ?").run(tempPassword, req.params.id);
    res.json({ tempPassword });
  });

  app.get("/api/clients", (req, res) => {
    const clients = db.prepare("SELECT * FROM clients").all();
    res.json(clients);
  });

  app.post("/api/clients", (req, res) => {
    const { name } = req.body;
    const result = db.prepare("INSERT INTO clients (name) VALUES (?)").run(name);
    res.json({ id: result.lastInsertRowid, name });
  });

  app.get("/api/my-config", (req, res) => {
    const username = req.headers["x-user"] || "admin";
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (!user || !user.client_id) {
      // For admins/analysts without a specific client, return all modules as active
      return res.json({ modules: CATEGORIES.map(cat => ({ module_name: cat, is_active: 1 })) });
    }
    const modules = db.prepare("SELECT * FROM client_modules WHERE client_id = ?").all(user.client_id);
    res.json({ modules });
  });

  app.get("/api/alerts", (req, res) => {
    const { category } = req.query;
    const username = req.headers["x-user"] || "admin";
    const currentUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

    let query = "SELECT alerts.*, clients.name as client_name FROM alerts JOIN clients ON alerts.client_id = clients.id";
    const params: any[] = [];
    const conditions: string[] = [];

    // SECURITY: If user is 'client', they MUST only see their own client_id
    if (currentUser.role === 'client') {
      conditions.push("alerts.client_id = ?");
      params.push(currentUser.client_id);
    } else if (req.query.client_id) {
      // Admins/Analysts can filter by client_id
      conditions.push("alerts.client_id = ?");
      params.push(req.query.client_id);
    }

    if (category) {
      conditions.push("alerts.category = ?");
      params.push(category);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC";
    const alerts = db.prepare(query).all(...params);
    res.json(alerts);
  });

  app.get("/api/alerts/:id", (req, res) => {
    const alert = db.prepare("SELECT alerts.*, clients.name as client_name FROM alerts JOIN clients ON alerts.client_id = clients.id WHERE alerts.id = ?").get(req.params.id);
    const comments = db.prepare("SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE alert_id = ? ORDER BY created_at ASC").all(req.params.id);
    res.json({ ...alert, comments });
  });

// Mock email service
async function sendEmailNotification(to: string, subject: string, body: string) {
  console.log(`[EMAIL_SERVICE] Sending to ${to}: ${subject}`);
  // In a real app, use nodemailer, SendGrid, etc.
}

app.patch("/api/alerts/:id", async (req, res) => {
    const { status, severity } = req.body;
    db.prepare("UPDATE alerts SET status = COALESCE(?, status), severity = COALESCE(?, severity) WHERE id = ?").run(status, severity, req.params.id);
    
    // Create notification for analysts
    const alert = db.prepare("SELECT title FROM alerts WHERE id = ?").get(req.params.id) as any;
    const analysts = db.prepare("SELECT id, email FROM users WHERE role IN ('super_admin', 'analyst')").all() as any[];
    const insertNotify = db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)");
    
    for (const analyst of analysts) {
      insertNotify.run(analyst.id, "Alerta Actualizada", `La alerta "${alert.title}" ha sido actualizada.`, 'alert_update');
      if (analyst.email) {
        await sendEmailNotification(analyst.email, "VIGILANCIA_CTI: Alerta Actualizada", `La alerta "${alert.title}" ha sido actualizada a estado ${status || 'sin cambios'} y severidad ${severity || 'sin cambios'}.`);
      }
    }

    res.json({ success: true });
  });

  app.post("/api/alerts/:id/comments", (req, res) => {
    const { content, user_id } = req.body;
    const result = db.prepare("INSERT INTO comments (alert_id, user_id, content) VALUES (?, ?, ?)").run(req.params.id, user_id, content);
    res.json({ id: result.lastInsertRowid, content, created_at: new Date().toISOString() });
  });

  app.get("/api/clients/:id/config", (req, res) => {
    const clientId = req.params.id;
    const modules = db.prepare("SELECT * FROM client_modules WHERE client_id = ?").all(clientId);
    const assets = db.prepare("SELECT * FROM client_technical_assets WHERE client_id = ?").all(clientId);
    const details = db.prepare("SELECT * FROM client_details WHERE client_id = ?").get(clientId);
    const contacts = db.prepare("SELECT * FROM client_contacts WHERE client_id = ?").all(clientId);
    
    res.json({
      modules,
      assets: assets.map((a: any) => ({ ...a, data: JSON.parse(a.data) })),
      details: details ? JSON.parse(details.data) : {},
      contacts
    });
  });

  app.post("/api/clients/:id/modules", (req, res) => {
    const { modules } = req.body; // Array of { name, is_active }
    const clientId = req.params.id;
    const upsert = db.prepare("INSERT OR REPLACE INTO client_modules (client_id, module_name, is_active) VALUES (?, ?, ?)");
    const transaction = db.transaction((mods) => {
      for (const mod of mods) upsert.run(clientId, mod.name, mod.is_active ? 1 : 0);
    });
    transaction(modules);
    res.json({ success: true });
  });

  /**
   * Validaciones y Normalización de Activos Técnicos (ASM Enterprise Grade - Refined)
   */
  const validateAndNormalizeAsset = (type: string, data: any, clientId: string) => {
    const errors: string[] = [];
    let normalizedData = { ...data };

    // Reglas Generales de Seguridad
    const sanitize = (val: string) => val?.toString().replace(/[<>]/g, "").trim() || "";
    const sanitizeShell = (val: string) => val?.toString().replace(/[&;| $]/g, "").trim() || "";

    switch (type) {
      case 'domain': {
        if (!data.value) { errors.push("El dominio es obligatorio"); break; }
        let val = data.value.toLowerCase().trim();
        
        // Rechazo explícito de URLs, rutas, IPs y correos
        if (val.includes("://") || val.includes("/") || val.includes("@")) { 
          errors.push("No se permiten URLs, rutas o correos, solo FQDN (ej: test.com)"); 
          break; 
        }
        if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(val)) { 
          errors.push("No se permiten IPs en el campo dominio"); 
          break; 
        }

        // Punycode
        try { val = punycode.toASCII(val); } catch (e) { errors.push("Formato IDN inválido"); }

        // Regex FQDN estricta
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
        if (!domainRegex.test(val)) { errors.push("Formato de dominio FQDN inválido"); }

        // Bloqueo dominios internos
        const internalTLDs = [".local", ".lan", ".home", ".internal", ".corp"];
        if (internalTLDs.some(tld => val.endsWith(tld))) { 
          errors.push("No se permiten dominios de red interna (.local, .lan, .home, .internal, .corp)"); 
        }
        
        normalizedData.value = val;
        delete normalizedData.hosting; // Eliminar hosting
        break;
      }

      case 'ip': {
        if (!data.value) { errors.push("La IP o Rango es obligatorio"); break; }
        const val = data.value.trim();
        
        try {
          let addr: any;
          let range: any;
          
          if (val.includes('/')) {
            range = ipaddr.parseCIDR(val);
            addr = range[0];
          } else {
            addr = ipaddr.parse(val);
          }

          // Bloqueos de Seguridad
          const ipStr = addr.toString();
          const rangeStr = range ? `${range[0].toString()}/${range[1]}` : ipStr;

          // RFC 1918, Loopback, Multicast
          if (addr.kind() === 'ipv4') {
            const octets = addr.toByteArray();
            if (octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168)) {
              errors.push("No se permiten direcciones IP privadas (RFC 1918)");
            }
            if (octets[0] === 127) errors.push("No se permiten direcciones de Loopback");
            if (octets[0] >= 224 && octets[0] <= 239) errors.push("No se permiten direcciones Multicast");
          }

          // Detección de solapamiento (Overlap)
          const existingAssets = db.prepare("SELECT data FROM client_technical_assets WHERE client_id = ? AND type = 'ip'").all(clientId) as any[];
          for (const asset of existingAssets) {
            const existingData = JSON.parse(asset.data);
            const existingVal = existingData.value;
            
            try {
              let existingAddr: any;
              let existingRange: any;
              if (existingVal.includes('/')) {
                existingRange = ipaddr.parseCIDR(existingVal);
                existingAddr = existingRange[0];
              } else {
                existingAddr = ipaddr.parse(existingVal);
              }

              // Si ambos son CIDR o uno es IP y otro CIDR, comprobamos inclusión
              if (range && existingRange) {
                // Comprobar si un rango contiene al otro (simplificado)
                if (val === existingVal) errors.push("Este rango ya está registrado");
              } else if (range && !existingRange) {
                if (existingAddr.match(range)) errors.push(`La IP ${existingVal} ya está contenida en el nuevo rango ${val}`);
              } else if (!range && existingRange) {
                if (addr.match(existingRange)) errors.push(`La IP ${val} ya está contenida en el rango existente ${existingVal}`);
              } else {
                if (val === existingVal) errors.push("Esta IP ya está registrada");
              }
              
              if (errors.length > 0) break;
            } catch (e) {}
          }

          normalizedData.value = val;
          delete normalizedData.hosting; // Eliminar hosting
        } catch (e) {
          errors.push("Formato de IP o CIDR inválido");
        }
        break;
      }

      case 'email_domain': {
        let val = data.value?.toString() || "";
        // Normalización: extraemos el dominio si es un email completo
        if (val.includes("@")) {
          val = val.split("@").pop() || "";
        }
        val = val.toLowerCase().trim();
        
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
        if (!domainRegex.test(val)) {
          errors.push("Formato de dominio de correo inválido");
        } else {
          // Aseguramos que empiece por @ para el almacenamiento como se solicitó
          normalizedData.value = "@" + val;
        }
        break;
      }

      case 'logo': {
        if (!data.value) { errors.push("El archivo de logo es obligatorio"); break; }
        // data.value es base64: "data:image/png;base64,..."
        const parts = data.value.split(';');
        if (parts.length < 2) { errors.push("Formato de imagen inválido"); break; }
        
        const mime = parts[0].split(':')[1];
        const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowedMimes.includes(mime)) {
          errors.push("Formato no permitido. Use PNG, JPEG o WEBP. SVG está bloqueado por seguridad.");
          break;
        }

        // Validación de tamaño (2MB)
        const base64Data = parts[1].split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length > 2 * 1024 * 1024) {
          errors.push("El tamaño del logo supera el límite de 2MB");
          break;
        }

        // Persistencia: Renombrado a UUIDv4
        const extension = mime.split('/')[1];
        const filename = `${uuidv4()}.${extension}`;
        
        // Almacenamiento fuera del web root (simulado en carpeta uploads)
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);

        normalizedData.filename = filename;
        normalizedData.mime = mime;
        normalizedData.path = `/uploads/${filename}`;
        delete normalizedData.value; // No guardamos el base64 en la DB
        break;
      }

      case 'technology': {
        const cpeRegex = /^cpe:2\.3:[a-z]:[a-z0-9._~-]+:[a-z0-9._~-]+:[a-z0-9._~-]+:.*$/i;
        if (data.cpe && !cpeRegex.test(data.cpe)) {
          errors.push("Formato CPE 2.3 inválido en el campo versión");
        }
        normalizedData.value = sanitize(data.value);
        break;
      }

      case 'app': {
        normalizedData.value = sanitizeShell(data.value).substring(0, 100);
        normalizedData.developer = sanitize(data.developer);
        
        // Firma Desarrollador
        if (data.signature) {
          let sig = data.signature.replace(/[:\s]/g, "").toLowerCase();
          if (!/^[0-9a-f]{40}$/.test(sig) && !/^[0-9a-f]{64}$/.test(sig)) {
            errors.push("Firma del desarrollador inválida (debe ser SHA1 o SHA256 hexadecimal)");
          }
          normalizedData.signature = sig;
        }

        // URL Oficial
        if (data.url) {
          if (!/^https?:\/\//i.test(data.url)) {
            errors.push("La URL oficial debe ser una URI absoluta (http/https)");
          } else {
            // Rechazo de esquemas peligrosos
            const lowerUrl = data.url.toLowerCase();
            if (lowerUrl.includes("javascript:") || lowerUrl.includes("data:") || lowerUrl.includes("file:") || lowerUrl.includes("vbscript:")) {
              errors.push("Esquema de URL no permitido por seguridad");
            }
          }
        }

        // SHA256
        if (data.sha256 && !/^[0-9a-f]{64}$/i.test(data.sha256)) {
          errors.push("SHA256 de la aplicación inválido (64 caracteres hex)");
        }
        break;
      }

      case 'brand': {
        normalizedData.value = sanitize(data.value);
        if (normalizedData.value.length < 2 || normalizedData.value.length > 64) errors.push("La marca debe tener entre 2 y 64 caracteres");
        break;
      }

      case 'social': {
        const validNetworks = ['LinkedIn', 'X (Twitter)', 'Facebook', 'Instagram', 'GitHub', 'Telegram', 'YouTube'];
        if (!validNetworks.includes(data.network)) errors.push("Red social no soportada");
        // Validación de URL de perfil básica
        if (data.value && !/^https?:\/\//i.test(data.value)) {
          errors.push("La URL del perfil debe ser una URI absoluta");
        }
        break;
      }
    }

    return { errors, normalizedData };
  };

  app.post("/api/clients/:id/assets", (req, res) => {
    const { type, data } = req.body;
    const clientId = req.params.id;
    const username = req.headers["x-user"] || "unknown";

    // 1. Validaciones de Backend
    const { errors, normalizedData } = validateAndNormalizeAsset(type, data, clientId);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(", ") });
    }

    // 2. Control de Duplicidad
    const existing = db.prepare("SELECT id FROM client_technical_assets WHERE client_id = ? AND type = ? AND data = ?")
      .get(clientId, type, JSON.stringify(normalizedData));
    if (existing) {
      return res.status(409).json({ error: "Este activo ya existe para este cliente" });
    }

    // 3. Generación de ID Único (UID)
    // Formato: [CLIENT_NAME_SLUG]-[TYPE]-[COUNTER]
    const client = db.prepare("SELECT name FROM clients WHERE id = ?").get(clientId) as any;
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    const clientSlug = client.name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const typeCode = type.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    
    const countResult = db.prepare("SELECT COUNT(*) as count FROM client_technical_assets WHERE client_id = ? AND type = ?")
      .get(clientId, type) as { count: number };
    const counter = (countResult.count + 1).toString().padStart(3, '0');
    
    const assetUid = `${clientSlug}-${typeCode}-${counter}`;

    // 4. Persistencia con Auditoría
    try {
      db.prepare("INSERT INTO client_technical_assets (client_id, asset_uid, type, data, created_by) VALUES (?, ?, ?, ?, ?)")
        .run(clientId, assetUid, type, JSON.stringify(normalizedData), username);
      
      // Log de auditoría
      db.prepare("INSERT INTO system_logs (level, component, message, details) VALUES (?, ?, ?, ?)")
        .run('info', 'api', `Activo creado: ${assetUid}`, JSON.stringify({ clientId, type, assetUid, username }));

      res.json({ success: true, asset_uid: assetUid });
    } catch (e: any) {
      res.status(500).json({ error: "Error al guardar el activo: " + e.message });
    }
  });

  app.delete("/api/assets/:id", (req, res) => {
    db.prepare("DELETE FROM client_technical_assets WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/clients/:id/details", (req, res) => {
    const { data } = req.body;
    const clientId = req.params.id;
    db.prepare("INSERT OR REPLACE INTO client_details (client_id, data) VALUES (?, ?)").run(clientId, JSON.stringify(data));
    res.json({ success: true });
  });

  app.post("/api/clients/:id/contacts", (req, res) => {
    const { name, phone, email, position } = req.body;
    const clientId = req.params.id;
    db.prepare("INSERT INTO client_contacts (client_id, name, phone, email, position) VALUES (?, ?, ?, ?, ?)").run(clientId, name, phone, email, position);
    res.json({ success: true });
  });

  app.delete("/api/contacts/:id", (req, res) => {
    db.prepare("DELETE FROM client_contacts WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });
  app.get("/api/stats", (req, res) => {
    const stats = {
      total_alerts: db.prepare("SELECT COUNT(*) as count FROM alerts").get(),
      by_severity: db.prepare("SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity").all(),
      by_status: db.prepare("SELECT status, COUNT(*) as count FROM alerts GROUP BY status").all(),
      by_category: db.prepare("SELECT category, COUNT(*) as count FROM alerts GROUP BY category").all(),
      trends: db.prepare("SELECT category, COUNT(*) as count, strftime('%Y-%m-%d', created_at) as date FROM alerts GROUP BY category, date ORDER BY date ASC").all(),
    };
    res.json(stats);
  });

  // Notifications API
  app.get("/api/notifications", (req, res) => {
    const username = req.headers["x-user"] || "admin";
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(user.id);
    res.json(notifications);
  });

  app.patch("/api/notifications/:id", (req, res) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Advanced Search API
  app.get("/api/alerts/search", (req, res) => {
    const { q, client_id, category, status, severity, date_from, date_to } = req.query;
    const username = req.headers["x-user"] || "admin";
    const currentUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

    let query = `
      SELECT DISTINCT alerts.*, clients.name as client_name 
      FROM alerts 
      JOIN clients ON alerts.client_id = clients.id
      LEFT JOIN comments ON alerts.id = comments.alert_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (currentUser.role === 'client') {
      conditions.push("alerts.client_id = ?");
      params.push(currentUser.client_id);
    } else if (client_id) {
      conditions.push("alerts.client_id = ?");
      params.push(client_id);
    }

    if (category) {
      conditions.push("alerts.category = ?");
      params.push(category);
    }

    if (status) {
      conditions.push("alerts.status = ?");
      params.push(status);
    }

    if (severity) {
      conditions.push("alerts.severity = ?");
      params.push(severity);
    }

    if (date_from) {
      conditions.push("alerts.created_at >= ?");
      params.push(date_from);
    }

    if (date_to) {
      conditions.push("alerts.created_at <= ?");
      params.push(date_to);
    }

    if (q) {
      conditions.push("(alerts.title LIKE ? OR alerts.description LIKE ? OR comments.content LIKE ?)");
      const searchPattern = `%${q}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY alerts.created_at DESC";
    const alerts = db.prepare(query).all(...params);
    res.json(alerts);
  });

  // Dashboard Config API
  app.get("/api/dashboard/config", (req, res) => {
    const username = req.headers["x-user"] || "admin";
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const config = db.prepare("SELECT config FROM user_dashboard_config WHERE user_id = ?").get(user.id) as any;
    res.json(config ? JSON.parse(config.config) : { widgets: ['summary', 'trends', 'recent_alerts'] });
  });

  app.post("/api/dashboard/config", (req, res) => {
    const { config } = req.body;
    const username = req.headers["x-user"] || "admin";
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    db.prepare("INSERT OR REPLACE INTO user_dashboard_config (user_id, config) VALUES (?, ?)").run(user.id, JSON.stringify(config));
    res.json({ success: true });
  });

  // Categorization Connector API
  app.get("/api/connectors/categorization/providers", (req, res) => {
    const providers = db.prepare("SELECT * FROM provider_configs").all();
    res.json(providers.map((p: any) => ({
      ...p,
      enabled: p.enabled === 1,
      auth_payload: JSON.parse(p.auth_payload),
      config_json: JSON.parse(p.config_json)
    })));
  });

  app.post("/api/connectors/categorization/providers", (req, res) => {
    const { provider_key, display_name, enabled, provider_type, endpoint, auth_type, auth_payload, fetch_interval_seconds, ttl_seconds, config_json } = req.body;
    try {
      db.prepare(`
        INSERT INTO provider_configs (provider_key, display_name, enabled, provider_type, endpoint, auth_type, auth_payload, fetch_interval_seconds, ttl_seconds, config_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        provider_key, 
        display_name, 
        enabled ? 1 : 0, 
        provider_type, 
        endpoint, 
        auth_type, 
        JSON.stringify(auth_payload || {}), 
        fetch_interval_seconds, 
        ttl_seconds, 
        JSON.stringify(config_json || {})
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/connectors/categorization/providers/:key", (req, res) => {
    const { display_name, enabled, endpoint, auth_type, auth_payload, fetch_interval_seconds, ttl_seconds, config_json } = req.body;
    const provider_key = req.params.key;
    
    // Audit log (simplified)
    const old = db.prepare("SELECT * FROM provider_configs WHERE provider_key = ?").get(provider_key) as any;
    if (old) {
      db.prepare("INSERT INTO provider_config_audit (provider_key, old_value, new_value) VALUES (?, ?, ?)")
        .run(provider_key, JSON.stringify(old), JSON.stringify(req.body));
    }

    db.prepare(`
      UPDATE provider_configs SET
        display_name = COALESCE(?, display_name),
        enabled = COALESCE(?, enabled),
        endpoint = COALESCE(?, endpoint),
        auth_type = COALESCE(?, auth_type),
        auth_payload = COALESCE(?, auth_payload),
        fetch_interval_seconds = COALESCE(?, fetch_interval_seconds),
        ttl_seconds = COALESCE(?, ttl_seconds),
        config_json = COALESCE(?, config_json),
        updated_at = CURRENT_TIMESTAMP
      WHERE provider_key = ?
    `).run(
      display_name,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      endpoint,
      auth_type,
      auth_payload ? JSON.stringify(auth_payload) : null,
      fetch_interval_seconds,
      ttl_seconds,
      config_json ? JSON.stringify(config_json) : null,
      provider_key
    );
    res.json({ success: true });
  });

  app.post("/api/connectors/categorization/reload", (req, res) => {
    // Simulate reload
    res.json({ status: "success", timestamp: new Date().toISOString() });
  });

  app.get("/api/connectors/categorization/providers/:key/config", (req, res) => {
    const provider = db.prepare("SELECT * FROM provider_configs WHERE provider_key = ?").get(req.params.key) as any;
    if (!provider) return res.status(404).json({ error: "Not found" });
    
    const config = {
      ...provider,
      enabled: provider.enabled === 1,
      auth_payload: JSON.parse(provider.auth_payload),
      config_json: JSON.parse(provider.config_json)
    };

    // Mask sensitive data
    if (config.auth_payload) {
      Object.keys(config.auth_payload).forEach(k => {
        config.auth_payload[k] = "********";
      });
    }

    res.json(config);
  });

  // System Settings API
  app.get("/api/system/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM system_settings").all();
    const result: any = {};
    settings.forEach((s: any) => {
      try {
        result[s.key] = JSON.parse(s.value);
      } catch {
        result[s.key] = s.value;
      }
    });
    res.json(result);
  });

  app.post("/api/system/settings", (req, res) => {
    const settings = req.body;
    const upsert = db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)");
    const transaction = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        upsert.run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    transaction(settings);
    res.json({ success: true });
  });

  // System Logs API
  app.get("/api/system/logs", (req, res) => {
    const { component, level, limit = 100 } = req.query;
    let query = "SELECT * FROM system_logs";
    const params: any[] = [];
    const conditions: string[] = [];

    if (component) {
      conditions.push("component = ?");
      params.push(component);
    }
    if (level) {
      conditions.push("level = ?");
      params.push(level);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(Number(limit));

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  });

  // --- CONFIGURACIÓN DE VITE / PRODUCCIÓN ---
  if (process.env.NODE_ENV !== "production") {
    // En desarrollo, usamos el middleware de Vite para HMR y compilación al vuelo
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // En producción, servimos los archivos estáticos de la carpeta 'dist'
    app.use(express.static(path.join(__dirname, "dist")));
  }

  // Servir carpeta de uploads de forma segura
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.get("*", (req, res) => {
    if (process.env.NODE_ENV === "production") {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    } else {
      // En desarrollo, Vite maneja el fallback
      res.status(404).send("Not found");
    }
  });

  app.post("/api/change-password", (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const username = req.headers["x-user"];

    if (!username) return res.status(401).json({ error: "No autenticado" });

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (!user || user.password !== currentPassword) {
      return res.status(400).json({ error: "Contraseña actual incorrecta" });
    }

    db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
    res.json({ success: true });
  });

  const PORT = process.env.PORT || 3000;
  // Start the message queue worker
  MessageQueue.startWorker(async (item) => {
    const { connector_id, trace_id, payload: payloadStr } = item;
    const payload = JSON.parse(payloadStr);
    const alerts = Array.isArray(payload) ? payload : [payload];
    const run_id = uuidv4();
    const startTime = Date.now();
    
    db.prepare("INSERT INTO connector_runs (run_id, connector_id, trace_id) VALUES (?, ?, ?)").run(run_id, connector_id, trace_id);

    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;

    const insertAlert = db.prepare(`
      INSERT INTO normalized_alerts (
        event_id, event_time, connector_id, client_id, category, severity, 
        title, description, observables, evidence, tags, confidence, raw
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const alert of alerts) {
      try {
        if (!alert.event_id || !alert.client_id || !alert.category || !alert.severity || !alert.title) {
          rejected++;
          continue;
        }

        const client = db.prepare("SELECT id FROM clients WHERE id = ?").get(alert.client_id);
        if (!client) {
          rejected++;
          continue;
        }

        const existing = db.prepare("SELECT event_id FROM normalized_alerts WHERE event_id = ? AND connector_id = ?").get(alert.event_id, connector_id);
        if (existing) {
          duplicates++;
          continue;
        }

        insertAlert.run(
          alert.event_id,
          alert.event_time || new Date().toISOString(),
          connector_id,
          alert.client_id,
          alert.category,
          alert.severity,
          alert.title,
          alert.description || null,
          JSON.stringify(alert.observables || []),
          JSON.stringify(alert.evidence || {}),
          JSON.stringify(alert.tags || []),
          alert.confidence || 1.0,
          JSON.stringify(alert.raw || {})
        );
        accepted++;
      } catch (e) {
        rejected++;
      }
    }

    const latency = Date.now() - startTime;

    db.prepare(`
      UPDATE connector_runs SET 
        ended_at = CURRENT_TIMESTAMP,
        result = ?,
        alerts_received = ?,
        alerts_accepted = ?,
        alerts_rejected = ?,
        duplicates = ?
      WHERE run_id = ?
    `).run(
      rejected === 0 ? 'success' : (accepted > 0 ? 'partial' : 'fail'),
      alerts.length, accepted, rejected, duplicates, run_id
    );

    // Update connector status
    db.prepare(`
      UPDATE connectors SET 
        last_attempt_at = CURRENT_TIMESTAMP,
        last_success_at = ?,
        status = ?
      WHERE connector_id = ?
    `).run(
      accepted > 0 ? new Date().toISOString() : null,
      accepted > 0 ? 'online' : (rejected > 0 ? 'degraded' : 'offline'),
      connector_id
    );
    
    // Log success
    db.prepare(`
      INSERT INTO connector_logs (
        level, connector_id, run_id, direction, event, http_status, latency_ms, message, trace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rejected > 0 ? 'WARN' : 'INFO',
      connector_id, run_id, 'ingest_in', 'ALERTS_PROCESSED', 200, latency,
      `Procesadas ${accepted} alertas con éxito. Rechazadas: ${rejected}. Duplicadas: ${duplicates}.`,
      trace_id
    );
  });

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[SYSTEM] Servidor escuchando en http://localhost:${PORT}`);
  });
}

startServer();
