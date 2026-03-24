import { db, estimateTokenPriceUsd, shortWallet } from '../../../lib/db'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 50)
  const tokenPriceUsd = estimateTokenPriceUsd()

  const holders = db.query(`
    SELECT wallet, balance, updated_at
    FROM holder_snapshots
    ORDER BY balance DESC
    LIMIT ?
  `).all(limit) as Array<{
    wallet: string
    balance: number
    updated_at: number
  }>

  const totals = db.query(`
    SELECT COUNT(*) as totalHolders, COALESCE(SUM(balance), 0) as totalTokens, COALESCE(MAX(updated_at), 0) as lastUpdated
    FROM holder_snapshots
  `).get() as { totalHolders: number; totalTokens: number; lastUpdated: number }

  const top10Rows = db.query(`
    SELECT balance FROM holder_snapshots ORDER BY balance DESC LIMIT 10
  `).all() as Array<{ balance: number }>
  const top10Total = top10Rows.reduce((sum, row) => sum + row.balance, 0)

  return Response.json({
    holders: holders.map((row, i) => ({
      rank: i + 1,
      wallet: row.wallet,
      walletShort: shortWallet(row.wallet),
      balance: row.balance,
      usdValue: row.balance * tokenPriceUsd,
    })),
    stats: {
      totalHolders: totals.totalHolders,
      totalTokens: totals.totalTokens,
      top10Percentage: totals.totalTokens > 0 ? (top10Total / totals.totalTokens) * 100 : 0,
      lastUpdated: totals.lastUpdated,
      tokenPriceUsd,
    },
  })
}
