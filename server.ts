import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("parking.db");

type VehicleType = "carro" | "moto" | "bicicleta";
type RateType = "hourly" | "monthly";

interface Rate {
  id: number;
  vehicle_type: VehicleType;
  rate_type: RateType;
  amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// En memoria para cache (se cargan de BD)
let HOURLY_RATES: Record<VehicleType, number> = {
  carro: 7500,
  moto: 3500,
  bicicleta: 2000,
};

let MONTHLY_RATES: Record<VehicleType, number> = {
  carro: 240000,
  moto: 132000,
  bicicleta: 60000,
};

let FRACTION_MINUTES = 15;
const ALLOWED_PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "qr", "mensualidad"];
const ALLOWED_SIMULATED_METHODS = ["efectivo", "tarjeta", "transferencia", "qr"];

// Función para recargar tarifas desde BD
function loadRatesFromDatabase() {
  try {
    const rates = db.prepare("SELECT * FROM rates WHERE is_active = 1").all() as Rate[];
    
    // Resetear valores por defecto
    HOURLY_RATES = { carro: 7500, moto: 3500, bicicleta: 2000 };
    MONTHLY_RATES = { carro: 240000, moto: 132000, bicicleta: 60000 };
    
    // Aplicar tarifas de BD
    for (const rate of rates) {
      if (rate.rate_type === "hourly") {
        HOURLY_RATES[rate.vehicle_type] = rate.amount;
      } else if (rate.rate_type === "monthly") {
        MONTHLY_RATES[rate.vehicle_type] = rate.amount;
      }
    }
  } catch (_) {
    // Si la tabla no existe, se mantienen los valores por defecto
  }
}

function normalizePlate(input: unknown): string {
  return String(input || "").trim().toUpperCase();
}

function normalizeVehicleType(input: unknown): VehicleType {
  const value = String(input || "").toLowerCase();
  if (value === "moto") return "moto";
  if (value === "bicicleta") return "bicicleta";
  return "carro";
}

function normalizeSqlDate(input: string): string {
  return input.includes("T") ? input : `${input.replace(" ", "T")}Z`;
}

function getParkedMinutes(entryTime: string, exitTimeIso: string): number {
  const entryMs = new Date(normalizeSqlDate(entryTime)).getTime();
  const exitMs = new Date(exitTimeIso).getTime();
  const diffMinutes = Math.ceil((exitMs - entryMs) / 60000);
  return Math.max(1, diffMinutes);
}

function calculateParkingCharge(parkedMinutes: number, vehicleType: VehicleType): { amount: number; hourlyRate: number } {
  const hourlyRate = HOURLY_RATES[vehicleType];
  if (parkedMinutes <= 60) {
    return { amount: hourlyRate, hourlyRate };
  }
  const remainingMinutes = parkedMinutes - 60;
  const fractionCount = Math.ceil(remainingMinutes / FRACTION_MINUTES);
  const fractionValue = hourlyRate / (60 / FRACTION_MINUTES);
  return {
    amount: Math.round(hourlyRate + fractionCount * fractionValue),
    hourlyRate,
  };
}

function getActiveMonthlySubscriptionByPlate(plate: string):
  | { id: number; monthly_fee: number; vehicle_type: VehicleType; end_date: string }
  | undefined {
  return db
    .prepare(
      `
      SELECT s.id, s.monthly_fee, s.vehicle_type, s.end_date
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE u.plate = ?
        AND s.status = 'active'
        AND datetime('now') BETWEEN datetime(s.start_date) AND datetime(s.end_date)
      ORDER BY s.end_date DESC
      LIMIT 1
    `
    )
    .get(plate) as { id: number; monthly_fee: number; vehicle_type: VehicleType; end_date: string } | undefined;
}

function getRegisteredUserByPlate(plate: string): { id: number; cell_id: number | null } | undefined {
  return db
    .prepare("SELECT id, cell_id FROM users WHERE plate = ? LIMIT 1")
    .get(plate) as { id: number; cell_id: number | null } | undefined;
}

// Función para asignar una celda disponible a un vehículo
function assignAvailableCell(vehicleType: VehicleType): { id: number; code: string } | null {
  const availableCell = db
    .prepare(
      `
      SELECT id, code
      FROM cells
      WHERE status = 'available'
        AND (vehicle_type = ? OR vehicle_type = 'todos')
      ORDER BY code ASC
      LIMIT 1
    `
    )
    .get(vehicleType) as { id: number; code: string } | null;

  if (!availableCell) {
    return null;
  }

  db.prepare("UPDATE cells SET status = 'occupied', visitor_name = 'visitante' WHERE id = ?").run(availableCell.id);

  return availableCell;
}

