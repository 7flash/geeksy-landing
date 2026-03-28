import { render } from 'melina/client'

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean
      connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>
      disconnect: () => Promise<void>
      signMessage?: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature: Uint8Array }>
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

type RewardTier = {
  id: string
  probability: number
  rewardBps: number
}

type WalletSummaryData = {
  ok: boolean
  wallet: string
  totalEarned: number
  totalSpent: number
  spendable: number
  pendingClaims: number
  claimableAmount: number
  wheelSpendAmount: number
  rewardToken: string
  rewardTiers: RewardTier[]
  latestSpin?: {
    id: string
    tierId: string
    rewardAmount: number
    createdAt: number
  } | null
  error?: string
}

type WheelState = {
  open: boolean
  spinning: boolean
  rotationDeg: number
  rewardTierId: string | null
  rewardProbability: number
  rewardBps: number
  rewardAmount: number
  rewardToken: string
  error: string | null
}

const WHEEL_COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#22c55e', '#6366f1', '#ef4444', '#14b8a6']
const DEFAULT_VISIBLE_HOLDERS = 20
const encoder = new TextEncoder()

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

function shortWallet(wallet: string | null) {
  if (!wallet) return null
  return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`
}

function percentOfGravity(row: LeaderboardRow, rows: LeaderboardRow[]) {
  const total = rows.reduce((sum, item) => sum + item.points, 0)
  return total > 0 ? (row.points / total) * 100 : 0
}

function rewardPctLabel(rewardBps: number) {
  return `${(rewardBps / 100).toFixed(2)}%`
}

function buildRewardSegments(tiers: RewardTier[]) {
  let start = 0
  const segments = tiers.map((tier, index) => {
    const degrees = tier.probability * 180
    const segment = {
      tier,
      color: WHEEL_COLORS[index % WHEEL_COLORS.length],
      start,
      end: start + degrees,
      center: start + degrees / 2,
    }
    start += degrees
    return segment
  })
  return segments
}

function buildWheelGradient(tiers: RewardTier[]) {
  const segments = buildRewardSegments(tiers)
  return `conic-gradient(from 180deg, ${segments.map((segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`).join(', ')})`
}

function getRewardRotation(tiers: RewardTier[], tierId: string, currentRotation: number) {
  const segments = buildRewardSegments(tiers)
  const segment = segments.find((entry) => entry.tier.id === tierId)
  if (!segment) return currentRotation + 1440
  const pointerAngle = 90
  const center = 180 + segment.center
  const target = pointerAngle - center
  const normalizedCurrent = ((currentRotation % 360) + 360) % 360
  let delta = target - normalizedCurrent
  while (delta < 0) delta += 360
  return currentRotation + 1440 + delta
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
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
  summary,
  expanded,
}: {
  rows: LeaderboardRow[]
  wallet: string | null
  summary: WalletSummaryData | null
  expanded: boolean
}) {
  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE_HOLDERS)
  const myRow = wallet ? rows.find((row) => row.wallet === wallet) || null : null
  const myProbability = myRow ? percentOfGravity(myRow, rows.slice(0, 12)) : 0

  return (
    <div className="gravity-dashboard-card cosmic-dashboard-card">
      <div className="gravity-dashboard-header">
        <div>
          <div className="market-card-label">Gravity Dashboard</div>
          <h3>Live holder leaderboard</h3>
        </div>
        <div className="gravity-wallet-state">
          {wallet ? <code>{shortWallet(wallet)}</code> : <span>Not connected</span>}
        </div>
      </div>

      <div className="wallet-summary-grid">
        <div className="wallet-summary-card"><div className="market-card-label">Your Gravity</div><div className="wallet-summary-value">{fmtPoints(summary?.totalEarned || 0)}</div><p>{myRow ? `Rank #${myRow.rank}` : wallet ? 'Wallet connected, but not yet on the gravity board.' : 'Connect Phantom to load your wheel account.'}</p></div>
        <div className="wallet-summary-card"><div className="market-card-label">Wheel Spendable</div><div className="wallet-summary-value">{fmtPoints(summary?.spendable || 0)}</div><p>{summary ? `Each spin costs ${fmtPoints(summary.wheelSpendAmount)} gravity.` : 'Connect wallet to load spendable gravity.'}</p></div>
        <div className="wallet-summary-card"><div className="market-card-label">Total Spent</div><div className="wallet-summary-value">{fmtPoints(summary?.totalSpent || 0)}</div><p>Real spend ledger from wheel spins.</p></div>
        <div className="wallet-summary-card"><div className="market-card-label">Available to Claim</div><div className="wallet-summary-value">{summary ? `${fmtPoints(summary.claimableAmount)} ${summary.rewardToken}` : '0'}</div><p>{summary ? `${summary.pendingClaims} pending claim${summary.pendingClaims === 1 ? '' : 's'}.` : 'Connect wallet to load claimable rewards.'}</p></div>
      </div>

      <div className="gravity-dashboard-subline">
        <span>{wallet && myRow ? `Your top-holder share is ${fmtProbability(myProbability)}. Wheel rewards now come from a signed spend flow, not fake local randomness.` : 'Connect your wallet to see real spendable gravity and claimable reward state.'}</span>
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

function RewardWheelModal({
  tiers,
  summary,
  state,
}: {
  tiers: RewardTier[]
  summary: WalletSummaryData | null
  state: WheelState
}) {
  const gradient = buildWheelGradient(tiers)
  return (
    <div className="wheel-modal-backdrop" id="wheel-backdrop">
      <div className="wheel-modal cosmic-wheel-modal" role="dialog" aria-modal="true" aria-labelledby="wheel-title">
        <div className="cosmic-stars" />
        <button className="wheel-close" id="wheel-close-btn" aria-label="Close">×</button>
        <div className="wheel-modal-copy">
          <div className="section-label">Treasury reward wheel</div>
          <h3 id="wheel-title">Spend gravity. Spin for treasury reward.</h3>
          <p>Every spin uses a signed Phantom challenge, spends real gravity, and returns a treasury reward tier recorded in the backend ledger.</p>
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
          <button className="btn-hero" id="spin-wheel-btn" disabled={state.spinning || !summary || summary.spendable < (summary?.wheelSpendAmount || 0)}>{state.spinning ? 'Signing + spinning…' : `Spin for ${fmtPoints(summary?.wheelSpendAmount || 0)} gravity`}</button>
          <button className="wheel-secondary-btn" id="close-wheel-btn">Close</button>
        </div>
        {state.error ? <div className="wheel-result cosmic-result"><div className="market-card-label">Spin error</div><p>{state.error}</p></div> : null}
        {state.rewardTierId ? <div className="wheel-result cosmic-result"><div className="market-card-label">Reward unlocked</div><div className="wheel-result-wallet"><code>{state.rewardTierId.toUpperCase()}</code></div><p>Reward tier: {rewardPctLabel(state.rewardBps)} of treasury</p><p>Recorded reward: {fmtPoints(state.rewardAmount)} {state.rewardToken}</p><p>Tier probability: {fmtProbability(state.rewardProbability)}</p></div> : null}
        <div className="wheel-legend">
          {tiers.map((tier, index) => <div className="wheel-legend-row" key={tier.id}><span className="wheel-color" style={{ background: WHEEL_COLORS[index % WHEEL_COLORS.length] }} /><code>{tier.id}</code><span>{rewardPctLabel(tier.rewardBps)} treasury</span><span>{fmtProbability(tier.probability * 100)}</span></div>)}
        </div>
      </div>
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
  let walletSummary: WalletSummaryData | null = null
  let walletLoading = false
  let heroExpanded = false
  let wheelState: WheelState = { open: false, spinning: false, rotationDeg: 0, rewardTierId: null, rewardProbability: 0, rewardBps: 0, rewardAmount: 0, rewardToken: '', error: null }

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

  const fetchWalletSummary = async (wallet: string) => {
    walletLoading = true
    renderAll()
    try {
      const res = await fetch(`/api/wheel/me?wallet=${encodeURIComponent(wallet)}`)
      walletSummary = await res.json()
    } catch {
      walletSummary = null
    } finally {
      walletLoading = false
      renderAll()
    }
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
      await fetchWalletSummary(connectedWallet)
    } catch {}
  }

  const spinRealWheel = async () => {
    const provider = window.solana
    if (!provider?.isPhantom || !provider.signMessage || !connectedWallet) {
      wheelState = { ...wheelState, error: 'Connect Phantom first.' }
      renderAll()
      return
    }
    if (!walletSummary) {
      wheelState = { ...wheelState, error: 'Wallet summary unavailable.' }
      renderAll()
      return
    }
    if (walletSummary.spendable < walletSummary.wheelSpendAmount) {
      wheelState = { ...wheelState, error: `Not enough spendable gravity. Need ${fmtPoints(walletSummary.wheelSpendAmount)}.` }
      renderAll()
      return
    }

    try {
      wheelState = { ...wheelState, spinning: true, rewardTierId: null, rewardProbability: 0, rewardBps: 0, rewardAmount: 0, rewardToken: '', error: null }
      renderAll()

      const challengeRes = await fetch('/api/wheel/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: connectedWallet }),
      })
      const challenge = await challengeRes.json()
      if (!challengeRes.ok || !challenge.ok) throw new Error(challenge.error || 'Failed to create wheel challenge')

      const signed = await provider.signMessage(encoder.encode(challenge.message), 'utf8')
      const signature = bytesToBase64(signed.signature)

      const spinRes = await fetch('/api/wheel/spin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: connectedWallet, challengeId: challenge.challengeId, signature }),
      })
      const spin = await spinRes.json()
      if (!spinRes.ok || !spin.ok) throw new Error(spin.error || 'Failed to spin wheel')

      const tiers = walletSummary.rewardTiers || []
      const tier = tiers.find((entry) => entry.id === spin.reward.tier)
      wheelState = {
        ...wheelState,
        spinning: true,
        rotationDeg: getRewardRotation(tiers, spin.reward.tier, wheelState.rotationDeg),
        rewardTierId: null,
        rewardProbability: 0,
        rewardBps: 0,
        rewardAmount: 0,
        rewardToken: spin.reward.token,
        error: null,
      }
      renderAll()

      setTimeout(async () => {
        wheelState = {
          ...wheelState,
          spinning: false,
          rewardTierId: spin.reward.tier,
          rewardProbability: (tier?.probability || 0) * 100,
          rewardBps: spin.reward.rewardBps,
          rewardAmount: spin.reward.rewardAmount,
          rewardToken: spin.reward.token,
          error: null,
        }
        renderAll()
        if (connectedWallet) await fetchWalletSummary(connectedWallet)
      }, 5600)
    } catch (error: any) {
      wheelState = { ...wheelState, spinning: false, error: error?.message || 'Spin failed' }
      renderAll()
    }
  }

  const renderAll = () => {
    if (marketRoot) render(<MarketPanel data={marketData} loading={marketLoading} />, marketRoot)
    if (heroRoot) {
      if (gravityLoading) {
        render(<div className="market-loading">Loading gravity dashboard…</div>, heroRoot)
      } else if (gravityData?.leaderboard?.length) {
        render(<GravityHeroPanel rows={gravityData.leaderboard} wallet={connectedWallet} summary={walletSummary} expanded={heroExpanded} />, heroRoot)
        const toggle = document.getElementById('toggle-hero-holders-btn') as HTMLButtonElement | null
        if (toggle) toggle.onclick = () => { heroExpanded = !heroExpanded; renderAll() }
      } else {
        render(<div className="market-loading">Gravity dashboard unavailable right now.</div>, heroRoot)
      }
    }

    const heroConnect = document.getElementById('hero-connect-wallet-btn') as HTMLButtonElement | null
    if (heroConnect) heroConnect.onclick = connectWallet
    if (heroConnect) heroConnect.textContent = connectedWallet ? (walletLoading ? 'Refreshing wallet…' : 'Wallet Connected') : 'Connect Phantom'

    const heroSpin = document.getElementById('hero-spin-wheel-btn') as HTMLButtonElement | null
    if (heroSpin) heroSpin.onclick = () => { wheelState = { ...wheelState, open: true, error: null }; renderAll() }

    if (wheelModalMount) {
      const tiers = walletSummary?.rewardTiers || [
        { id: 'dust', probability: 0.45, rewardBps: 5 },
        { id: 'small', probability: 0.28, rewardBps: 10 },
        { id: 'medium', probability: 0.15, rewardBps: 25 },
        { id: 'large', probability: 0.08, rewardBps: 50 },
        { id: 'mega', probability: 0.03, rewardBps: 100 },
        { id: 'cosmic', probability: 0.01, rewardBps: 250 },
      ]
      if (wheelState.open) {
        const closeWheel = () => {
          if (wheelState.spinning) return
          wheelState = { ...wheelState, open: false }
          renderAll()
        }
        render(<RewardWheelModal tiers={tiers} summary={walletSummary} state={wheelState} />, wheelModalMount)
        for (const id of ['wheel-close-btn', 'close-wheel-btn']) {
          const btn = document.getElementById(id) as HTMLButtonElement | null
          if (btn) btn.onclick = closeWheel
        }
        const backdrop = document.getElementById('wheel-backdrop')
        if (backdrop) backdrop.onclick = (event) => { if (event.target === backdrop) closeWheel() }
        const spinBtn = document.getElementById('spin-wheel-btn') as HTMLButtonElement | null
        if (spinBtn) spinBtn.onclick = spinRealWheel
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
