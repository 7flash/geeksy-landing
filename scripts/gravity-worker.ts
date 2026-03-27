import { mkdirSync } from 'fs'
import path from 'path'
import { db, dbPath } from '../lib/db'
import { fetchMarketSnapshot, fetchOwnerBalances, TOKEN_MINT } from '../lib/gksy'

const TICK_MS = 60_000
const SCORING_VERSION = 'gksy-gravity-v1'

function ensureSchema() {
  mkdirSync(path.dirname(dbPath), { recursive: true })
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
}

function getMeta(key: string) {
  const row = db.query('SELECT value FROM gravity_meta WHERE key = ?').get(key) as { value: string } | null
  return row?.value ?? null
}

function setMeta(key: string, value: string) {
  db.query(`
    INSERT INTO gravity_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value)
}

function resetIfMintChanged() {
  const current = getMeta('token_mint')
  const scoringVersion = getMeta('scoring_version')

  if (!current || current !== TOKEN_MINT || scoringVersion !== SCORING_VERSION) {
    db.exec('DELETE FROM holder_snapshots; DELETE FROM gravity_points;')
    setMeta('token_mint', TOKEN_MINT)
    setMeta('scoring_version', SCORING_VERSION)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function upsertSnapshot(wallet: string, balance: number, now: number) {
  db.query(`
    INSERT INTO holder_snapshots (wallet, balance, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(wallet) DO UPDATE SET
      balance = excluded.balance,
      updated_at = excluded.updated_at
  `).run(wallet, balance, now)
}

function creditGravity(wallet: string, usdValue: number, now: number) {
  db.query(`
    INSERT INTO gravity_points (wallet, points, streak_minutes, last_credited_at, first_seen_at)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(wallet) DO UPDATE SET
      points = gravity_points.points + excluded.points,
      streak_minutes = gravity_points.streak_minutes + 1,
      last_credited_at = excluded.last_credited_at
  `).run(wallet, usdValue, now, now)
}

function zeroMissingBalances(activeWallets: Set<string>, now: number) {
  const rows = db.query('SELECT wallet FROM holder_snapshots').all() as Array<{ wallet: string }>
  for (const row of rows) {
    if (activeWallets.has(row.wallet)) continue
    upsertSnapshot(row.wallet, 0, now)
  }
}

async function tick() {
  const now = Date.now()
  const market = await fetchMarketSnapshot()
  const holders = await fetchOwnerBalances()
  const priceUsd = market.pair.priceUsd

  let totalUsdPerMinute = 0
  const activeWallets = new Set<string>()
  for (const holder of holders.holders) {
    const usdValue = holder.balance * priceUsd
    totalUsdPerMinute += usdValue
    activeWallets.add(holder.owner)
    upsertSnapshot(holder.owner, holder.balance, now)
    creditGravity(holder.owner, usdValue, now)
  }
  zeroMissingBalances(activeWallets, now)

  setMeta('last_price_usd', String(priceUsd))
  setMeta('last_tick_at', String(now))
  setMeta('last_total_holders', String(holders.holders.length))
  setMeta('last_total_usd_per_minute', String(totalUsdPerMinute))
  console.log(`[gravity-worker] tick ok holders=${holders.holders.length} priceUsd=${priceUsd} totalUsdPerMinute=${totalUsdPerMinute.toFixed(4)}`)
}

async function main() {
  ensureSchema()
  resetIfMintChanged()

  do {
    try {
      await tick()
    } catch (error: any) {
      console.error('[gravity-worker] tick failed:', error?.message || error)
    }

    if (process.env.GRAVITY_RUN_ONCE === '1') break

    const delay = TICK_MS - (Date.now() % TICK_MS)
    await sleep(delay)
  } while (true)
}

await main()
