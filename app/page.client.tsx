import { render } from 'melina/client'
import type { HeroAction, HeroVariant, LandingExperiment } from '../lib/experiments'

type PhantomProvider = {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>
  disconnect: () => Promise<void>
  signMessage?: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature?: Uint8Array } | Uint8Array>
}

declare global {
  interface Window {
    solana?: PhantomProvider
    phantom?: { solana?: PhantomProvider }
  }
}

type MarketData = {
  ok: boolean
  token?: { address: string; symbol: string; name: string }
  pair?: {
    dexId: string; pairAddress: string; url: string; priceUsd: number; priceNative: number
    fdv: number; marketCap: number; liquidityUsd: number; volume24h: number
    buys24h: number; sells24h: number; changeM5: number; changeH1: number; changeH6: number; changeH24: number
  }
  capturedAt?: number
  source?: 'live' | 'cache' | 'stale-cache'
  stale?: boolean
  error?: string
}

type LeaderboardRow = {
  rank: number; wallet: string; walletShort: string; walletLabel?: string | null; walletDisplay?: string; walletType?: string
  points: number; stardust: number; remainingGravity: number; totalSpent: number
  streakMinutes: number; balance: number; usdPerMinute: number; lastCreditedAt: number
}

type LeaderboardData = {
  leaderboard?: LeaderboardRow[]
  stats?: {
    totalHolders: number; totalPoints: number; totalStardust: number
    totalRemainingGravity: number; lastUpdated: number; activeScoredHolders: number
  }
  priceUsd?: number; scoringRule?: string
}

type RewardTier = { id: string; probability: number; rewardBps: number }

type WalletSummaryData = {
  ok: boolean; wallet: string; totalEarned: number; totalSpent: number
  spendable: number; stardust: number; gravityShare: number; totalRemainingGravity: number
  pendingClaims: number; claimableAmount: number; requestedClaims: number; requestedAmount: number
  minGravityToSpin: number; rewardToken: string; rewardTiers: RewardTier[]
  latestSpin?: { id: string; tierId: string; rewardAmount: number; gravityShare: number; createdAt: number } | null
  latestClaimRequest?: { id: string; amount: number; token: string; claimCount: number; status: string; processedAt: number | null; createdAt: number } | null
  error?: string
}

type SpinRow = {
  id: string; wallet: string; walletShort?: string; walletLabel?: string | null
  tierId: string; rewardBps: number; rewardAmount: number; treasuryAmountAtSpin: number
  status: string; createdAt: number
}

type SpinsData = { ok: boolean; spins?: SpinRow[]; spin?: SpinRow | null; error?: string }

type ClaimRow = {
  id: string; spinId: string; wallet: string; walletShort?: string; walletLabel?: string | null
  amount: number; token: string; status: string; txSignature: string | null
  requestId: string | null; requestedAt: number | null; createdAt: number; updatedAt: number
  tierId: string | null; rewardBps: number | null
}

type ClaimsData = { ok: boolean; claims?: ClaimRow[]; error?: string }

type WheelState = {
  open: boolean; spinning: boolean; rotationDeg: number; rewardTierId: string | null
  rewardProbability: number; rewardBps: number; rewardAmount: number; rewardToken: string
  gravityBurned: number; stardustEarned: number; error: string | null
}

type LandingExperimentPayload = {
  heroCtaExperiment: LandingExperiment
  initial: { heroCtaVariant: HeroVariant }
}

const WHEEL_COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#22c55e', '#6366f1', '#ef4444', '#14b8a6']
const DEFAULT_VISIBLE_HOLDERS = 20
const encoder = new TextEncoder()

function getPhantomProvider(): PhantomProvider | null {
  const direct = window.solana
  if (direct?.isPhantom) return direct
  const nested = window.phantom?.solana
  if (nested?.isPhantom) return nested
  return null
}

function getSignedBytesSignature(signed: { signature?: Uint8Array } | Uint8Array | null | undefined) {
  if (!signed) throw new Error('Phantom returned an empty signature response.')
  if (signed instanceof Uint8Array) return signed
  if (signed.signature instanceof Uint8Array) return signed.signature
  throw new Error('Phantom returned a signature in an unexpected format.')
}

function readInitialJson<T>(id: string): T | null {
  const node = document.getElementById(id)
  const text = node?.textContent?.trim()
  if (!text || text === 'null') return null
  try { return JSON.parse(text) as T } catch { return null }
}

function readCookie(name: string) {
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length))
  }
  return null
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
}