// Función para obtener la celda asignada de un usuario con mensualidad activa
function getAssignedCellForSubscriber(plate: string): { id: number; code: string; cell_id: number } | null {
  const result = db
    .prepare(
      `
      SELECT u.cell_id, c.id, c.code
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      WHERE u.plate = ?
        AND u.cell_id IS NOT NULL
        AND c.id IS NOT NULL
        AND c.status IN ('reserved', 'occupied')
        AND s.id IS NOT NULL
        AND datetime('now') BETWEEN datetime(s.start_date) AND datetime(s.end_date)
      LIMIT 1
    `
    )
    .get(plate) as { id: number; code: string; cell_id: number } | null;

  return result;
}

function buildQuoteForPlate(plate: string) {
  const parked = db
    .prepare("SELECT id, plate, entry_time, vehicle_type FROM logs WHERE plate = ? AND status = 'parked'")
    .get(plate) as { id: number; plate: string; entry_time: string; vehicle_type?: string } | undefined;

  if (!parked) {
    return { error: "Vehículo no encontrado o ya ha salido" };
  }

  const exitAttemptIso = new Date().toISOString();
  const vehicleType = normalizeVehicleType(parked.vehicle_type);
  const parkedMinutes = getParkedMinutes(parked.entry_time, exitAttemptIso);
  const monthly = getActiveMonthlySubscriptionByPlate(plate);
  const charge = calculateParkingCharge(parkedMinutes, vehicleType);

  return {
    quote: {
      log_id: parked.id,
      plate,
      vehicle_type: vehicleType,
      entry_time: parked.entry_time,
      exit_attempt_time: exitAttemptIso,
      parked_minutes: parkedMinutes,
      hourly_rate: charge.hourlyRate,
      fraction_minutes: FRACTION_MINUTES,
      amount: monthly ? 0 : charge.amount,
      has_monthly: Boolean(monthly),
      monthly_fee: monthly ? monthly.monthly_fee : null,
      monthly_end_date: monthly ? monthly.end_date : null,
    },
  };
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'carro',
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

  CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_type TEXT NOT NULL DEFAULT 'carro',
    rate_type TEXT NOT NULL DEFAULT 'hourly',
    amount INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehicle_type, rate_type)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    vehicle_type TEXT NOT NULL,
    monthly_fee INTEGER NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS subscription_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    plate TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'mensualidad',
    status TEXT NOT NULL DEFAULT 'approved',
    reference TEXT NOT NULL,
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id INTEGER NOT NULL,
    plate TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    entry_time DATETIME NOT NULL,
    exit_attempt_time DATETIME NOT NULL,
    parked_minutes INTEGER NOT NULL,
    hourly_rate INTEGER NOT NULL,
    fraction_minutes INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    reference TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(log_id) REFERENCES logs(id)
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
addColumnIfMissing("cells", "visitor_name", "TEXT");
addColumnIfMissing("logs", "vehicle_type", "TEXT NOT NULL DEFAULT 'carro'");
addColumnIfMissing("logs", "cell_id", "INTEGER");

// Inicializar tarifas por defecto si la tabla está vacía
function initializeDefaultRates() {
  const existingRates = db.prepare("SELECT COUNT(*) as count FROM rates").get() as { count: number };
  
  if (existingRates.count === 0) {
    const defaultRates = [
      { vehicle_type: "carro", rate_type: "hourly", amount: 7500 },
      { vehicle_type: "moto", rate_type: "hourly", amount: 3500 },
      { vehicle_type: "bicicleta", rate_type: "hourly", amount: 2000 },
      { vehicle_type: "carro", rate_type: "monthly", amount: 240000 },
      { vehicle_type: "moto", rate_type: "monthly", amount: 132000 },
      { vehicle_type: "bicicleta", rate_type: "monthly", amount: 60000 },
    ];
    
    const insertStmt = db.prepare(
      "INSERT INTO rates (vehicle_type, rate_type, amount, is_active) VALUES (?, ?, ?, 1)"
    );
    
    for (const rate of defaultRates) {
      insertStmt.run(rate.vehicle_type, rate.rate_type, rate.amount);
    }
  }
  
  // Cargar tarifas en memoria
  loadRatesFromDatabase();
}

