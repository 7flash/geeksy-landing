import { db } from '../../../../lib/db'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const wallet = (url.searchParams.get('wallet') || '').trim()
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100)

    const rows = wallet
      ? db.query(`
          SELECT id, wallet, tier_id as tierId, reward_bps as rewardBps, reward_amount as rewardAmount,
                 treasury_amount_at_spin as treasuryAmountAtSpin, status, created_at as createdAt
          FROM wheel_spins
          WHERE wallet = ?
          ORDER BY created_at DESC
          LIMIT ?
        `).all(wallet, limit)
      : db.query(`
          SELECT id, wallet, tier_id as tierId, reward_bps as rewardBps, reward_amount as rewardAmount,
                 treasury_amount_at_spin as treasuryAmountAtSpin, status, created_at as createdAt
          FROM wheel_spins
          ORDER BY created_at DESC
          LIMIT ?
        `).all(limit)

    return Response.json({ ok: true, spins: rows })
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to load wheel spins' }, { status: 500 })
  }
}