function getValidVariantId(experiment: LandingExperiment, value: string | null | undefined) {
  return value && experiment.variants[value] ? value : null
}

function resolveExperimentVariant(experiment: LandingExperiment) {
  const url = new URL(window.location.href)
  const queryChoice = getValidVariantId(experiment, url.searchParams.get(experiment.queryParam))
  const cookieChoice = getValidVariantId(experiment, readCookie(experiment.cookieName))
  const storageChoice = getValidVariantId(experiment, window.localStorage.getItem(experiment.storageKey))
  const variantId = queryChoice || cookieChoice || storageChoice || experiment.defaultVariant
  try { window.localStorage.setItem(experiment.storageKey, variantId) } catch {}
  writeCookie(experiment.cookieName, variantId)
  return experiment.variants[variantId] || experiment.variants[experiment.defaultVariant]
}

function applyHeroAction(button: HTMLButtonElement | null, action: HeroAction, label: string, extraClass = '') {
  if (!button) return
  button.textContent = label
  button.dataset.heroAction = action.type
  button.dataset.heroHref = action.type === 'link' ? action.href : ''
  if (extraClass) button.className = extraClass
}

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(6)}`
}
function fmtMarketPct(n: number) { return `${n > 0 ? '+' : ''}${n.toFixed(2)}%` }
function fmtProbability(n: number) { return `${n.toFixed(2)}%` }
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
function fmtSol(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K SOL`
  if (n >= 1) return `${n.toFixed(4)} SOL`
  if (n >= 0.0001) return `${n.toFixed(6)} SOL`
  return `${n.toFixed(8)} SOL`
}
function shortWallet(wallet: string | null) { return wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-6)}` : null }
function rewardPctLabel(rewardBps: number) { return `${(rewardBps / 100).toFixed(2)}%` }
function bytesToBase64(bytes: Uint8Array) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary) }

function buildRewardSegments(tiers: RewardTier[]) {
  let start = 0
  return tiers.map((tier, index) => {
    const degrees = tier.probability * 180
    const segment = { tier, color: WHEEL_COLORS[index % WHEEL_COLORS.length], start, end: start + degrees, center: start + degrees / 2 }
    start += degrees
    return segment
  })
}
function buildWheelGradient(tiers: RewardTier[]) {
  const segments = buildRewardSegments(tiers)
  return `conic-gradient(from 180deg, ${segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(', ')})`
}
function getRewardRotation(tiers: RewardTier[], tierId: string, currentRotation: number) {
  const segment = buildRewardSegments(tiers).find((entry) => entry.tier.id === tierId)
  if (!segment) return currentRotation + 1440
  const pointerAngle = 90
  const center = 180 + segment.center
  const target = pointerAngle - center
  const normalizedCurrent = ((currentRotation % 360) + 360) % 360
  let delta = target - normalizedCurrent
  while (delta < 0) delta += 360
  return currentRotation + 1440 + delta
}

function buildSpinShareText(spin: SpinRow) {
  const wallet = spin.walletLabel || spin.walletShort || shortWallet(spin.wallet) || 'a GKSY holder'
  return `🎰 I just hit ${spin.tierId.toUpperCase()} on Geeksy's gravity wheel! ${wallet} burned gravity into stardust and won ${fmtSol(spin.rewardAmount)} from the treasury.\n\nHold GKSY → earn gravity → spin for SOL. #Geeksy #GKSY`
}

function MarketStatusHint({ data }: { data: MarketData }) {
  if (!data.stale && data.source !== 'cache') return null
  const captured = data.capturedAt ? new Date(data.capturedAt).toLocaleString() : null
  return <div className="market-status-note" role="status">
    <strong>{data.stale ? 'Cached market snapshot' : 'Warm market cache'}</strong>
    <span>{data.stale
      ? `Dexscreener refresh failed, so this section is showing the last cached snapshot${captured ? ` from ${captured}` : ''}.`
      : `Serving the latest cached market snapshot${captured ? ` from ${captured}` : ''} while fresh data warms.`}</span>
  </div>
}

