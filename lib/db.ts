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
`)

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
