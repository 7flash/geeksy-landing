import { getMarketSnapshotWithFallback } from '../../../lib/market-cache'

export async function GET() {
  try {
    const { payload, source } = await getMarketSnapshotWithFallback({ allowStale: true })
    return Response.json({ ...payload, source })
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to fetch market data' }, { status: 502 })
  }
}
