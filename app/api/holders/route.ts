import { fetchOwnerBalances } from '../../../lib/gksy'

const CACHE_TTL_MS = 60_000
let cache: { fetchedAt: number; payload: any } | null = null

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return Response.json({ ...cache.payload, cached: true })
  }

  try {
    const data = await fetchOwnerBalances()
    const payload = {
      ok: true,
      mint: data.mint,
      totalSupply: data.totalSupply,
      rpcHost: data.rpcHost,
      fetchedAt: new Date().toISOString(),
      holders: data.holders.map((holder, index) => ({
        rank: index + 1,
        owner: holder.owner,
        amount: holder.balance,
        pctOfSupply: holder.pctOfSupply,
        tokenAccounts: holder.tokenAccounts,
      })),
    }
    cache = { fetchedAt: Date.now(), payload }
    return Response.json({ ...payload, cached: false })
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to fetch holders' }, { status: 500 })
  }
}