function backfillCellsForActiveSubscriptions() {
  const subscriptionsWithoutCell = db
    .prepare(
      `
      SELECT s.id AS subscription_id, u.id AS user_id, s.vehicle_type
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active' AND u.cell_id IS NULL
      ORDER BY s.created_at ASC
    `
    )
    .all() as Array<{ subscription_id: number; user_id: number; vehicle_type: VehicleType }>;

  for (const item of subscriptionsWithoutCell) {
    const availableCell = db
      .prepare(
        `
        SELECT id
        FROM cells
        WHERE status = 'available'
          AND (vehicle_type = ? OR vehicle_type = 'todos')
        ORDER BY code ASC
        LIMIT 1
      `
      )
      .get(item.vehicle_type) as { id: number } | undefined;

    if (availableCell) {
      db.prepare("UPDATE users SET cell_id = ? WHERE id = ?").run(availableCell.id, item.user_id);
      db.prepare("UPDATE cells SET status = 'reserved', visitor_name = NULL WHERE id = ?").run(availableCell.id);
    }
  }
}

function syncReservedAndOccupiedCellsForActiveSubscribers() {
  db.prepare(
    `
    UPDATE cells
    SET status = 'reserved', visitor_name = NULL
    WHERE id IN (
      SELECT DISTINCT u.cell_id
      FROM users u
      JOIN subscriptions s ON s.user_id = u.id
      WHERE u.cell_id IS NOT NULL
        AND s.status = 'active'
        AND datetime('now') BETWEEN datetime(s.start_date) AND datetime(s.end_date)
    )
  `
  ).run();

  db.prepare(
    `
    UPDATE cells
    SET status = 'occupied'
    WHERE id IN (
      SELECT DISTINCT l.cell_id
      FROM logs l
      JOIN users u ON u.plate = l.plate
      JOIN subscriptions s ON s.user_id = u.id
      WHERE l.status = 'parked'
        AND l.cell_id IS NOT NULL
        AND s.status = 'active'
        AND datetime('now') BETWEEN datetime(s.start_date) AND datetime(s.end_date)
    )
  `
  ).run();
}

