import { Database } from 'bun:sqlite'
import path from 'path'

export const dbPath = path.resolve(process.cwd(), 'gravity.db')
export const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS holder_snapshots (
    wallet TEXT PRIMARY KEY,
    balance REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gravity_points (
    wallet TEXT PRIMARY KEY,
    points REAL NOT NULL DEFAULT 0,
    streak_minutes INTEGER NOT NULL DEFAULT 0,
    last_credited_at INTEGER NOT NULL DEFAULT 0,
    first_seen_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gravity_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS market_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload_json TEXT NOT NULL,
    captured_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS experiment_events (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    cta_id TEXT,
    cta_label TEXT,
    path TEXT,
    referrer TEXT,
    session_id TEXT,
    visitor_id TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT 0
  );
`)

// Ensure stardust column exists on gravity_points
try {
  const cols = db.query(`PRAGMA table_info(gravity_points)`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'stardust')) {
    db.exec(`ALTER TABLE gravity_points ADD COLUMN stardust REAL NOT NULL DEFAULT 0`)
  }
} catch {}

export type GravityRow = {
  wallet: string
  points: number
  streak_minutes: number
  last_credited_at: number
  first_seen_at: number
}

export type HolderRow = {
  wallet: string
  balance: number
  updated_at: number
}

export function shortWallet(wallet: string) {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

export function estimateTokenPriceUsd() {
  const rows = db.query(`
    SELECT h.balance as balance, g.points as points, g.streak_minutes as streak_minutes
    FROM holder_snapshots h
    JOIN gravity_points g ON g.wallet = h.wallet
    WHERE h.balance > 0 AND g.streak_minutes > 0 AND g.points > 0
    ORDER BY h.balance DESC
    LIMIT 50
  `).all() as Array<{ balance: number; points: number; streak_minutes: number }>

  if (!rows.length) return 0.000004

  const estimates = rows
    .map((r) => (r.points / r.streak_minutes) / r.balance)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b)

  if (!estimates.length) return 0.000004
  return estimates[Math.floor(estimates.length / 2)]!
}

export function readLatestMarketSnapshot<T = any>() {
  try {
    const row = db.query(`
      SELECT payload_json, captured_at
      FROM market_snapshots
      ORDER BY captured_at DESC
      LIMIT 1
    `).get() as { payload_json: string; captured_at: number } | null

    if (!row?.payload_json) return null

    return {
      capturedAt: row.captured_at || 0,
      payload: JSON.parse(row.payload_json) as T,
    }
  } catch {
    return null
  }
}

export function writeMarketSnapshot(payload: unknown, capturedAt = Date.now()) {
  db.query(`INSERT INTO market_snapshots (payload_json, captured_at) VALUES (?, ?)`).run(JSON.stringify(payload), capturedAt)
}
