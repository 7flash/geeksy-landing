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

function pct(n: number, total: number) {
  return total > 0 ? (n / total) * 100 : 0
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
    if (roll <= 0) return { row, probability: row.points / total }
  }
  const last = rows[rows.length - 1]
  return { row: last, probability: last ? last.points / total : 0 }
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
      <div className="market-card"><div className="market-card-label">Price</div><div className="market-big">{fmtUsd(p.priceUsd)}</div><div className={`market-change ${p.changeH24 >= 0 ? 'pos' : 'neg'}`}>24h {fmtPct(p.changeH24)}</div></div>
      <div className="market-card"><div className="market-card-label">Liquidity</div><div className="market-big">{fmtUsd(p.liquidityUsd)}</div><div className="market-muted">DEX: {p.dexId}</div></div>
      <div className="market-card"><div className="market-card-label">FDV</div><div className="market-big">{fmtUsd(p.fdv)}</div><div className="market-muted">Market cap {fmtUsd(p.marketCap)}</div></div>
      <div className="market-card"><div className="market-card-label">24h Volume</div><div className="market-big">{fmtUsd(p.volume24h)}</div><div className="market-muted">Buys {p.buys24h} · Sells {p.sells24h}</div></div>
      <div className="market-card"><div className="market-card-label">Momentum</div><div className="market-mini-grid"><span className={p.changeM5 >= 0 ? 'pos' : 'neg'}>5m {fmtPct(p.changeM5)}</span><span className={p.changeH1 >= 0 ? 'pos' : 'neg'}>1h {fmtPct(p.changeH1)}</span><span className={p.changeH6 >= 0 ? 'pos' : 'neg'}>6h {fmtPct(p.changeH6)}</span><span className={p.changeH24 >= 0 ? 'pos' : 'neg'}>24h {fmtPct(p.changeH24)}</span></div></div>
    </div>
  )
}