function MarketPanel({ data, loading }: { data: MarketData | null; loading: boolean }) {
  if (loading) return <div className="market-loading">Loading live token data…</div>
  if (!data?.ok || !data.pair || !data.token) return <div className="market-loading">{data?.error || 'Market data unavailable right now.'}</div>
  const p = data.pair
  return <><MarketStatusHint data={data} /><div className="market-grid">
    <div className="market-card market-card-primary"><div className="market-card-label">Token</div><div className="market-token-row"><div><h3>{data.token.name} ({data.token.symbol})</h3><p className="market-muted">{data.token.address}</p></div><a href={p.url} target="_blank" rel="noopener" className="btn-primary">View on Dexscreener</a></div></div>
    <div className="market-card"><div className="market-card-label">Price</div><div className="market-big">{fmtUsd(p.priceUsd)}</div><div className={`market-change ${p.changeH24 >= 0 ? 'pos' : 'neg'}`}>24h {fmtMarketPct(p.changeH24)}</div></div>
    <div className="market-card"><div className="market-card-label">Liquidity</div><div className="market-big">{fmtUsd(p.liquidityUsd)}</div><div className="market-muted">DEX: {p.dexId}</div></div>
    <div className="market-card"><div className="market-card-label">FDV</div><div className="market-big">{fmtUsd(p.fdv)}</div><div className="market-muted">Market cap {fmtUsd(p.marketCap)}</div></div>
    <div className="market-card"><div className="market-card-label">24h Volume</div><div className="market-big">{fmtUsd(p.volume24h)}</div><div className="market-muted">Buys {p.buys24h} · Sells {p.sells24h}</div></div>
    <div className="market-card"><div className="market-card-label">Momentum</div><div className="market-mini-grid"><span className={p.changeM5 >= 0 ? 'pos' : 'neg'}>5m {fmtMarketPct(p.changeM5)}</span><span className={p.changeH1 >= 0 ? 'pos' : 'neg'}>1h {fmtMarketPct(p.changeH1)}</span><span className={p.changeH6 >= 0 ? 'pos' : 'neg'}>6h {fmtMarketPct(p.changeH6)}</span><span className={p.changeH24 >= 0 ? 'pos' : 'neg'}>24h {fmtMarketPct(p.changeH24)}</span></div></div>
  </div></>
}

function SpinsPanel({ title, spins, empty }: { title: string; spins: SpinRow[]; empty: string }) {
  return <div className="spins-card">
    <div className="spins-card-header"><div className="market-card-label">Spin History</div><h4>{title}</h4></div>
    {!spins.length ? <p className="spins-empty">{empty}</p> : <div className="spins-list">{spins.map((spin) => <div className="spin-row" key={spin.id}><div><div className="spin-tier">{spin.tierId.toUpperCase()}</div><div className="spin-meta">{spin.walletLabel || spin.walletShort || shortWallet(spin.wallet)} · {new Date(spin.createdAt).toLocaleString()}</div></div><div className="spin-reward"><strong>{fmtSol(spin.rewardAmount)}</strong><span>{rewardPctLabel(spin.rewardBps)} treasury</span></div></div>)}</div>}
  </div>
}

function ClaimsPanel({ claims, wallet, loading, onClaim, claimSubmitting, summary }: {
  claims: ClaimRow[]; wallet: string | null; loading: boolean
  onClaim: () => void; claimSubmitting: boolean; summary: WalletSummaryData | null
}) {
  const hasPending = summary && summary.pendingClaims > 0 && summary.claimableAmount > 0
  return <div className="spins-card claims-card">
    <div className="spins-card-header"><div className="market-card-label">SOL Rewards</div><h4>Your Claims</h4></div>
    {hasPending ? <div className="claim-action-bar">
      <div className="claim-action-info"><strong>{fmtSol(summary!.claimableAmount)}</strong> available to withdraw<span className="claim-action-sub">{summary!.pendingClaims} spin reward{summary!.pendingClaims === 1 ? '' : 's'} ready</span></div>
      <button className="btn-hero btn-claim" onClick={onClaim} disabled={claimSubmitting}>{claimSubmitting ? 'Signing claim…' : `Withdraw ${fmtSol(summary!.claimableAmount)}`}</button>
    </div> : null}
    {loading ? <p className="spins-empty">Loading claim history…</p> : !wallet ? <p className="spins-empty">Connect Phantom to see your rewards.</p> : !claims.length ? <p className="spins-empty">No claims yet. Spin the wheel to win SOL.</p> : <div className="spins-list">{claims.map((claim) => <div className="spin-row" key={claim.id}><div><div className="spin-tier">{claim.tierId ? claim.tierId.toUpperCase() : 'CLAIM'}</div><div className="spin-meta">{new Date((claim.requestedAt || claim.createdAt)).toLocaleString()} · {claim.status}</div></div><div className="spin-reward"><strong>{fmtSol(claim.amount)}</strong><span>{claim.status === 'claimed' && claim.txSignature ? '✓ Sent' : claim.status}</span></div></div>)}</div>}
  </div>
}

