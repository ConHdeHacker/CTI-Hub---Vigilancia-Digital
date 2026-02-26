import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("surveillance.db");

// Initialize Database Schema
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
`);

// Seed initial data if empty
const clientCount = db.prepare("SELECT COUNT(*) as count FROM clients").get() as { count: number };
if (clientCount.count === 0) {
  const insertClient = db.prepare("INSERT INTO clients (name) VALUES (?)");
  const acmeId = insertClient.run("Acme Corp").lastInsertRowid;
  const globexId = insertClient.run("Globex").lastInsertRowid;

  const insertUser = db.prepare("INSERT INTO users (username, email, password, role, client_id) VALUES (?, ?, ?, ?, ?)");
  insertUser.run("admin", "admin@cti-platform.com", "admin123", "super_admin", null);
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

  // Acme Alerts
  categories.forEach((cat, index) => {
    insertAlert.run(acmeId, index + 1, cat, `Incidente de ${cat} detectado`, `Descripción detallada para la categoría ${cat} en Acme Corp.`, index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'high' : 'medium');
  });

  // Globex Alerts
  categories.forEach((cat, index) => {
    insertAlert.run(globexId, index + 1, cat, `Alerta de ${cat} en Globex`, `Análisis técnico de la amenaza de ${cat} para Globex.`, index % 2 === 0 ? 'high' : 'low');
  });
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

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/me", (req, res) => {
    const username = req.headers["x-user"] || "admin";
    const user = db.prepare("SELECT users.*, clients.name as client_name FROM users LEFT JOIN clients ON users.client_id = clients.id WHERE username = ?").get(username) as any;
    if (user) {
      // Log access on every "me" call as a proxy for session activity
      db.prepare("INSERT INTO access_logs (user_id, action, ip) VALUES (?, ?, ?)").run(user.id, 'API_ACCESS', req.ip);
    }
    res.json(user);
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT users.*, clients.name as client_name FROM users LEFT JOIN clients ON users.client_id = clients.id").all();
    res.json(users);
  });

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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
