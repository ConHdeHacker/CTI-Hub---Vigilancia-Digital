// Configuración inicial del servidor Express y Base de Datos SQLite
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

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
    type TEXT NOT NULL, -- 'domain', 'email_domain', 'ip', 'brand', 'logo', 'product', 'technology', 'app', 'social', 'third_party', 'vip'
    data TEXT NOT NULL, -- JSON string
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
    console.log("[SYSTEM] Base de datos vacía. Iniciando seeding...");
    
    // 1. Siempre crear el Super Admin inicial
    const insertUser = db.prepare("INSERT INTO users (username, email, password, role, client_id) VALUES (?, ?, ?, ?, ?)");
    insertUser.run("admin", "admin@cti-platform.com", "admin123", "super_admin", null);
    console.log("[SYSTEM] Usuario 'admin' (super_admin) creado.");

    // 2. Datos de prueba solo en modo development
    if (APP_MODE === 'development') {
      console.log("[SYSTEM] Generando datos de prueba (PREPRODUCCIÓN)...");
      
      const insertClient = db.prepare("INSERT INTO clients (name) VALUES (?)");
      const acmeId = insertClient.run("Acme Corp").lastInsertRowid;
      const globexId = insertClient.run("Globex").lastInsertRowid;

      insertUser.run("analyst", "analyst@cti-platform.com", "analyst123", "analyst", null);
      insertUser.run("acme_user", "contact@acme.com", "acme123", "client", acmeId);
      insertUser.run("globex_user", "contact@globex.com", "globex123", "client", globexId);

      const insertAlert = db.prepare("INSERT INTO alerts (client_id, client_alert_id, category, title, description, severity) VALUES (?, ?, ?, ?, ?, ?)");
      
      const categories = [
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

      categories.forEach((cat, index) => {
        insertAlert.run(acmeId, index + 1, cat, `Incidente de ${cat} detectado`, `Descripción detallada para la categoría ${cat} en Acme Corp.`, index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'high' : 'medium');
        insertAlert.run(globexId, index + 1, cat, `Alerta de ${cat} en Globex`, `Análisis técnico de la amenaza de ${cat} para Globex.`, index % 2 === 0 ? 'high' : 'low');
      });
      
      console.log("[SYSTEM] Datos de prueba generados correctamente.");
    } else {
      console.log("[SYSTEM] Modo PRODUCCIÓN: No se han generado datos de prueba.");
    }
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

  /**
   * Obtener información del usuario actual (Simulación de sesión)
   * Se utiliza el header 'x-user' para identificar al usuario en esta demo.
   */
  app.get("/api/me", (req, res) => {
    const username = req.headers["x-user"] || "admin";
    const user = db.prepare("SELECT users.*, clients.name as client_name FROM users LEFT JOIN clients ON users.client_id = clients.id WHERE username = ?").get(username) as any;
    if (user) {
      // Registrar acceso en logs de auditoría
      db.prepare("INSERT INTO access_logs (user_id, action, ip) VALUES (?, ?, ?)").run(user.id, 'API_ACCESS', req.ip);
    }
    res.json({ ...user, system_mode: APP_MODE });
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

  app.post("/api/clients/:id/assets", (req, res) => {
    const { type, data } = req.body;
    const clientId = req.params.id;
    db.prepare("INSERT INTO client_technical_assets (client_id, type, data) VALUES (?, ?, ?)").run(clientId, type, JSON.stringify(data));
    res.json({ success: true });
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[SYSTEM] Servidor escuchando en http://localhost:${PORT}`);
  });
}

startServer();
