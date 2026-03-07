import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("parking.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate TEXT NOT NULL,
    entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    exit_time DATETIME,
    status TEXT DEFAULT 'parked'
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    plate TEXT,
    role TEXT NOT NULL DEFAULT 'usuario',
    cell_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL DEFAULT 'todos',
    status TEXT NOT NULL DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrar tablas existentes: añadir columnas si no existen (SQLite no tiene IF NOT EXISTS para columnas)
function addColumnIfMissing(table: string, column: string, def: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  } catch (_) {}
}
addColumnIfMissing("users", "plate", "TEXT");
addColumnIfMissing("users", "cell_id", "INTEGER");
addColumnIfMissing("cells", "vehicle_type", "TEXT NOT NULL DEFAULT 'todos'");

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  
  // Register Entry
  app.post("/api/entry", (req, res) => {
    const { plate } = req.body;
    if (!plate) {
      return res.status(400).json({ error: "La placa es requerida" });
    }
    
    const existing = db.prepare("SELECT * FROM logs WHERE plate = ? AND status = 'parked'").get(plate);
    if (existing) {
      return res.status(400).json({ error: "Vehículo ya se encuentra en el parqueadero" });
    }

    const info = db.prepare("INSERT INTO logs (plate) VALUES (?)").run(plate);
    res.json({ id: info.lastInsertRowid, success: true });
  });

  // Register Exit
  app.post("/api/exit", (req, res) => {
    const { plate } = req.body;
    if (!plate) {
      return res.status(400).json({ error: "La placa es requerida" });
    }
    
    const info = db.prepare(
      "UPDATE logs SET exit_time = CURRENT_TIMESTAMP, status = 'exited' WHERE plate = ? AND status = 'parked'"
    ).run(plate);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: "Vehículo no encontrado o ya ha salido" });
    }
    res.json({ success: true });
  });

  // Get current parked vehicles
  app.get("/api/parked", (req, res) => {
    const parked = db.prepare(`
      SELECT * FROM logs 
      WHERE status = 'parked'
      ORDER BY entry_time DESC
    `).all();
    res.json(parked);
  });

  // Get history
  app.get("/api/history", (req, res) => {
    const history = db.prepare("SELECT * FROM logs ORDER BY entry_time DESC LIMIT 50").all();
    res.json(history);
  });

  // --- Users API (CRUD) ---
  app.get("/api/users", (req, res) => {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.plate, u.role, u.cell_id, u.created_at, c.code AS cell_code
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      ORDER BY u.name
    `).all();
    const filtered = q
      ? users.filter(
          (u: { name?: string; email?: string; plate?: string }) =>
            (u.name || "").toLowerCase().includes(q.toLowerCase()) ||
            (u.email || "").toLowerCase().includes(q.toLowerCase()) ||
            (u.plate || "").toUpperCase().includes(q.toUpperCase())
        )
      : users;
    res.json(filtered);
  });

  app.post("/api/users", (req, res) => {
    const { name, email, plate, role } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Nombre y email son requeridos" });
    }
    try {
      const info = db.prepare(
        "INSERT INTO users (name, email, plate, role) VALUES (?, ?, ?, ?)"
      ).run(name.trim(), email.trim().toLowerCase(), (plate || "").trim().toUpperCase() || null, role || "operador");
      res.status(201).json({ id: info.lastInsertRowid, success: true });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "SQLITE_CONSTRAINT") {
        return res.status(400).json({ error: "El email ya está registrado" });
      }
      throw e;
    }
  });

  app.put("/api/users/:id", (req, res) => {
    const id = Number(req.params.id);
    const { name, email, plate, role } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Nombre y email son requeridos" });
    }
    const info = db.prepare(
      "UPDATE users SET name = ?, email = ?, plate = ?, role = ? WHERE id = ?"
    ).run(name.trim(), email.trim().toLowerCase(), (plate || "").trim().toUpperCase() || null, role === "empleado" ? "empleado" : "usuario", id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ success: true });
  });

  app.delete("/api/users/:id", (req, res) => {
    const id = Number(req.params.id);
    const info = db.prepare("DELETE FROM users WHERE id = ?").run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ success: true });
  });

  // --- Cells API (CRUD) ---
  app.get("/api/cells", (req, res) => {
    const cells = db.prepare(`
      SELECT c.id, c.code, COALESCE(c.vehicle_type, 'todos') AS vehicle_type, c.status, c.created_at, u.name AS assigned_to_name
      FROM cells c
      LEFT JOIN users u ON u.cell_id = c.id
      ORDER BY c.code
    `).all();
    res.json(cells);
  });

  app.post("/api/cells", (req, res) => {
    const { code, vehicle_type } = req.body;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: "El código de celda es requerido" });
    }
    const vtype = ["carro", "moto", "bicicleta", "todos"].includes(String(vehicle_type || "").toLowerCase())
      ? String(vehicle_type).toLowerCase()
      : "todos";
    try {
      const info = db.prepare(
        "INSERT INTO cells (code, vehicle_type) VALUES (?, ?)"
      ).run(String(code).trim().toUpperCase(), vtype);
      res.status(201).json({ id: info.lastInsertRowid, success: true });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "SQLITE_CONSTRAINT") {
        return res.status(400).json({ error: "Ya existe una celda con ese código" });
      }
      throw e;
    }
  });

  app.put("/api/cells/:id", (req, res) => {
    const id = Number(req.params.id);
    const { code, status, vehicle_type } = req.body;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: "El código de celda es requerido" });
    }
    const vtype = ["carro", "moto", "bicicleta", "todos"].includes(String(vehicle_type || "").toLowerCase())
      ? String(vehicle_type).toLowerCase()
      : "todos";
    const info = db.prepare(
      "UPDATE cells SET code = ?, status = ?, vehicle_type = ? WHERE id = ?"
    ).run(String(code).trim().toUpperCase(), status || "available", vtype, id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Celda no encontrada" });
    }
    res.json({ success: true });
  });

  // --- Asignar celda a usuario (RF8 / HU8) ---
  app.post("/api/users/:id/assign-cell", (req, res) => {
    const userId = Number(req.params.id);
    const { cell_id } = req.body;
    if (cell_id == null) {
      return res.status(400).json({ error: "cell_id es requerido" });
    }
    const cellId = Number(cell_id);
    const user = db.prepare("SELECT id, cell_id FROM users WHERE id = ?").get(userId) as { id: number; cell_id: number | null } | undefined;
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const cell = db.prepare("SELECT id, status FROM cells WHERE id = ?").get(cellId) as { id: number; status: string } | undefined;
    if (!cell) {
      return res.status(404).json({ error: "Celda no encontrada" });
    }
    if (cell.status !== "available") {
      return res.status(400).json({ error: "La celda no está disponible" });
    }
    if (user.cell_id) {
      db.prepare("UPDATE cells SET status = 'available' WHERE id = ?").run(user.cell_id);
    }
    db.prepare("UPDATE users SET cell_id = ? WHERE id = ?").run(cellId, userId);
    db.prepare("UPDATE cells SET status = 'occupied' WHERE id = ?").run(cellId);
    res.json({ success: true });
  });

  app.post("/api/users/:id/unassign-cell", (req, res) => {
    const userId = Number(req.params.id);
    const user = db.prepare("SELECT id, cell_id FROM users WHERE id = ?").get(userId) as { id: number; cell_id: number | null } | undefined;
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (user.cell_id) {
      db.prepare("UPDATE cells SET status = 'available' WHERE id = ?").run(user.cell_id);
    }
    db.prepare("UPDATE users SET cell_id = NULL WHERE id = ?").run(userId);
    res.json({ success: true });
  });

  app.delete("/api/cells/:id", (req, res) => {
    const id = Number(req.params.id);
    const info = db.prepare("DELETE FROM cells WHERE id = ?").run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Celda no encontrada" });
    }
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
