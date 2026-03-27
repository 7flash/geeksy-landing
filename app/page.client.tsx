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

type HoldersData = {
  ok: boolean
  mint?: string
  totalSupply?: number
  rpcHost?: string
  fetchedAt?: string
  holders?: Array<{
    rank: number
    owner: string
    tokenAccount: string
    amount: number
    pctOfSupply: number
  }>
  error?: string
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

function shortAddress(s: string) {
  return `${s.slice(0, 6)}…${s.slice(-6)}`
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

function HoldersPanel({ data, loading }: { data: HoldersData | null; loading: boolean }) {
  if (loading) return <div className="market-loading">Loading real holder data…</div>
  if (!data?.ok || !data.holders?.length) return <div className="market-loading">{data?.error || 'Holder data unavailable right now.'}</div>

  return (
    <div className="holders-wrap">
      <div className="holders-meta">
        <div className="holders-meta-card">
          <div className="market-card-label">RPC</div>
          <div className="holders-meta-big">{data.rpcHost || 'unknown'}</div>
        </div>
        <div className="holders-meta-card">
          <div className="market-card-label">Supply</div>
          <div className="holders-meta-big">{fmtTokenAmount(data.totalSupply || 0)}</div>
        </div>
      </div>
      <div className="holders-table-wrap">
        <table className="holders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Owner Wallet</th>
              <th>Amount</th>
              <th>% Supply</th>
              <th>Token Account</th>
            </tr>
          </thead>
          <tbody>
            {data.holders.slice(0, 12).map((holder) => (
              <tr key={holder.tokenAccount}>
                <td>{holder.rank}</td>
                <td><code>{shortAddress(holder.owner)}</code></td>
                <td>{fmtTokenAmount(holder.amount)}</td>
                <td>{holder.pctOfSupply.toFixed(2)}%</td>
                <td><code>{shortAddress(holder.tokenAccount)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="holders-footnote">Largest token accounts are resolved to owner wallets via Solana RPC. Refreshed every 60s.</p>
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
    let data: HoldersData | null = null
    const update = () => render(<HoldersPanel data={data} loading={loading} />, holdersRoot)
    const fetchData = async () => {
      try {
        const res = await fetch('/api/holders')
        data = await res.json()
      } catch {
        data = { ok: false, error: 'Failed to fetch holder data' }
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