backfillCellsForActiveSubscriptions();
syncReservedAndOccupiedCellsForActiveSubscribers();
initializeDefaultRates();

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  
  // Register Entry
  app.post("/api/entry", (req, res) => {
    const { plate, vehicle_type } = req.body;
    const normalizedPlate = normalizePlate(plate);
    const normalizedVehicleType = normalizeVehicleType(vehicle_type);
    if (!normalizedPlate) {
      return res.status(400).json({ error: "La placa es requerida" });
    }
    
    const existing = db.prepare("SELECT * FROM logs WHERE plate = ? AND status = 'parked'").get(normalizedPlate);
    if (existing) {
      return res.status(400).json({ error: "Vehículo ya se encuentra en el parqueadero" });
    }

    const registeredUser = getRegisteredUserByPlate(normalizedPlate);

    // Verificar si el usuario tiene mensualidad activa y celda asignada reservada.
    const subscriberCell = getAssignedCellForSubscriber(normalizedPlate);
    let assignedCell: { id: number; code: string } | null = null;

    if (subscriberCell) {
      // Usuario con mensualidad activa: usa su celda reservada y pasa a ocupada durante la estancia.
      db.prepare("UPDATE cells SET status = 'occupied' WHERE id = ?").run(subscriberCell.id);
      assignedCell = { id: subscriberCell.id, code: subscriberCell.code };
    } else if (registeredUser) {
      if (!registeredUser.cell_id) {
        return res.status(409).json({
          error: "La placa está registrada pero no tiene celda reservada. Asigne una celda antes del ingreso.",
          code: "REGISTERED_WITHOUT_CELL",
        });
      }
      return res.status(403).json({
        error: "La placa está registrada. Solo puede ingresar con mensualidad activa usando su celda reservada.",
        code: "REGISTERED_REQUIRES_ACTIVE_SUBSCRIPTION",
      });
    } else {
      // Visitante: solo puede usar celdas disponibles.
      assignedCell = assignAvailableCell(normalizedVehicleType);
    }
    
    if (!assignedCell) {
      return res.status(507).json({ 
        error: "El parqueadero está lleno. No hay celdas disponibles para este tipo de vehículo",
        code: "PARKING_FULL"
      });
    }

    const info = db
      .prepare("INSERT INTO logs (plate, vehicle_type, cell_id) VALUES (?, ?, ?)")
      .run(normalizedPlate, normalizedVehicleType, assignedCell.id);
    
    res.json({ 
      id: info.lastInsertRowid, 
      success: true,
      cell_code: assignedCell.code,
      cell_id: assignedCell.id
    });
  });

  app.get("/api/payment-config", (_req, res) => {
    res.json({
      hourly_rates: HOURLY_RATES,
      monthly_rates: MONTHLY_RATES,
      fraction_minutes: FRACTION_MINUTES,
      rule: "Primera hora completa y luego cobro por fracciones",
      payment_methods: ALLOWED_SIMULATED_METHODS,
    });
  });

  // --- Rates API (Gestión de tarifas) ---
  app.get("/api/rates", (_req, res) => {
    const rates = db.prepare("SELECT * FROM rates ORDER BY vehicle_type, rate_type").all();
    res.json(rates);
  });

  app.post("/api/rates", (req, res) => {
    const { vehicle_type, rate_type, amount } = req.body;
    
    if (!vehicle_type || !rate_type || amount === undefined) {
      return res.status(400).json({ error: "vehicle_type, rate_type y amount son requeridos" });
    }
    
    if (!["carro", "moto", "bicicleta"].includes(vehicle_type)) {
      return res.status(400).json({ error: "vehicle_type inválido" });
    }
    
    if (!["hourly", "monthly"].includes(rate_type)) {
      return res.status(400).json({ error: "rate_type debe ser 'hourly' o 'monthly'" });
    }
    
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount debe ser un número positivo" });
    }
    
    try {
      const info = db.prepare(
        "INSERT INTO rates (vehicle_type, rate_type, amount, is_active) VALUES (?, ?, ?, 1)"
      ).run(vehicle_type, rate_type, Math.round(amount));
      
      loadRatesFromDatabase();
      
      const rate = db.prepare("SELECT * FROM rates WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json(rate);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "SQLITE_CONSTRAINT") {
        return res.status(400).json({ error: "Ya existe una tarifa para este tipo de vehículo y tipo de tarifa" });
      }
      throw e;
    }
  });

  app.put("/api/rates/:id", (req, res) => {
    const id = Number(req.params.id);
    const { amount, is_active } = req.body;
    
    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return res.status(400).json({ error: "amount debe ser un número positivo" });
    }
    
    const rate = db.prepare("SELECT * FROM rates WHERE id = ?").get(id);
    if (!rate) {
      return res.status(404).json({ error: "Tarifa no encontrada" });
    }
    
    const finalAmount = amount !== undefined ? Math.round(amount) : rate.amount;
    const finalIsActive = is_active !== undefined ? (is_active ? 1 : 0) : rate.is_active;
    
    const info = db.prepare(
      "UPDATE rates SET amount = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(finalAmount, finalIsActive, id);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: "Tarifa no encontrada" });
    }
    
    loadRatesFromDatabase();
    
    const updated = db.prepare("SELECT * FROM rates WHERE id = ?").get(id);
    res.json(updated);
  });

  app.delete("/api/rates/:id", (req, res) => {
    const id = Number(req.params.id);
    
    const rate = db.prepare("SELECT * FROM rates WHERE id = ?").get(id);
    if (!rate) {
      return res.status(404).json({ error: "Tarifa no encontrada" });
    }
    
    // Marcar como inactiva en lugar de eliminar
    db.prepare("UPDATE rates SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    
    loadRatesFromDatabase();
    
    res.json({ success: true, message: "Tarifa desactivada" });
  });

  // Reactivar tarifa
  app.post("/api/rates/:id/reactivate", (req, res) => {
    const id = Number(req.params.id);
    
    const rate = db.prepare("SELECT * FROM rates WHERE id = ?").get(id);
    if (!rate) {
      return res.status(404).json({ error: "Tarifa no encontrada" });
    }
    
    db.prepare("UPDATE rates SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    
    loadRatesFromDatabase();
    
    const updated = db.prepare("SELECT * FROM rates WHERE id = ?").get(id);
    res.json(updated);
  });

  app.post("/api/payments/quote", (req, res) => {
    const normalizedPlate = normalizePlate(req.body?.plate);
    if (!normalizedPlate) {
      return res.status(400).json({ error: "La placa es requerida" });
    }
    const result = buildQuoteForPlate(normalizedPlate);
    if ("error" in result) {
      return res.status(404).json({ error: result.error });
    }
    res.json(result.quote);
  });

  app.post("/api/payments/process", (req, res) => {
    const normalizedPlate = normalizePlate(req.body?.plate);
    const paymentMethod = String(req.body?.payment_method || "efectivo").toLowerCase();

    if (!normalizedPlate) {
      return res.status(400).json({ error: "La placa es requerida" });
    }
    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: "Método de pago no válido" });
    }

    const result = buildQuoteForPlate(normalizedPlate);
    if ("error" in result) {
      return res.status(404).json({ error: result.error });
    }

    const quote = result.quote;
    const existingApproved = db
      .prepare("SELECT * FROM payments WHERE log_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1")
      .get(quote.log_id);

    if (existingApproved) {
      return res.json({ success: true, payment: existingApproved, reused: true });
    }

    const methodToSave = quote.has_monthly ? "mensualidad" : paymentMethod;
    const reference = `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const info = db
      .prepare(
        `
        INSERT INTO payments (
          log_id, plate, vehicle_type, entry_time, exit_attempt_time,
          parked_minutes, hourly_rate, fraction_minutes, amount,
          payment_method, status, reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
      `
      )
      .run(
        quote.log_id,
        quote.plate,
        quote.vehicle_type,
        quote.entry_time,
        quote.exit_attempt_time,
        quote.parked_minutes,
        quote.hourly_rate,
        quote.fraction_minutes,
        quote.amount,
        methodToSave,
        reference
      );

    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, payment, reused: false });
  });

  app.get("/api/payments", (_req, res) => {
    const payments = db
      .prepare("SELECT * FROM payments ORDER BY created_at DESC LIMIT 100")
      .all();
    res.json(payments);
  });

  // Register Exit
  app.post("/api/exit", (req, res) => {
    const { plate } = req.body;
    const normalizedPlate = normalizePlate(plate);
    if (!normalizedPlate) {
      return res.status(400).json({ error: "La placa es requerida" });
    }

    const parked = db
      .prepare("SELECT id, cell_id FROM logs WHERE plate = ? AND status = 'parked' ORDER BY entry_time DESC LIMIT 1")
      .get(normalizedPlate) as { id: number; cell_id: number | null } | undefined;

    if (!parked) {
      return res.status(404).json({ error: "Vehículo no encontrado o ya ha salido" });
    }

    const hasApprovedPayment = db
      .prepare("SELECT id FROM payments WHERE log_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1")
      .get(parked.id);

    const hasActiveMonthly = getActiveMonthlySubscriptionByPlate(normalizedPlate);

    if (!hasApprovedPayment && !hasActiveMonthly) {
      return res.status(402).json({
        error: "Debe registrar el pago antes de la salida",
        code: "PAYMENT_REQUIRED",
      });
    }
    
    const info = db.prepare(
      "UPDATE logs SET exit_time = CURRENT_TIMESTAMP, status = 'exited' WHERE plate = ? AND status = 'parked'"
    ).run(normalizedPlate);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: "Vehículo no encontrado o ya ha salido" });
    }

    // Ciclo de celdas:
    // - Mensualidad activa: occupied -> reserved
    // - Visitante: occupied -> available
    if (parked.cell_id && hasActiveMonthly) {
      db.prepare("UPDATE cells SET status = 'reserved', visitor_name = NULL WHERE id = ?").run(parked.cell_id);
    } else if (parked.cell_id) {
      db.prepare("UPDATE cells SET status = 'available', visitor_name = NULL WHERE id = ?").run(parked.cell_id);
    }

    res.json({ success: true });
  });

  // Get current parked vehicles
  app.get("/api/parked", (req, res) => {
    const parked = db.prepare(`
      SELECT l.*, c.code AS cell_code, c.status AS cell_status
      FROM logs l
      LEFT JOIN cells c ON l.cell_id = c.id
      WHERE l.status = 'parked'
      ORDER BY l.entry_time DESC
    `).all();
    res.json(parked);
  });

  // Get history
  app.get("/api/history", (req, res) => {
    const history = db
      .prepare(
        `
        SELECT l.*, p.amount AS paid_amount, p.payment_method, c.code AS cell_code, c.status AS cell_status
        FROM logs l
        LEFT JOIN payments p ON p.log_id = l.id AND p.status = 'approved'
        LEFT JOIN cells c ON l.cell_id = c.id
        ORDER BY l.entry_time DESC
        LIMIT 50
      `
      )
      .all();
    res.json(history);
  });

  // --- Subscriptions API (mensualidades) ---
  app.get("/api/subscriptions", (_req, res) => {
    const rows = db
      .prepare(
        `
        SELECT s.id, s.user_id, u.name AS user_name, u.plate, s.vehicle_type, s.monthly_fee,
               s.start_date, s.end_date, s.status, s.created_at,
               c.code AS cell_code, c.status AS cell_status,
               CAST(julianday(s.end_date) - julianday('now') AS INTEGER) AS days_remaining,
               sp.reference AS payment_reference,
               sp.paid_at AS payment_date
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN cells c ON c.id = u.cell_id
        LEFT JOIN subscription_payments sp ON sp.subscription_id = s.id
        ORDER BY s.created_at DESC
      `
      )
      .all();
    res.json(rows);
  });

  app.get("/api/subscription-payments", (_req, res) => {
    const rows = db
      .prepare(
        `
        SELECT sp.*, u.name AS user_name
        FROM subscription_payments sp
        JOIN users u ON u.id = sp.user_id
        ORDER BY sp.paid_at DESC
        LIMIT 100
      `
      )
      .all();
    res.json(rows);
  });

  app.post("/api/subscriptions/activate", (req, res) => {
    const normalizedPlate = normalizePlate(req.body?.plate);
    const vehicleType = normalizeVehicleType(req.body?.vehicle_type);
    const paymentMethod = String(req.body?.payment_method || "efectivo").toLowerCase();
    if (!normalizedPlate) {
      return res.status(400).json({ error: "La placa es requerida" });
    }
    if (!ALLOWED_SIMULATED_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: "Método de pago no válido" });
    }

    const user = db
      .prepare("SELECT id, plate, cell_id FROM users WHERE plate = ? LIMIT 1")
      .get(normalizedPlate) as { id: number; plate: string; cell_id: number | null } | undefined;

    if (!user) {
      return res.status(404).json({ error: "No existe un usuario registrado con esa placa" });
    }

    // Si el usuario no tiene celda, se asigna automáticamente una compatible.
    if (!user.cell_id) {
      const availableCell = db
        .prepare(
          `
          SELECT id
          FROM cells
          WHERE status = 'available'
            AND (vehicle_type = ? OR vehicle_type = 'todos')
          ORDER BY code ASC
          LIMIT 1
        `
        )
        .get(vehicleType) as { id: number } | undefined;

      if (availableCell) {
        db.prepare("UPDATE users SET cell_id = ? WHERE id = ?").run(availableCell.id, user.id);
        db.prepare("UPDATE cells SET status = 'reserved', visitor_name = NULL WHERE id = ?").run(availableCell.id);
      }
    } else {
      db.prepare("UPDATE cells SET status = 'reserved', visitor_name = NULL WHERE id = ?").run(user.cell_id);
    }

    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'").run(user.id);

    const monthlyFee = MONTHLY_RATES[vehicleType];
    const info = db
      .prepare(
        `
        INSERT INTO subscriptions (user_id, vehicle_type, monthly_fee, start_date, end_date, status)
        VALUES (?, ?, ?, datetime('now'), datetime('now', '+30 days'), 'active')
      `
      )
      .run(user.id, vehicleType, monthlyFee);

    const subscription = db
      .prepare("SELECT * FROM subscriptions WHERE id = ?")
      .get(info.lastInsertRowid);

    const reference = `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const paymentInfo = db.prepare(
      `
      INSERT INTO subscription_payments (
        subscription_id, user_id, plate, vehicle_type, amount, payment_method, status, reference
      ) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)
    `
    ).run(Number(info.lastInsertRowid), user.id, normalizedPlate, vehicleType, monthlyFee, paymentMethod, reference);

    const payment = db
      .prepare("SELECT * FROM subscription_payments WHERE id = ?")
      .get(paymentInfo.lastInsertRowid);

    res.status(201).json({ success: true, subscription, payment });
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
    const normalizedStatus = ["available", "occupied", "reserved", "maintenance"].includes(String(status || "").toLowerCase())
      ? String(status).toLowerCase()
      : "available";
    const info = db.prepare(
      "UPDATE cells SET code = ?, status = ?, vehicle_type = ? WHERE id = ?"
    ).run(String(code).trim().toUpperCase(), normalizedStatus, vtype, id);
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
    db.prepare("UPDATE cells SET status = 'reserved', visitor_name = NULL WHERE id = ?").run(cellId);
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