function entityBadgeLabel(type?: string) {
  switch (type) {
    case 'treasury': return 'Treasury'
    case 'lp': return 'LP'
    case 'bonding_curve': return 'Bonding Curve'
    case 'exchange': return 'Exchange'
    case 'team': return 'Team'
    case 'internal': return 'Internal'
    default: return 'Holder'
  }
}

function GravityHeroPanel({ rows, wallet, summary, recentSpins, mySpins, claims, claimsLoading, claimSubmitting, expanded, onClaim }: {
  rows: LeaderboardRow[]; wallet: string | null; summary: WalletSummaryData | null
  recentSpins: SpinRow[]; mySpins: SpinRow[]; claims: ClaimRow[]
  claimsLoading: boolean; claimSubmitting: boolean; expanded: boolean; onClaim: () => void
}) {
  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE_HOLDERS)
  const myRow = wallet ? rows.find((row) => row.wallet === wallet) || null : null
  const totalStardust = rows.reduce((sum, r) => sum + r.stardust, 0)
  const totalGravity = rows.reduce((sum, r) => sum + r.remainingGravity, 0)

  return <div className="gravity-dashboard-card cosmic-dashboard-card">
    <div className="gravity-dashboard-header">
      <div><div className="market-card-label">Cosmic Leaderboard</div><h3>Stardust &amp; Gravity</h3></div>
      <div className="gravity-wallet-state">{wallet ? <code>{myRow?.walletLabel || shortWallet(wallet)}</code> : <span>Not connected</span>}</div>
    </div>

    {/* Global totals */}
    <div className="wallet-summary-grid wallet-summary-grid-4">
      <div className="wallet-summary-card summary-stardust"><div className="market-card-label">✦ Total Stardust</div><div className="wallet-summary-value stardust-value">{fmtPoints(totalStardust)}</div><p>Lifetime gravity burned by all holders.</p></div>
      <div className="wallet-summary-card summary-gravity"><div className="market-card-label">⬡ Total Gravity</div><div className="wallet-summary-value gravity-value">{fmtPoints(totalGravity)}</div><p>Remaining gravity across all holders.</p></div>
      <div className="wallet-summary-card"><div className="market-card-label">Your Gravity Share</div><div className="wallet-summary-value">{summary ? fmtProbability(summary.gravityShare * 100) : '—'}</div><p>{summary ? 'Your gravity vs all holders. Higher = better spin odds.' : 'Connect wallet to see your share.'}</p></div>
      <div className="wallet-summary-card"><div className="market-card-label">Your Stardust</div><div className="wallet-summary-value stardust-value">✦ {fmtPoints(summary?.stardust || 0)}</div><p>{summary ? `Rank by stardust on the leaderboard.` : 'Connect wallet to see stardust.'}</p></div>
    </div>

    <div className="gravity-dashboard-subline">
      <span>{wallet && myRow ? `You have ${fmtPoints(summary?.spendable || myRow.remainingGravity)} gravity available to burn.` : 'Connect Phantom to see your gravity and spin the wheel.'}</span>
      <button className="wheel-secondary-btn" id="toggle-hero-holders-btn">{expanded ? 'Show Top 20' : `Show All (${rows.length})`}</button>
    </div>

    {/* Spin history */}
    <div className="spins-grid">
      <SpinsPanel title="Recent Spins" spins={recentSpins} empty="No wheel activity yet." />
      <SpinsPanel title="Your Spins" spins={mySpins} empty={wallet ? 'You have not spun yet.' : 'Connect Phantom to see your spins.'} />
    </div>

    {/* Claims */}
    <ClaimsPanel claims={claims} wallet={wallet} loading={claimsLoading} onClaim={onClaim} claimSubmitting={claimSubmitting} summary={summary} />

    {/* Leaderboard table — sorted by stardust */}
    <div className="gravity-hero-table-wrap">
      <table className="holders-table gravity-hero-table">
        <thead><tr><th>#</th><th>Wallet</th><th>✦ Stardust</th><th>⬡ Gravity</th><th>Balance</th><th>$/min</th></tr></thead>
        <tbody>{visibleRows.map((row) => <tr key={row.wallet} className={wallet === row.wallet ? 'active-wallet-row' : ''}>
          <td>{row.rank}</td>
          <td>
            <div className="wallet-entity-cell">
              <div className="wallet-entity-top">
                <strong>{row.walletDisplay || row.walletLabel || row.walletShort}</strong>
                <span className={`wallet-entity-badge wallet-entity-${row.walletType || 'holder'}`}>{entityBadgeLabel(row.walletType)}</span>
              </div>
              <code className="wallet-entity-address">{row.walletShort}</code>
            </div>
          </td>
          <td className="stardust-cell">{fmtPoints(row.stardust)}</td>
          <td className="gravity-cell">{fmtPoints(row.remainingGravity)}</td>
          <td>{fmtTokenAmount(row.balance)}</td>
          <td>{fmtUsd(row.usdPerMinute)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>
}

function RewardWheelModal({ tiers, summary, state }: { tiers: RewardTier[]; summary: WalletSummaryData | null; state: WheelState }) {
  const gradient = buildWheelGradient(tiers)
  const canSpin = !state.spinning && summary && summary.spendable >= (summary?.minGravityToSpin || 1)
  return <div className="wheel-modal-backdrop" id="wheel-backdrop"><div className="wheel-modal cosmic-wheel-modal" role="dialog" aria-modal="true" aria-labelledby="wheel-title"><div className="cosmic-stars" /><button className="wheel-close" id="wheel-close-btn" aria-label="Close">×</button>
    <div className="wheel-modal-copy"><div className="section-label">Spin for SOL</div><h3 id="wheel-title">Burn all gravity. Win SOL.</h3><p>Signing this message burns <strong>all {fmtPoints(summary?.spendable || 0)} gravity</strong> into stardust. Your gravity share ({summary ? fmtProbability(summary.gravityShare * 100) : '0%'}) influences your odds of hitting higher tiers.</p></div>
    <div className="wheel-stage cosmic-wheel-stage"><div className="wheel-orbit-ring orbit-ring-1" /><div className="wheel-orbit-ring orbit-ring-2" /><div className="wheel-pointer" /><div className="wheel-half-mask cosmic-wheel-mask"><div className="wheel-glow" /><div className="wheel-disc cosmic-wheel-disc" style={{ background: gradient, transform: `rotate(${state.rotationDeg}deg)`, transition: state.spinning ? 'transform 5.4s cubic-bezier(0.12, 0.8, 0.12, 1)' : 'transform 0.3s ease' }} /></div></div>
    <div className="wheel-actions"><button className="btn-hero" id="spin-wheel-btn" disabled={!canSpin || state.spinning}>{state.spinning ? 'Burning gravity…' : `Burn ${fmtPoints(summary?.spendable || 0)} gravity & spin`}</button><button className="wheel-secondary-btn" id="close-wheel-btn">Close</button></div>
    {state.error ? <div className="wheel-result cosmic-result"><div className="market-card-label">Error</div><p>{state.error}</p></div> : null}
    {state.rewardTierId ? <div className="wheel-result cosmic-result wheel-result-win">
      <div className="market-card-label">🎉 You won SOL!</div>
      <div className="wheel-result-wallet"><code>{state.rewardTierId.toUpperCase()}</code></div>
      <p className="wheel-result-sol">{fmtSol(state.rewardAmount)}</p>
      <p>{rewardPctLabel(state.rewardBps)} of treasury · {fmtProbability(state.rewardProbability)} base chance</p>
      <div className="wheel-result-stardust"><p>✦ {fmtPoints(state.gravityBurned)} gravity burned → stardust</p></div>
    </div> : null}
    <div className="wheel-legend">{tiers.map((tier, index) => <div className="wheel-legend-row" key={tier.id}><span className="wheel-color" style={{ background: WHEEL_COLORS[index % WHEEL_COLORS.length] }} /><code>{tier.id}</code><span>{rewardPctLabel(tier.rewardBps)} treasury</span><span>{fmtProbability(tier.probability * 100)}</span></div>)}</div>
  </div></div>
}

export default function mount() {
  const cleanups: Array<() => void> = []
  const experimentPayload = readInitialJson<LandingExperimentPayload>('landing-experiments-data')
  const heroExperiment = experimentPayload?.heroCtaExperiment || null
  let activeHeroVariant = experimentPayload?.initial.heroCtaVariant || null
  let marketData: MarketData | null = readInitialJson<MarketData>('ssr-market-data')
  let marketLoading = !marketData?.ok
  let gravityData: LeaderboardData | null = readInitialJson<LeaderboardData>('ssr-gravity-data')
  let gravityLoading = !(gravityData?.leaderboard?.length)
  let connectedWallet: string | null = null
  let walletSummary: WalletSummaryData | null = null
  let walletLoading = false
  let recentSpins: SpinRow[] = []
  let mySpins: SpinRow[] = []
  let claimHistory: ClaimRow[] = []
  let claimsLoading = false
  let claimSubmitting = false
  let heroExpanded = false
  let wheelState: WheelState = { open: false, spinning: false, rotationDeg: 0, rewardTierId: null, rewardProbability: 0, rewardBps: 0, rewardAmount: 0, rewardToken: 'SOL', gravityBurned: 0, stardustEarned: 0, error: null }

  const marketRoot = document.getElementById('market-root')
  const heroRoot = document.getElementById('gravity-hero-root')

  let wheelModalMount = document.getElementById('wheel-modal-mount')
  if (!wheelModalMount) {
    wheelModalMount = document.createElement('div')
    wheelModalMount.id = 'wheel-modal-mount'
    document.body.appendChild(wheelModalMount)
    cleanups.push(() => wheelModalMount?.remove())
  }

  if (heroExperiment) activeHeroVariant = resolveExperimentVariant(heroExperiment)

  const fetchSpins = async (wallet?: string | null) => {
    try {
      const recentRes = await fetch('/api/wheel/spins?limit=8')
      const recentJson = await recentRes.json() as SpinsData
      recentSpins = recentJson.spins || []
      if (wallet) {
        const myRes = await fetch(`/api/wheel/spins?wallet=${encodeURIComponent(wallet)}&limit=8`)
        const myJson = await myRes.json() as SpinsData
        mySpins = myJson.spins || []
      } else { mySpins = [] }
    } catch { recentSpins = []; mySpins = [] }
    finally { renderAll() }
  }

  const fetchClaims = async (wallet?: string | null) => {
    if (!wallet) { claimHistory = []; claimsLoading = false; renderAll(); return }
    claimsLoading = true; renderAll()
    try {
      const res = await fetch(`/api/wheel/claims?wallet=${encodeURIComponent(wallet)}&limit=8`)
      const json = await res.json() as ClaimsData
      claimHistory = json.claims || []
    } catch { claimHistory = [] }
    finally { claimsLoading = false; renderAll() }
  }

  const fetchWalletSummary = async (wallet: string) => {
    walletLoading = true; renderAll()
    try {
      const res = await fetch(`/api/wheel/me?wallet=${encodeURIComponent(wallet)}`)
      walletSummary = await res.json()
    } catch { walletSummary = null }
    finally {
      walletLoading = false
      await fetchSpins(wallet)
      await fetchClaims(wallet)
      renderAll()
    }
  }

  const connectWallet = async (onlyIfTrusted = false) => {
    const provider = getPhantomProvider()
    if (!provider?.isPhantom) {
      if (!onlyIfTrusted) {
        wheelState = { ...wheelState, error: 'Phantom wallet was not detected in this browser.' }
        renderAll()
        window.open('https://phantom.app/', '_blank', 'noopener')
      }
      return
    }
    try {
      const result = await provider.connect(onlyIfTrusted ? { onlyIfTrusted: true } : undefined)
      connectedWallet = result.publicKey.toString()
      wheelState = { ...wheelState, error: null }
      renderAll()
      await fetchWalletSummary(connectedWallet)
    } catch (error: any) {
      if (!onlyIfTrusted) {
        wheelState = { ...wheelState, error: error?.message || 'Phantom connection failed.' }
        renderAll()
      }
    }
  }

  const requestClaim = async () => {
    const provider = getPhantomProvider()
    if (!provider?.isPhantom || !provider.signMessage || !connectedWallet) {
      wheelState = { ...wheelState, error: 'Connect Phantom first.' }; renderAll(); return
    }
    if (!walletSummary?.pendingClaims || walletSummary.claimableAmount <= 0) {
      wheelState = { ...wheelState, error: 'No pending SOL to claim.' }; renderAll(); return
    }
    try {
      claimSubmitting = true; renderAll()
      const challengeRes = await fetch('/api/wheel/claim/challenge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet }) })
      const challenge = await challengeRes.json()
      if (!challengeRes.ok || !challenge.ok) throw new Error(challenge.error || 'Failed to create claim challenge')
      const signed = await provider.signMessage(encoder.encode(challenge.message), 'utf8')
      const signature = bytesToBase64(getSignedBytesSignature(signed))
      const claimRes = await fetch('/api/wheel/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet, requestId: challenge.requestId, signature }) })
      const claim = await claimRes.json()
      if (!claimRes.ok || !claim.ok) throw new Error(claim.error || 'Failed to submit claim request')
      await fetchWalletSummary(connectedWallet)
    } catch (error: any) {
      wheelState = { ...wheelState, error: error?.message || 'Claim request failed' }; renderAll()
    } finally { claimSubmitting = false; renderAll() }
  }

  const spinRealWheel = async () => {
    const provider = getPhantomProvider()
    if (!provider?.isPhantom || !provider.signMessage || !connectedWallet) {
      wheelState = { ...wheelState, error: 'Connect Phantom first.' }; renderAll(); return
    }
    if (!walletSummary) {
      wheelState = { ...wheelState, error: 'Wallet summary unavailable.' }; renderAll(); return
    }
    if (walletSummary.spendable < walletSummary.minGravityToSpin) {
      wheelState = { ...wheelState, error: `Not enough gravity. Need at least ${fmtPoints(walletSummary.minGravityToSpin)}.` }; renderAll(); return
    }
    try {
      wheelState = { ...wheelState, spinning: true, rewardTierId: null, rewardProbability: 0, rewardBps: 0, rewardAmount: 0, rewardToken: 'SOL', gravityBurned: 0, stardustEarned: 0, error: null }
      renderAll()
      const challengeRes = await fetch('/api/wheel/challenge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet }) })
      const challenge = await challengeRes.json()
      if (!challengeRes.ok || !challenge.ok) throw new Error(challenge.error || 'Failed to create wheel challenge')
      const signed = await provider.signMessage(encoder.encode(challenge.message), 'utf8')
      const signature = bytesToBase64(getSignedBytesSignature(signed))
      const spinRes = await fetch('/api/wheel/spin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet, challengeId: challenge.challengeId, signature }) })
      const spin = await spinRes.json()
      if (!spinRes.ok || !spin.ok) throw new Error(spin.error || 'Failed to spin wheel')
      const tiers = walletSummary.rewardTiers || []
      const tier = tiers.find((entry) => entry.id === spin.reward.tier)
      wheelState = { ...wheelState, spinning: true, rotationDeg: getRewardRotation(tiers, spin.reward.tier, wheelState.rotationDeg), rewardTierId: null, error: null }
      renderAll()
      setTimeout(async () => {
        wheelState = {
          ...wheelState, spinning: false, rewardTierId: spin.reward.tier,
          rewardProbability: (tier?.probability || 0) * 100, rewardBps: spin.reward.rewardBps,
          rewardAmount: spin.reward.rewardAmount, rewardToken: 'SOL',
          gravityBurned: spin.spendAmount || spin.gravityBefore || 0,
          stardustEarned: spin.stardustEarned || spin.spendAmount || 0, error: null
        }
        renderAll()
        if (connectedWallet) await fetchWalletSummary(connectedWallet)
        else await fetchSpins()
      }, 5600)
    } catch (error: any) {
      wheelState = { ...wheelState, spinning: false, error: error?.message || 'Spin failed' }; renderAll()
    }
  }

  const updateHeroStats = () => {
    const gravityEl = document.getElementById('hero-gravity-val')
    const stardustEl = document.getElementById('hero-stardust-val')
    const claimableEl = document.getElementById('hero-claimable-val')
    if (gravityEl) gravityEl.textContent = walletSummary ? fmtPoints(walletSummary.spendable) : '—'
    if (stardustEl) stardustEl.textContent = walletSummary ? fmtPoints(walletSummary.stardust) : '—'
    if (claimableEl) claimableEl.textContent = walletSummary ? fmtSol(walletSummary.claimableAmount) : '—'
  }

  const applyHeroVariant = () => {
    if (!activeHeroVariant) return
    const badge = document.getElementById('hero-badge')
    const title = document.getElementById('hero-title')
    const accent = document.getElementById('hero-title-accent')
    const subheadline = document.getElementById('hero-subheadline')
    const navCta = document.getElementById('nav-primary-cta') as HTMLAnchorElement | null
    const connectBtn = document.getElementById('hero-connect-wallet-btn') as HTMLButtonElement | null
    const spinBtn = document.getElementById('hero-spin-wheel-btn') as HTMLButtonElement | null

    if (badge) badge.textContent = activeHeroVariant.badge
    if (title) {
      title.childNodes[0] && (title.childNodes[0].textContent = activeHeroVariant.title)
    }
    if (accent) accent.textContent = activeHeroVariant.titleAccent
    if (subheadline) subheadline.textContent = activeHeroVariant.subheadline
    if (navCta) {
      navCta.textContent = activeHeroVariant.navCta.label
      navCta.href = activeHeroVariant.navCta.href
    }

    applyHeroAction(connectBtn, activeHeroVariant.primaryCta.action, activeHeroVariant.primaryCta.label, 'btn-hero')
    applyHeroAction(spinBtn, activeHeroVariant.secondaryCta.action, activeHeroVariant.secondaryCta.label, 'btn-hero btn-spin-hero')
    document.documentElement.dataset.heroExperimentVariant = activeHeroVariant.id
  }

  const renderAll = () => {
    updateHeroStats()
    applyHeroVariant()

    if (marketRoot) render(<MarketPanel data={marketData} loading={marketLoading} />, marketRoot)

    if (heroRoot) {
      if (gravityLoading) render(<div className="market-loading">Loading gravity dashboard…</div>, heroRoot)
      else if (gravityData?.leaderboard?.length) {
        render(<GravityHeroPanel rows={gravityData.leaderboard} wallet={connectedWallet} summary={walletSummary}
          recentSpins={recentSpins} mySpins={mySpins} claims={claimHistory} claimsLoading={claimsLoading}
          claimSubmitting={claimSubmitting} expanded={heroExpanded} onClaim={requestClaim} />, heroRoot)
        const toggle = document.getElementById('toggle-hero-holders-btn') as HTMLButtonElement | null
        if (toggle) toggle.onclick = () => { heroExpanded = !heroExpanded; renderAll() }
      } else render(<div className="market-loading">Gravity dashboard unavailable right now.</div>, heroRoot)
    }

    // Wire hero buttons
    const heroConnect = document.getElementById('hero-connect-wallet-btn') as HTMLButtonElement | null
    if (heroConnect) {
      const action = heroConnect.dataset.heroAction || 'connect'
      heroConnect.onclick = () => {
        if (action === 'spin') {
          wheelState = { ...wheelState, open: true, error: null }
          renderAll()
          return
        }
        if (action === 'link') {
          const href = heroConnect.dataset.heroHref || '#gravity-story'
          window.location.href = href
          return
        }
        void connectWallet()
      }
      if ((heroConnect.dataset.heroAction || 'connect') === 'connect' && connectedWallet) {
        heroConnect.textContent = walletLoading ? 'Refreshing…' : '✓ Connected'
      }
    }
    const heroSpin = document.getElementById('hero-spin-wheel-btn') as HTMLButtonElement | null
    if (heroSpin) {
      const action = heroSpin.dataset.heroAction || 'spin'
      heroSpin.onclick = () => {
        if (action === 'connect') {
          void connectWallet()
          return
        }
        if (action === 'link') {
          const href = heroSpin.dataset.heroHref || '#gravity-story'
          window.location.href = href
          return
        }
        wheelState = { ...wheelState, open: true, error: null }
        renderAll()
      }
    }

    // Wheel modal
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
        const closeWheel = () => { if (wheelState.spinning) return; wheelState = { ...wheelState, open: false }; renderAll() }
        render(<RewardWheelModal tiers={tiers} summary={walletSummary} state={wheelState} />, wheelModalMount)
        for (const id of ['wheel-close-btn', 'close-wheel-btn']) {
          const btn = document.getElementById(id) as HTMLButtonElement | null
          if (btn) btn.onclick = closeWheel
        }
        const backdrop = document.getElementById('wheel-backdrop')
        if (backdrop) backdrop.onclick = (event) => { if (event.target === backdrop) closeWheel() }
        const spinBtn = document.getElementById('spin-wheel-btn') as HTMLButtonElement | null
        if (spinBtn) spinBtn.onclick = spinRealWheel
      } else render(null, wheelModalMount)
    }
  }

  const fetchMarket = async () => {
    try { const res = await fetch('/api/market'); marketData = await res.json() }
    catch { marketData = { ok: false, error: 'Failed to fetch market data' } }
    finally { marketLoading = false; renderAll() }
  }
  const fetchGravity = async () => {
    try { const res = await fetch('/api/leaderboard?limit=200'); gravityData = await res.json() }
    catch { gravityData = null }
    finally { gravityLoading = false; renderAll() }
  }

  renderAll()
  fetchMarket()
  fetchGravity()
  fetchSpins()
  fetchClaims()
  connectWallet(true)

  const marketInterval = setInterval(fetchMarket, 30_000)
  const gravityInterval = setInterval(fetchGravity, 60_000)
  const spinsInterval = setInterval(() => fetchSpins(connectedWallet), 45_000)
  const claimsInterval = setInterval(() => fetchClaims(connectedWallet), 45_000)
  cleanups.push(() => clearInterval(marketInterval))
  cleanups.push(() => clearInterval(gravityInterval))
  cleanups.push(() => clearInterval(spinsInterval))
  cleanups.push(() => clearInterval(claimsInterval))

  return () => cleanups.forEach((fn) => fn())
}
