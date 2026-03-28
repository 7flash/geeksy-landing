import { writeMarketSnapshot } from '../../../lib/db'
import { fetchMarketSnapshot } from '../../../lib/gksy'

export async function GET() {
  try {
    const data = await fetchMarketSnapshot()
    const payload = { ok: true, ...data, capturedAt: Date.now() }
    writeMarketSnapshot(payload, payload.capturedAt)
    return Response.json(payload)
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to fetch market data' }, { status: 502 })
  }
}
