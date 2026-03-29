import { readLatestMarketSnapshot, writeMarketSnapshot } from './db'
import { fetchMarketSnapshot } from './gksy'

export type MarketSnapshotPayload = {
  ok: boolean
  token?: { address: string; symbol: string; name: string }
  pair?: {
    dexId: string
    pairAddress: string
    url: string
    priceUsd: number
    priceNative: number
    fdv: number
    marketCap: number
    liquidityUsd: number
    volume24h: number
    buys24h: number
    sells24h: number
    changeM5: number
    changeH1: number
    changeH6: number
    changeH24: number
  }
  capturedAt?: number
  error?: string
  stale?: boolean
}

export const MARKET_SNAPSHOT_MAX_AGE_MS = Number(process.env.MARKET_SNAPSHOT_MAX_AGE_MS || 5 * 60 * 1000)

function isFresh(capturedAt: number | undefined | null, now = Date.now()) {
  return !!capturedAt && now - capturedAt <= MARKET_SNAPSHOT_MAX_AGE_MS
}

export function readCachedMarketSnapshot() {
  return readLatestMarketSnapshot<MarketSnapshotPayload>()?.payload || null
}

export async function refreshMarketSnapshot(now = Date.now()) {
  const data = await fetchMarketSnapshot()
  const payload: MarketSnapshotPayload = { ok: true, ...data, capturedAt: now }
  writeMarketSnapshot(payload, now)
  return payload
}

export async function getMarketSnapshotWithFallback(options?: { now?: number; allowStale?: boolean }) {
  const now = options?.now || Date.now()
  const cached = readCachedMarketSnapshot()
  if (cached?.ok && isFresh(cached.capturedAt, now)) {
    return { payload: cached, source: 'cache' as const }
  }

  try {
    const fresh = await refreshMarketSnapshot(now)
    return { payload: fresh, source: 'live' as const }
  } catch (error: any) {
    if (cached?.ok && options?.allowStale !== false) {
      return {
        payload: {
          ...cached,
          stale: true,
          error: error?.message || 'Failed to refresh market snapshot',
        },
        source: 'stale-cache' as const,
      }
    }
    throw error
  }
}