function WheelModal({
  rows,
  state,
  onClose,
  onSpin,
}: {
  rows: LeaderboardRow[]
  state: WheelState
  onClose: () => void
  onSpin: () => void
}) {
  const wheelRows = rows.slice(0, 12)
  const gradient = buildWheelGradient(wheelRows)
  const total = wheelRows.reduce((sum, row) => sum + row.points, 0)

  return (
    <div className="wheel-modal-backdrop" id="wheel-backdrop">
      <div className="wheel-modal" role="dialog" aria-modal="true" aria-labelledby="wheel-title">
        <button className="wheel-close" id="wheel-close-btn" aria-label="Close">×</button>
        <div className="wheel-modal-copy">
          <div className="section-label">Weighted by gravity</div>
          <h3 id="wheel-title">Spin the Gravity Wheel</h3>
          <p>
            The wheel uses the current displayed gravity leaderboard. Each slice size and win chance is proportional to that wallet&apos;s gravity score.
          </p>
        </div>

        <div className="wheel-stage">
          <div className="wheel-pointer" />
          <div className="wheel-half-mask">
            <div
              className="wheel-disc"
              style={{
                background: gradient,
                transform: `rotate(${state.rotationDeg}deg)`,
                transition: state.spinning ? 'transform 5.4s cubic-bezier(0.12, 0.8, 0.12, 1)' : 'transform 0.3s ease',
              }}
            />
          </div>
        </div>

        <div className="wheel-actions">
          <button className="btn-hero" id="spin-wheel-btn" disabled={state.spinning}> {state.spinning ? 'Spinning…' : 'Spin the Wheel'} </button>
          <button className="wheel-secondary-btn" id="close-wheel-btn">Close</button>
        </div>

        {state.winnerWallet ? (
          <div className="wheel-result">
            <div className="market-card-label">Winner</div>
            <div className="wheel-result-wallet"><code>{rows.find((row) => row.wallet === state.winnerWallet)?.walletShort || state.winnerWallet}</code></div>
            <p>Win probability: {fmtPct(state.winnerProbability * 100)}</p>
          </div>
        ) : null}

        <div className="wheel-legend">
          {wheelRows.map((row, index) => (
            <div className="wheel-legend-row" key={row.wallet}>
              <span className="wheel-color" style={{ background: WHEEL_COLORS[index % WHEEL_COLORS.length] }} />
              <code>{row.walletShort}</code>
              <span>{fmtPoints(row.points)} gravity</span>
              <span>{pct(row.points, total).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GravityPanel({
  data,
  loading,
  wheelState,
  openWheel,
}: {
  data: LeaderboardData | null
  loading: boolean
  wheelState: WheelState
  openWheel: () => void
}) {
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
      <div className="gravity-toolbar">
        <p className="gravity-toolbar-copy">Want a weighted random winner? Spin a half-wheel where slice size equals gravity score.</p>
        <button className="btn-hero" id="open-wheel-btn">Spin the Wheel</button>
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
      {wheelState.open ? <div id="wheel-modal-root"><button id="hidden-open-wheel" style={{ display: 'none' }} onClick={openWheel}></button></div> : null}
    </div>
  )
}

export default function mount() {
  const cleanups: Array<() => void> = []

  let marketLoading = true
  let marketData: MarketData | null = null
  let gravityLoading = true
  let gravityData: LeaderboardData | null = null
  let wheelState: WheelState = {
    open: false,
    spinning: false,
    rotationDeg: 0,
    winnerWallet: null,
    winnerProbability: 0,
  }

  const copyBtn = document.getElementById('copy-install-btn') as HTMLButtonElement | null
  const marketRoot = document.getElementById('market-root')
  const holdersRoot = document.getElementById('holders-root')

  let wheelModalMount = document.getElementById('wheel-modal-mount')
  if (!wheelModalMount) {
    wheelModalMount = document.createElement('div')
    wheelModalMount.id = 'wheel-modal-mount'
    document.body.appendChild(wheelModalMount)
    cleanups.push(() => wheelModalMount?.remove())
  }

  const renderAll = () => {
    if (marketRoot) {
      render(<MarketPanel data={marketData} loading={marketLoading} />, marketRoot)
    }

    if (holdersRoot) {
      const openWheel = () => {
        wheelState = { ...wheelState, open: true }
        renderAll()
      }

      render(
        <GravityPanel
          data={gravityData}
          loading={gravityLoading}
          wheelState={wheelState}
          openWheel={openWheel}
        />,
        holdersRoot,
      )

      const openBtn = document.getElementById('open-wheel-btn') as HTMLButtonElement | null
      if (openBtn) {
        openBtn.onclick = () => {
          wheelState = { ...wheelState, open: true }
          renderAll()
        }
      }
    }

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
          wheelState = {
            ...wheelState,
            spinning: true,
            winnerWallet: null,
            winnerProbability: 0,
            rotationDeg: getWinnerRotation(wheelRows, winner.row.wallet, wheelState.rotationDeg),
          }
          renderAll()

          setTimeout(() => {
            wheelState = {
              ...wheelState,
              spinning: false,
              winnerWallet: winner.row.wallet,
              winnerProbability: winner.probability,
            }
            renderAll()
          }, 5600)
        }

        render(
          <WheelModal rows={rows} state={wheelState} onClose={closeWheel} onSpin={spinWheel} />,
          wheelModalMount,
        )

        const closeButtons = ['wheel-close-btn', 'close-wheel-btn']
        for (const id of closeButtons) {
          const btn = document.getElementById(id) as HTMLButtonElement | null
          if (btn) btn.onclick = closeWheel
        }

        const backdrop = document.getElementById('wheel-backdrop')
        if (backdrop) {
          backdrop.onclick = (event) => {
            if (event.target === backdrop) closeWheel()
          }
        }

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
      const res = await fetch('/api/leaderboard?limit=12')
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
