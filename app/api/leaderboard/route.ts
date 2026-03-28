import { db } from '../../../lib/db'
import { fetchMarketSnapshot, getWalletDisplay, getWalletLabel } from '../../../lib/gksy'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 50)

  const rows = db.query(`
    SELECT g.wallet, g.points, g.streak_minutes, g.last_credited_at, h.balance
    FROM gravity_points g
    LEFT JOIN holder_snapshots h ON h.wallet = g.wallet
    ORDER BY g.points DESC
    LIMIT ?
  `).all(limit) as Array<{
    wallet: string
    points: number
    streak_minutes: number
    last_credited_at: number
    balance: number | null
  }>

  const stats = db.query(`
    SELECT 
      COUNT(*) as totalHolders,
      COALESCE(SUM(points), 0) as totalPoints,
      COALESCE(MAX(last_credited_at), 0) as lastUpdated,
      COALESCE(SUM(CASE WHEN streak_minutes > 0 THEN 1 ELSE 0 END), 0) as activeScoredHolders
    FROM gravity_points
  `).get() as { totalHolders: number; totalPoints: number; lastUpdated: number; activeScoredHolders: number }

  let priceUsd = 0
  try {
    const market = await fetchMarketSnapshot()
    priceUsd = market.pair.priceUsd
  } catch {}

  return Response.json({
    leaderboard: rows.map((row, i) => ({
      rank: i + 1,
      wallet: row.wallet,
      walletShort: getWalletDisplay(row.wallet),
      walletLabel: getWalletLabel(row.wallet),
      points: row.points,
      streakMinutes: row.streak_minutes,
      balance: row.balance || 0,
      usdPerMinute: priceUsd > 0 && row.balance ? row.balance * priceUsd : 0,
      lastCreditedAt: row.last_credited_at,
    })),
    stats,
    priceUsd,
    scoringRule: 'Each minute, a wallet earns gravity points equal to its current GKSY balance multiplied by current USD price.',
  })
}
