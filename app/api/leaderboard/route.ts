import { db, shortWallet } from '../../../lib/db'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 50)

  const rows = db.query(`
    SELECT wallet, points, streak_minutes, last_credited_at
    FROM gravity_points
    ORDER BY points DESC
    LIMIT ?
  `).all(limit) as Array<{
    wallet: string
    points: number
    streak_minutes: number
    last_credited_at: number
  }>

  const stats = db.query(`
    SELECT COUNT(*) as totalHolders, COALESCE(SUM(points), 0) as totalPoints, COALESCE(MAX(last_credited_at), 0) as lastUpdated
    FROM gravity_points
  `).get() as { totalHolders: number; totalPoints: number; lastUpdated: number }

  return Response.json({
    leaderboard: rows.map((row, i) => ({
      rank: i + 1,
      wallet: row.wallet,
      walletShort: shortWallet(row.wallet),
      points: row.points,
      streakMinutes: row.streak_minutes,
    })),
    stats,
  })
}
