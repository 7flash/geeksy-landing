import { render } from 'melina/client'

type MarketData = {
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
  error?: string
}

type LeaderboardData = {
  leaderboard?: Array<{
    rank: number
    wallet: string
    walletShort: string
    points: number
    streakMinutes: number
    balance: number
    usdPerMinute: number
    lastCreditedAt: number
  }>
  stats?: {
    totalHolders: number
    totalPoints: number
    lastUpdated: number
    activeScoredHolders: number
  }
  priceUsd?: number
  scoringRule?: string
}

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(6)}`
}

function fmtPct(n: number) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtTokenAmount(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(2)
}

function fmtPoints(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(2)
}

function MarketPanel({ data, loading }: { data: MarketData | null; loading: boolean }) {
  if (loading) return <div className="market-loading">Loading live token data…</div>
  if (!data?.ok || !data.pair || !data.token) return <div className="market-loading">{data?.error || 'Market data unavailable right now.'}</div>
  const p = data.pair
  return (
    <div className="market-grid">
      <div className="market-card market-card-primary">
        <div className="market-card-label">Token</div>
        <div className="market-token-row">
          <div>
            <h3>{data.token.name} ({data.token.symbol})</h3>
            <p className="market-muted">{data.token.address}</p>
          </div>
          <a href={p.url} target="_blank" rel="noopener" className="btn-primary">View on Dexscreener</a>
        </div>
      </div>
      <div className="market-card"><div className="market-card-label">Price</div><div className="market-big">{fmtUsd(p.priceUsd)}</div><div className={`market-change ${p.changeH24 >= 0 ? 'pos' : 'neg'}`}>24h {fmtPct(p.changeH24)}</div></div>
      <div className="market-card"><div className="market-card-label">Liquidity</div><div className="market-big">{fmtUsd(p.liquidityUsd)}</div><div className="market-muted">DEX: {p.dexId}</div></div>
      <div className="market-card"><div className="market-card-label">FDV</div><div className="market-big">{fmtUsd(p.fdv)}</div><div className="market-muted">Market cap {fmtUsd(p.marketCap)}</div></div>
      <div className="market-card"><div className="market-card-label">24h Volume</div><div className="market-big">{fmtUsd(p.volume24h)}</div><div className="market-muted">Buys {p.buys24h} · Sells {p.sells24h}</div></div>
      <div className="market-card"><div className="market-card-label">Momentum</div><div className="market-mini-grid"><span className={p.changeM5 >= 0 ? 'pos' : 'neg'}>5m {fmtPct(p.changeM5)}</span><span className={p.changeH1 >= 0 ? 'pos' : 'neg'}>1h {fmtPct(p.changeH1)}</span><span className={p.changeH6 >= 0 ? 'pos' : 'neg'}>6h {fmtPct(p.changeH6)}</span><span className={p.changeH24 >= 0 ? 'pos' : 'neg'}>24h {fmtPct(p.changeH24)}</span></div></div>
    </div>
  )
}

function GravityPanel({ data, loading }: { data: LeaderboardData | null; loading: boolean }) {
  if (loading) return <div className="market-loading">Loading gravity leaderboard…</div>
  if (!data?.leaderboard?.length || !data.stats) return <div className="market-loading">Gravity leaderboard unavailable right now.</div>

  return (
    <div className="holders-wrap">
      <div className="holders-meta">
        <div className="holders-meta-card">
          <div className="market-card-label">Total Gravity</div>
          <div className="holders-meta-big">{fmtPoints(data.stats.totalPoints)}</div>
        </div>
        <div className="holders-meta-card">
          <div className="market-card-label">Scored Wallets</div>
          <div className="holders-meta-big">{data.stats.activeScoredHolders}</div>
        </div>
      </div>
      <div className="holders-table-wrap">
        <table className="holders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th>Gravity</th>
              <th>Balance</th>
              <th>USD / min</th>
              <th>Minutes</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((row) => (
              <tr key={row.wallet}>
                <td>{row.rank}</td>
                <td><code>{row.walletShort}</code></td>
                <td>{fmtPoints(row.points)}</td>
                <td>{fmtTokenAmount(row.balance)}</td>
                <td>{fmtUsd(row.usdPerMinute)}</td>
                <td>{row.streakMinutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="holders-footnote">{data.scoringRule} Last update: {data.stats.lastUpdated ? new Date(data.stats.lastUpdated).toLocaleString() : 'n/a'}.</p>
    </div>
  )
}

export default function mount() {
  const cleanups: Array<() => void> = []

  const copyBtn = document.getElementById('copy-install-btn') as HTMLButtonElement | null
  if (copyBtn) {
    let resetTimer: ReturnType<typeof setTimeout> | null = null
    const original = copyBtn.textContent || '📋'
    const onClick = async () => {
      try {
        await navigator.clipboard.writeText('npx geeksy')
        copyBtn.textContent = '✓ Copied'
      } catch {
        copyBtn.textContent = 'Copy failed'
      }
      if (resetTimer) clearTimeout(resetTimer)
      resetTimer = setTimeout(() => { copyBtn.textContent = original }, 1500)
    }
    copyBtn.addEventListener('click', onClick)
    cleanups.push(() => {
      if (resetTimer) clearTimeout(resetTimer)
      copyBtn.removeEventListener('click', onClick)
    })
  }

  const marketRoot = document.getElementById('market-root')
  if (marketRoot) {
    let loading = true
    let data: MarketData | null = null
    const update = () => render(<MarketPanel data={data} loading={loading} />, marketRoot)
    const fetchData = async () => {
      try {
        const res = await fetch('/api/market')
        data = await res.json()
      } catch {
        data = { ok: false, error: 'Failed to fetch Dexscreener data' }
      } finally {
        loading = false
        update()
      }
    }
    update()
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    cleanups.push(() => { clearInterval(interval); render(null, marketRoot) })
  }

  const holdersRoot = document.getElementById('holders-root')
  if (holdersRoot) {
    let loading = true
    let data: LeaderboardData | null = null
    const update = () => render(<GravityPanel data={data} loading={loading} />, holdersRoot)
    const fetchData = async () => {
      try {
        const res = await fetch('/api/leaderboard?limit=12')
        data = await res.json()
      } catch {
        data = null
      } finally {
        loading = false
        update()
      }
    }
    update()
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    cleanups.push(() => { clearInterval(interval); render(null, holdersRoot) })
  }

  return () => cleanups.forEach((fn) => fn())
}
