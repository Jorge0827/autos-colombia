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
`);

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  
  // Register Entry
  app.post("/api/entry", (req, res) => {
    const { plate } = req.body;
    const existing = db.prepare("SELECT * FROM logs WHERE plate = ? AND status = 'parked'").get();
    if (existing) {
      return res.status(400).json({ error: "Vehículo ya se encuentra en el parqueadero" });
    }

    const info = db.prepare("INSERT INTO logs (plate) VALUES (?)").run(plate);
    res.json({ id: info.lastInsertRowid });
  });

  // Register Exit
  app.post("/api/exit", (req, res) => {
    const { plate } = req.body;
    const info = db.prepare(
      "UPDATE logs SET exit_time = CURRENT_TIMESTAMP, status = 'exited' WHERE plate = ? AND status = 'parked'"
    ).run(plate);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
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
