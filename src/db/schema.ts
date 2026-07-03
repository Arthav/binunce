import type { Database } from "sql.js";

export const DB_KEY = "binunce_db";
export const SCHEMA_VERSION = 1;

const defaultSettings = {
  sound_enabled: true,
  chart_type: "candles",
  theme: "binunce-dark",
  has_onboarded: false,
  volatility_mode: "normal",
} as const;

export function runMigrations(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE IF NOT EXISTS account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      display_name TEXT NOT NULL DEFAULT 'Degen',
      balance REAL NOT NULL DEFAULT 0,
      total_deposited REAL NOT NULL DEFAULT 0,
      total_withdrawn REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      high_watermark REAL NOT NULL DEFAULT 0,
      total_trades INTEGER NOT NULL DEFAULT 0,
      total_wins INTEGER NOT NULL DEFAULT 0,
      total_liquidations INTEGER NOT NULL DEFAULT 0,
      biggest_win REAL NOT NULL DEFAULT 0,
      biggest_loss REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS deposit (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL CHECK (amount > 0),
      method TEXT NOT NULL CHECK (method IN ('card', 'crypto', 'bank', 'instant')),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS position (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('long', 'short')),
      margin REAL NOT NULL CHECK (margin > 0),
      leverage INTEGER NOT NULL CHECK (leverage >= 1 AND leverage <= 1000),
      notional REAL NOT NULL,
      size REAL NOT NULL,
      entry_price REAL NOT NULL,
      liq_price REAL NOT NULL,
      tp_price REAL NULL,
      sl_price REAL NULL,
      opened_at INTEGER NOT NULL,
      fee_open REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('long', 'short')),
      margin REAL NOT NULL,
      leverage INTEGER NOT NULL,
      notional REAL NOT NULL,
      size REAL NOT NULL,
      entry_price REAL NOT NULL,
      exit_price REAL NOT NULL,
      pnl REAL NOT NULL,
      pnl_pct REAL NOT NULL,
      roi_pct REAL NOT NULL,
      fee_total REAL NOT NULL,
      close_reason TEXT NOT NULL CHECK (close_reason IN ('manual', 'tp', 'sl', 'liquidation')),
      opened_at INTEGER NOT NULL,
      closed_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  seedRows(db);
  db.run(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

export function resetSchema(db: Database): void {
  db.run(`
    DROP TABLE IF EXISTS trade;
    DROP TABLE IF EXISTS position;
    DROP TABLE IF EXISTS deposit;
    DROP TABLE IF EXISTS settings;
    DROP TABLE IF EXISTS account;
  `);
  runMigrations(db);
}

function seedRows(db: Database): void {
  db.run(
    `INSERT OR IGNORE INTO account (
      id,
      display_name,
      balance,
      total_deposited,
      total_withdrawn,
      created_at,
      high_watermark,
      total_trades,
      total_wins,
      total_liquidations,
      biggest_win,
      biggest_loss
    ) VALUES (1, 'Degen', 0, 0, 0, ?, 0, 0, 0, 0, 0, 0);`,
    [Date.now()],
  );

  Object.entries(defaultSettings).forEach(([key, value]) => {
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);`, [
      key,
      JSON.stringify(value),
    ]);
  });
}
