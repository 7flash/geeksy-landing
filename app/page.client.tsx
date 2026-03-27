import { render } from 'melina/client'

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean
      connect: () => Promise<{ publicKey: { toString(): string } }>
      disconnect: () => Promise<void>
    }
  }
}

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

type LeaderboardRow = {
  rank: number
  wallet: string
  walletShort: string
  points: number
  streakMinutes: number
  balance: number
  usdPerMinute: number
  lastCreditedAt: number
}

type LeaderboardData = {
  leaderboard?: LeaderboardRow[]
  stats?: {
    totalHolders: number
    totalPoints: number
    lastUpdated: number
    activeScoredHolders: number
  }
  priceUsd?: number
  scoringRule?: string
}

type WheelState = {
  open: boolean
  spinning: boolean
  rotationDeg: number
  winnerWallet: string | null
  winnerProbability: number
}

const WHEEL_COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#22c55e', '#6366f1', '#ef4444', '#14b8a6', '#a855f7', '#f97316', '#10b981', '#3b82f6']
const DEFAULT_VISIBLE_HOLDERS = 20

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(6)}`
}

function fmtMarketPct(n: number) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtProbability(n: number) {
  return `${n.toFixed(2)}%`
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

function shortWinnerWallet(wallet: string, leaderboard: LeaderboardRow[]) {
  return leaderboard.find((row) => row.wallet === wallet)?.walletShort || wallet
}

function percentOf(row: LeaderboardRow, rows: LeaderboardRow[]) {
  const total = rows.reduce((sum, item) => sum + item.points, 0)
  return total > 0 ? (row.points / total) * 100 : 0
}

function buildWheelSegments(rows: LeaderboardRow[]) {
  const total = rows.reduce((sum, row) => sum + row.points, 0)
  let start = 0
  const segments = rows.map((row, index) => {
    const fraction = total > 0 ? row.points / total : 0
    const degrees = fraction * 180
    const segment = {
      row,
      color: WHEEL_COLORS[index % WHEEL_COLORS.length],
      start,
      end: start + degrees,
      degrees,
      probability: fraction,
      center: start + degrees / 2,
    }
    start += degrees
    return segment
  })
  return { segments, total }
}

function chooseWeightedWinner(rows: LeaderboardRow[]) {
  const total = rows.reduce((sum, row) => sum + row.points, 0)
  if (total <= 0) return { row: rows[0], probability: 0 }
  let roll = Math.random() * total
  for (const row of rows) {
    roll -= row.points
    if (roll <= 0) return { row, probability: (row.points / total) * 100 }
  }
  const last = rows[rows.length - 1]
  return { row: last, probability: last ? (last.points / total) * 100 : 0 }
}

function buildWheelGradient(rows: LeaderboardRow[]) {
  const { segments } = buildWheelSegments(rows)
  const stops = segments.map((segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`)
  return `conic-gradient(from 180deg, ${stops.join(', ')})`
}

function getWinnerRotation(rows: LeaderboardRow[], winnerWallet: string, currentRotation: number) {
  const { segments } = buildWheelSegments(rows)
  const segment = segments.find((entry) => entry.row.wallet === winnerWallet)
  if (!segment) return currentRotation + 1440

  const pointerAngle = 90
  const center = 180 + segment.center
  const target = pointerAngle - center
  const normalizedCurrent = ((currentRotation % 360) + 360) % 360
  let delta = target - normalizedCurrent
  while (delta < 0) delta += 360
  return currentRotation + 1440 + delta
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
      <div className="market-card"><div className="market-card-label">Price</div><div className="market-big">{fmtUsd(p.priceUsd)}</div><div className={`market-change ${p.changeH24 >= 0 ? 'pos' : 'neg'}`}>24h {fmtMarketPct(p.changeH24)}</div></div>
      <div className="market-card"><div className="market-card-label">Liquidity</div><div className="market-big">{fmtUsd(p.liquidityUsd)}</div><div className="market-muted">DEX: {p.dexId}</div></div>
      <div className="market-card"><div className="market-card-label">FDV</div><div className="market-big">{fmtUsd(p.fdv)}</div><div className="market-muted">Market cap {fmtUsd(p.marketCap)}</div></div>
      <div className="market-card"><div className="market-card-label">24h Volume</div><div className="market-big">{fmtUsd(p.volume24h)}</div><div className="market-muted">Buys {p.buys24h} · Sells {p.sells24h}</div></div>
      <div className="market-card"><div className="market-card-label">Momentum</div><div className="market-mini-grid"><span className={p.changeM5 >= 0 ? 'pos' : 'neg'}>5m {fmtMarketPct(p.changeM5)}</span><span className={p.changeH1 >= 0 ? 'pos' : 'neg'}>1h {fmtMarketPct(p.changeH1)}</span><span className={p.changeH6 >= 0 ? 'pos' : 'neg'}>6h {fmtMarketPct(p.changeH6)}</span><span className={p.changeH24 >= 0 ? 'pos' : 'neg'}>24h {fmtMarketPct(p.changeH24)}</span></div></div>
    </div>
  )
}

