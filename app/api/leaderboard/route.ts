import { db, estimateTokenPriceUsd } from '../../../lib/db'
import { getWalletMeta } from '../../../lib/gksy'
import { getMarketSnapshotWithFallback } from '../../../lib/market-cache'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200)
  const sortBy = url.searchParams.get('sort') || 'stardust' // stardust | gravity

  // Ensure stardust column exists
  try {
    const cols = db.query(`PRAGMA table_info(gravity_points)`).all() as Array<{ name: string }>
    if (!cols.some((c) => c.name === 'stardust')) {
      db.exec(`ALTER TABLE gravity_points ADD COLUMN stardust REAL NOT NULL DEFAULT 0`)
    }
  } catch {}

  const orderCol = sortBy === 'gravity' ? 'gravity' : 'stardust'
  const orderExpr = orderCol === 'gravity'
    ? `(COALESCE(g.points, 0) - COALESCE(l.total_spent, 0))`
    : `COALESCE(g.stardust, 0)`

  const rows = db.query(`
    SELECT 
      g.wallet,
      g.points,
      g.streak_minutes,
      g.last_credited_at,
      COALESCE(g.stardust, 0) as stardust,
      h.balance,
      COALESCE(l.total_spent, 0) as totalSpent,
      COALESCE(g.points, 0) - COALESCE(l.total_spent, 0) as remainingGravity
    FROM gravity_points g
    LEFT JOIN holder_snapshots h ON h.wallet = g.wallet
    LEFT JOIN wallet_gravity_ledger l ON l.wallet = g.wallet
    ORDER BY ${orderExpr} DESC, g.points DESC
    LIMIT ?
  `).all(limit) as Array<{
    wallet: string
    points: number
    streak_minutes: number
    last_credited_at: number
    stardust: number
    balance: number | null
    totalSpent: number
    remainingGravity: number
  }>

  const stats = db.query(`
    SELECT 
      COUNT(*) as totalHolders,
      COALESCE(SUM(points), 0) as totalPoints,
      COALESCE(SUM(stardust), 0) as totalStardust,
      COALESCE(MAX(last_credited_at), 0) as lastUpdated,
      COALESCE(SUM(CASE WHEN streak_minutes > 0 THEN 1 ELSE 0 END), 0) as activeScoredHolders
    FROM gravity_points
  `).get() as { totalHolders: number; totalPoints: number; totalStardust: number; lastUpdated: number; activeScoredHolders: number }

  // Total remaining gravity across all holders
  const totalRemaining = db.query(`
    SELECT COALESCE(SUM(
      COALESCE(g.points, 0) - COALESCE(l.total_spent, 0)
    ), 0) as total
    FROM gravity_points g
    LEFT JOIN wallet_gravity_ledger l ON l.wallet = g.wallet
    WHERE COALESCE(g.points, 0) - COALESCE(l.total_spent, 0) > 0
  `).get() as { total: number }

  let priceUsd = estimateTokenPriceUsd()
  try {
    const { payload } = await getMarketSnapshotWithFallback({ allowStale: true })
    if (payload.pair?.priceUsd) priceUsd = payload.pair.priceUsd
  } catch {}

  return Response.json({
    leaderboard: rows.map((row, i) => ({
      rank: i + 1,
      ...getWalletMeta(row.wallet),
      points: row.points,
      stardust: row.stardust,
      remainingGravity: Math.max(0, row.remainingGravity),
      totalSpent: row.totalSpent,
      streakMinutes: row.streak_minutes,
      balance: row.balance || 0,
      usdPerMinute: priceUsd > 0 && row.balance ? row.balance * priceUsd : 0,
      lastCreditedAt: row.last_credited_at,
    })),
    stats: {
      ...stats,
      totalRemainingGravity: totalRemaining?.total || 0,
    },
    priceUsd,
    sortedBy: sortBy,
    scoringRule: 'Each minute, a wallet earns gravity equal to GKSY balance × USD price. Spinning the wheel burns all gravity into stardust.',
  })
}
