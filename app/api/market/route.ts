import { fetchMarketSnapshot } from '../../../lib/gksy'

export async function GET() {
  try {
    const data = await fetchMarketSnapshot()
    return Response.json({ ok: true, ...data })
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to fetch market data' }, { status: 502 })
  }
}