function GravityHeroPanel({
  rows,
  wallet,
  expanded,
}: {
  rows: LeaderboardRow[]
  wallet: string | null
  expanded: boolean
}) {
  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE_HOLDERS)
  const myRow = wallet ? rows.find((row) => row.wallet === wallet) || null : null
  const myProbability = myRow ? percentOf(myRow, rows.slice(0, 12)) : 0
  const derivedAmount = myRow?.points || 0

  return (
    <div className="gravity-dashboard-card cosmic-dashboard-card">
      <div className="gravity-dashboard-header">
        <div>
          <div className="market-card-label">Gravity Dashboard</div>
          <h3>Live holder leaderboard</h3>
        </div>
        <div className="gravity-wallet-state">
          {wallet ? <code>{wallet.slice(0, 6)}...{wallet.slice(-6)}</code> : <span>Not connected</span>}
        </div>
      </div>

      <div className="wallet-summary-grid">
        <div className="wallet-summary-card"><div className="market-card-label">Your Gravity</div><div className="wallet-summary-value">{fmtPoints(myRow?.points || 0)}</div><p>{myRow ? `Rank #${myRow.rank}` : 'Connect Phantom to match your wallet.'}</p></div>
        <div className="wallet-summary-card"><div className="market-card-label">Wheel Spendable</div><div className="wallet-summary-value">{fmtPoints(derivedAmount)}</div><p>Derived from current gravity until spend tracking exists.</p></div>
        <div className="wallet-summary-card"><div className="market-card-label">Total Earned</div><div className="wallet-summary-value">{fmtPoints(derivedAmount)}</div><p>Current accumulated gravity score.</p></div>
        <div className="wallet-summary-card"><div className="market-card-label">Available to Claim</div><div className="wallet-summary-value">{fmtPoints(derivedAmount)}</div><p>UI placeholder until claim ledger/backend is live.</p></div>
      </div>

      <div className="gravity-dashboard-subline">
        <span>{wallet && myRow ? `Your top-12 wheel chance: ${fmtProbability(myProbability)}` : 'Connect your wallet to see your personal gravity summary.'}</span>
        <button className="wheel-secondary-btn" id="toggle-hero-holders-btn">{expanded ? 'Show Top 20' : `Show All (${rows.length})`}</button>
      </div>

      <div className="gravity-hero-table-wrap">
        <table className="holders-table gravity-hero-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th>Gravity</th>
              <th>Balance</th>
              <th>Last Minute</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.wallet} className={wallet === row.wallet ? 'active-wallet-row' : ''}>
                <td>{row.rank}</td>
                <td><code>{row.walletShort}</code></td>
                <td>{fmtPoints(row.points)}</td>
                <td>{fmtTokenAmount(row.balance)}</td>
                <td>{fmtUsd(row.usdPerMinute)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WheelModal({ rows, state }: { rows: LeaderboardRow[]; state: WheelState }) {
  const wheelRows = rows.slice(0, 12)
  const gradient = buildWheelGradient(wheelRows)
  return (
    <div className="wheel-modal-backdrop" id="wheel-backdrop">
      <div className="wheel-modal cosmic-wheel-modal" role="dialog" aria-modal="true" aria-labelledby="wheel-title">
        <div className="cosmic-stars" />
        <button className="wheel-close" id="wheel-close-btn" aria-label="Close">×</button>
        <div className="wheel-modal-copy">
          <div className="section-label">Cosmic weighted draw</div>
          <h3 id="wheel-title">Spin the Gravity Wheel</h3>
          <p>Slice size is proportional to gravity score. More gravity means more space on the wheel and a higher chance to win.</p>
        </div>
        <div className="wheel-stage cosmic-wheel-stage">
          <div className="wheel-orbit-ring orbit-ring-1" />
          <div className="wheel-orbit-ring orbit-ring-2" />
          <div className="wheel-pointer" />
          <div className="wheel-half-mask cosmic-wheel-mask">
            <div className="wheel-glow" />
            <div className="wheel-disc cosmic-wheel-disc" style={{ background: gradient, transform: `rotate(${state.rotationDeg}deg)`, transition: state.spinning ? 'transform 5.4s cubic-bezier(0.12, 0.8, 0.12, 1)' : 'transform 0.3s ease' }} />
          </div>
        </div>
        <div className="wheel-actions">
          <button className="btn-hero" id="spin-wheel-btn" disabled={state.spinning}>{state.spinning ? 'Spinning…' : 'Spin the Wheel'}</button>
          <button className="wheel-secondary-btn" id="close-wheel-btn">Close</button>
        </div>
        {state.winnerWallet ? <div className="wheel-result cosmic-result"><div className="market-card-label">Winner</div><div className="wheel-result-wallet"><code>{shortWinnerWallet(state.winnerWallet, rows)}</code></div><p>Win probability: {fmtProbability(state.winnerProbability)}</p></div> : null}
        <div className="wheel-legend">
          {wheelRows.map((row, index) => <div className="wheel-legend-row" key={row.wallet}><span className="wheel-color" style={{ background: WHEEL_COLORS[index % WHEEL_COLORS.length] }} /><code>{row.walletShort}</code><span>{fmtPoints(row.points)} gravity</span><span>{fmtProbability(percentOf(row, wheelRows))}</span></div>)}
        </div>
      </div>
    </div>
  )
}

function GravitySectionPanel({ data, loading }: { data: LeaderboardData | null; loading: boolean }) {
  if (loading) return <div className="market-loading">Loading gravity leaderboard…</div>
  if (!data?.leaderboard?.length || !data.stats) return <div className="market-loading">Gravity leaderboard unavailable right now.</div>
  return (
    <div className="holders-wrap">
      <div className="holders-meta">
        <div className="holders-meta-card"><div className="market-card-label">Total Gravity</div><div className="holders-meta-big">{fmtPoints(data.stats.totalPoints)}</div></div>
        <div className="holders-meta-card"><div className="market-card-label">Scored Wallets</div><div className="holders-meta-big">{data.stats.activeScoredHolders}</div></div>
      </div>
      <p className="holders-footnote">{data.scoringRule} Last update: {data.stats.lastUpdated ? new Date(data.stats.lastUpdated).toLocaleString() : 'n/a'}.</p>
    </div>
  )
}

export default function mount() {
  const cleanups: Array<() => void> = []
  let marketLoading = true
  let marketData: MarketData | null = null
  let gravityLoading = true
  let gravityData: LeaderboardData | null = null
  let connectedWallet: string | null = null
  let heroExpanded = false
  let wheelState: WheelState = { open: false, spinning: false, rotationDeg: 0, winnerWallet: null, winnerProbability: 0 }

  const copyBtn = document.getElementById('copy-install-btn') as HTMLButtonElement | null
  const marketRoot = document.getElementById('market-root')
  const heroRoot = document.getElementById('gravity-hero-root')

  let wheelModalMount = document.getElementById('wheel-modal-mount')
  if (!wheelModalMount) {
    wheelModalMount = document.createElement('div')
    wheelModalMount.id = 'wheel-modal-mount'
    document.body.appendChild(wheelModalMount)
    cleanups.push(() => wheelModalMount?.remove())
  }

  const connectWallet = async () => {
    const provider = window.solana
    if (!provider?.isPhantom) {
      window.open('https://phantom.app/', '_blank', 'noopener')
      return
    }
    try {
      const result = await provider.connect()
      connectedWallet = result.publicKey.toString()
      renderAll()
    } catch {}
  }

  const renderAll = () => {
    if (marketRoot) render(<MarketPanel data={marketData} loading={marketLoading} />, marketRoot)
    if (heroRoot) {
      if (gravityLoading) {
        render(<div className="market-loading">Loading gravity dashboard…</div>, heroRoot)
      } else if (gravityData?.leaderboard?.length) {
        render(<GravityHeroPanel rows={gravityData.leaderboard} wallet={connectedWallet} expanded={heroExpanded} />, heroRoot)
        const toggle = document.getElementById('toggle-hero-holders-btn') as HTMLButtonElement | null
        if (toggle) toggle.onclick = () => { heroExpanded = !heroExpanded; renderAll() }
      } else {
        render(<div className="market-loading">Gravity dashboard unavailable right now.</div>, heroRoot)
      }
    }

    const heroConnect = document.getElementById('hero-connect-wallet-btn') as HTMLButtonElement | null
    if (heroConnect) heroConnect.onclick = connectWallet
    const heroSpin = document.getElementById('hero-spin-wheel-btn') as HTMLButtonElement | null
    if (heroSpin) heroSpin.onclick = () => { wheelState = { ...wheelState, open: true }; renderAll() }

    if (wheelModalMount) {
      const rows = gravityData?.leaderboard || []
      if (wheelState.open && rows.length) {
        const closeWheel = () => {
          if (wheelState.spinning) return
          wheelState = { ...wheelState, open: false }
          renderAll()
        }
        const spinWheel = () => {
          if (wheelState.spinning) return
          const wheelRows = rows.slice(0, 12)
          const winner = chooseWeightedWinner(wheelRows)
          wheelState = { ...wheelState, spinning: true, winnerWallet: null, winnerProbability: 0, rotationDeg: getWinnerRotation(wheelRows, winner.row.wallet, wheelState.rotationDeg) }
          renderAll()
          setTimeout(() => {
            wheelState = { ...wheelState, spinning: false, winnerWallet: winner.row.wallet, winnerProbability: winner.probability }
            renderAll()
          }, 5600)
        }
        render(<WheelModal rows={rows} state={wheelState} />, wheelModalMount)
        for (const id of ['wheel-close-btn', 'close-wheel-btn']) {
          const btn = document.getElementById(id) as HTMLButtonElement | null
          if (btn) btn.onclick = closeWheel
        }
        const backdrop = document.getElementById('wheel-backdrop')
        if (backdrop) backdrop.onclick = (event) => { if (event.target === backdrop) closeWheel() }
        const spinBtn = document.getElementById('spin-wheel-btn') as HTMLButtonElement | null
        if (spinBtn) spinBtn.onclick = spinWheel
      } else {
        render(null, wheelModalMount)
      }
    }
  }

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

  const fetchMarket = async () => {
    try {
      const res = await fetch('/api/market')
      marketData = await res.json()
    } catch {
      marketData = { ok: false, error: 'Failed to fetch Dexscreener data' }
    } finally {
      marketLoading = false
      renderAll()
    }
  }

  const fetchGravity = async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=200')
      gravityData = await res.json()
    } catch {
      gravityData = null
    } finally {
      gravityLoading = false
      renderAll()
    }
  }

  renderAll()
  fetchMarket()
  fetchGravity()

  const marketInterval = setInterval(fetchMarket, 30_000)
  const gravityInterval = setInterval(fetchGravity, 60_000)
  cleanups.push(() => clearInterval(marketInterval))
  cleanups.push(() => clearInterval(gravityInterval))

  return () => cleanups.forEach((fn) => fn())
}
