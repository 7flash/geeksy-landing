import { Head } from 'melina/server'
import { db, estimateTokenPriceUsd } from '../lib/db'
import { getWalletDisplay, getWalletLabel } from '../lib/gksy'
import { getMarketSnapshotWithFallback } from '../lib/market-cache'

type MarketSnapshot = {
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
}

type GravitySnapshot = {
  leaderboard: Array<{
    rank: number
    wallet: string
    walletShort: string
    walletLabel: string | null
    points: number
    stardust: number
    remainingGravity: number
    streakMinutes: number
    balance: number
    usdPerMinute: number
    lastCreditedAt: number
  }>
  stats: {
    totalHolders: number
    totalPoints: number
    totalStardust: number
    totalRemainingGravity: number
    lastUpdated: number
    activeScoredHolders: number
  }
  priceUsd: number
  scoringRule: string
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

function fmtPoints(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(2)
}

function fmtTokenAmount(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
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

async function getMarketSnapshotForPage(): Promise<MarketSnapshot | null> {
  try {
    const { payload } = await getMarketSnapshotWithFallback({ allowStale: true })
    return payload
  } catch {
    return null
  }
}

function getGravitySnapshot(limit = 30, market: MarketSnapshot | null = null): GravitySnapshot {
  const priceUsd = market?.pair?.priceUsd || estimateTokenPriceUsd()

  // Ensure stardust column
  try {
    const cols = db.query(`PRAGMA table_info(gravity_points)`).all() as Array<{ name: string }>
    if (!cols.some((c) => c.name === 'stardust')) {
      db.exec(`ALTER TABLE gravity_points ADD COLUMN stardust REAL NOT NULL DEFAULT 0`)
    }
  } catch {}

  const rows = db.query(`
    SELECT g.wallet, g.points, g.streak_minutes, g.last_credited_at,
           COALESCE(g.stardust, 0) as stardust,
           h.balance,
           COALESCE(l.total_spent, 0) as totalSpent,
           COALESCE(g.points, 0) - COALESCE(l.total_spent, 0) as remainingGravity
    FROM gravity_points g
    LEFT JOIN holder_snapshots h ON h.wallet = g.wallet
    LEFT JOIN wallet_gravity_ledger l ON l.wallet = g.wallet
    ORDER BY COALESCE(g.stardust, 0) DESC, g.points DESC
    LIMIT ?
  `).all(limit) as Array<{
    wallet: string
    points: number
    streak_minutes: number
    last_credited_at: number
    stardust: number
    balance: number | null
    totalSpent: number
    remainingGravity: number
  }>

  const stats = db.query(`
    SELECT 
      COUNT(*) as totalHolders,
      COALESCE(SUM(points), 0) as totalPoints,
      COALESCE(SUM(stardust), 0) as totalStardust,
      COALESCE(MAX(last_credited_at), 0) as lastUpdated,
      COALESCE(SUM(CASE WHEN streak_minutes > 0 THEN 1 ELSE 0 END), 0) as activeScoredHolders
    FROM gravity_points
  `).get() as { totalHolders: number; totalPoints: number; totalStardust: number; lastUpdated: number; activeScoredHolders: number }

  const totalRemaining = db.query(`
    SELECT COALESCE(SUM(COALESCE(g.points, 0) - COALESCE(l.total_spent, 0)), 0) as total
    FROM gravity_points g
    LEFT JOIN wallet_gravity_ledger l ON l.wallet = g.wallet
    WHERE COALESCE(g.points, 0) - COALESCE(l.total_spent, 0) > 0
  `).get() as { total: number }

  return {
    leaderboard: rows.map((row, i) => ({
      rank: i + 1,
      wallet: row.wallet,
      walletShort: getWalletDisplay(row.wallet),
      walletLabel: getWalletLabel(row.wallet),
      points: row.points,
      stardust: row.stardust,
      remainingGravity: Math.max(0, row.remainingGravity),
      streakMinutes: row.streak_minutes,
      balance: row.balance || 0,
      usdPerMinute: priceUsd > 0 && row.balance ? row.balance * priceUsd : 0,
      lastCreditedAt: row.last_credited_at,
    })),
    stats: {
      ...stats,
      totalRemainingGravity: totalRemaining?.total || 0,
    },
    priceUsd,
    scoringRule: 'Each minute, gravity += GKSY balance × USD price. Spinning burns all gravity into stardust and wins SOL from treasury.',
  }
}

function MarketFallback({ data }: { data: MarketSnapshot | null }) {
  if (!data?.ok || !data.pair || !data.token) return <div className="market-loading">Market snapshot will appear after the first live refresh.</div>
  const p = data.pair
  return <div className="market-grid">
    <div className="market-card market-card-primary"><div className="market-card-label">Token</div><div className="market-token-row"><div><h3>{data.token.name} ({data.token.symbol})</h3><p className="market-muted">{data.token.address}</p></div><a href={p.url} target="_blank" rel="noopener" className="btn-primary">View on Dexscreener</a></div></div>
    <div className="market-card"><div className="market-card-label">Price</div><div className="market-big">{fmtUsd(p.priceUsd)}</div><div className={`market-change ${p.changeH24 >= 0 ? 'pos' : 'neg'}`}>24h {fmtPct(p.changeH24)}</div></div>
    <div className="market-card"><div className="market-card-label">Liquidity</div><div className="market-big">{fmtUsd(p.liquidityUsd)}</div><div className="market-muted">DEX: {p.dexId}</div></div>
    <div className="market-card"><div className="market-card-label">FDV</div><div className="market-big">{fmtUsd(p.fdv)}</div><div className="market-muted">Market cap {fmtUsd(p.marketCap)}</div></div>
    <div className="market-card"><div className="market-card-label">24h Volume</div><div className="market-big">{fmtUsd(p.volume24h)}</div><div className="market-muted">Buys {p.buys24h} · Sells {p.sells24h}</div></div>
    <div className="market-card"><div className="market-card-label">Momentum</div><div className="market-mini-grid"><span className={p.changeM5 >= 0 ? 'pos' : 'neg'}>5m {fmtPct(p.changeM5)}</span><span className={p.changeH1 >= 0 ? 'pos' : 'neg'}>1h {fmtPct(p.changeH1)}</span><span className={p.changeH6 >= 0 ? 'pos' : 'neg'}>6h {fmtPct(p.changeH6)}</span><span className={p.changeH24 >= 0 ? 'pos' : 'neg'}>24h {fmtPct(p.changeH24)}</span></div></div>
  </div>
}

function GravityFallback({ data }: { data: GravitySnapshot }) {
  if (!data.leaderboard.length) return <div className="market-loading">Gravity snapshot will appear after the first scoring cycle.</div>
  return <div className="gravity-dashboard-card cosmic-dashboard-card">
    <div className="gravity-dashboard-header"><div><div className="market-card-label">Cosmic Leaderboard</div><h3>Stardust &amp; Gravity</h3></div><div className="gravity-wallet-state"><span>SSR snapshot</span></div></div>
    <div className="wallet-summary-grid wallet-summary-grid-ssr">
      <div className="wallet-summary-card summary-stardust"><div className="market-card-label">Total Stardust</div><div className="wallet-summary-value stardust-value">✦ {fmtPoints(data.stats.totalStardust)}</div><p>Lifetime gravity burned by all holders through wheel spins.</p></div>
      <div className="wallet-summary-card summary-gravity"><div className="market-card-label">Total Gravity</div><div className="wallet-summary-value gravity-value">⬡ {fmtPoints(data.stats.totalRemainingGravity)}</div><p>Remaining gravity across all holders, available to spin.</p></div>
      <div className="wallet-summary-card"><div className="market-card-label">Scored Holders</div><div className="wallet-summary-value">{data.stats.activeScoredHolders}</div><p>Wallets earning gravity from live balance × USD price.</p></div>
      <div className="wallet-summary-card"><div className="market-card-label">Current Price</div><div className="wallet-summary-value">{fmtUsd(data.priceUsd)}</div><p>{data.scoringRule}</p></div>
    </div>
    <div className="gravity-hero-table-wrap"><table className="holders-table gravity-hero-table"><thead><tr><th>#</th><th>Wallet</th><th>✦ Stardust</th><th>⬡ Gravity</th><th>Balance</th><th>$/min</th></tr></thead><tbody>{data.leaderboard.map((row) => <tr key={row.wallet}><td>{row.rank}</td><td><code>{row.walletShort}</code></td><td className="stardust-cell">{fmtPoints(row.stardust)}</td><td className="gravity-cell">{fmtPoints(row.remainingGravity)}</td><td>{fmtTokenAmount(row.balance)}</td><td>{fmtUsd(row.usdPerMinute)}</td></tr>)}</tbody></table></div>
  </div>
}

export default async function LandingPage() {
  const marketSnapshot = await getMarketSnapshotForPage()
  const gravitySnapshot = getGravitySnapshot(30, marketSnapshot)
  return (
    <>
      <Head>
        <title>Geeksy — Hold GKSY. Earn Gravity. Win SOL.</title>
        <meta name="description" content="Hold GKSY tokens, accumulate gravity every minute, spin the cosmic wheel to win SOL from the treasury. Gravity burns into stardust — climb the lifetime leaderboard." />
        <meta property="og:title" content="Geeksy — Hold GKSY. Earn Gravity. Win SOL." />
        <meta property="og:description" content="Accumulate gravity by holding GKSY. Spin the wheel to burn gravity into stardust and win SOL. Top stardust holders get the Geeksy smart speaker." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://geeksy.xyz" />
        <meta property="og:image" content="https://geeksy.xyz/api/og/spin/default" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Geeksy — Hold GKSY. Earn Gravity. Win SOL." />
        <meta name="twitter:description" content="Accumulate gravity by holding GKSY. Spin the wheel to burn gravity into stardust and win SOL." />
        <meta name="twitter:image" content="https://geeksy.xyz/api/og/spin/default" />
      </Head>
      <main className="landing-shell">
        <div className="landing landing-wide">
          <nav className="nav nav-marketing">
            <div className="nav-brand"><div className="logo">G</div><span className="brand-name">Geeksy</span></div>
            <div className="nav-links">
              <a href="#gravity-story">Gravity</a>
              <a href="#market">GKSY</a>
              <a href="#how-it-works">How it Works</a>
              <a href="#stardust-prizes">Prizes</a>
              <a href="#stack">Stack</a>
              <a href="https://github.com/7flash/geeksy" target="_blank" rel="noopener">GitHub</a>
              <a href="https://app.geeksy.xyz" className="btn-primary">Open App →</a>
            </div>
          </nav>

          <section className="hero gravity-hero" id="gravity-story">
            <div className="gravity-hero-copy">
              <div className="hero-badge">Hold GKSY · Earn Gravity · Win SOL</div>
              <h1>Hold GKSY.<br /><span className="gradient-text">Win SOL.</span></h1>
              <p className="hero-sub">Every minute you hold GKSY tokens, you earn <strong>gravity</strong>. Connect your Phantom wallet and spin the cosmic wheel to <strong>burn all your gravity into stardust</strong> and win <strong>SOL from the treasury</strong>. The more gravity you have relative to other holders, the better your odds.</p>
              <div className="gravity-hero-actions">
                <button className="btn-hero" id="hero-connect-wallet-btn">Connect Phantom</button>
                <button className="btn-hero btn-spin-hero" id="hero-spin-wheel-btn">🎰 Spin the Wheel</button>
              </div>
              <div className="gravity-formula-card">
                <div className="market-card-label">How gravity accrues</div>
                <div className="gravity-formula">gravity += balance × priceUsd</div>
                <p>Updated every minute. Spinning burns all gravity → stardust + SOL prize.</p>
              </div>
              <div className="hero-stats-row" id="hero-wallet-cards">
                <div className="hero-stat-card"><div className="hero-stat-label">⬡ Your Gravity</div><div className="hero-stat-value" id="hero-gravity-val">—</div></div>
                <div className="hero-stat-card"><div className="hero-stat-label">✦ Your Stardust</div><div className="hero-stat-value" id="hero-stardust-val">—</div></div>
                <div className="hero-stat-card"><div className="hero-stat-label">🏆 Claimable SOL</div><div className="hero-stat-value" id="hero-claimable-val">—</div></div>
              </div>
            </div>
            <div className="gravity-hero-panel" id="gravity-hero-root"><GravityFallback data={gravitySnapshot} /></div>
          </section>
        </div>
      </main>

      <section className="section section-how-it-works" id="how-it-works">
        <div className="section-label">The Gravity Game</div>
        <h2>Hold. Accumulate. Spin. Win.</h2>
        <p className="section-desc">A simple game loop: hold GKSY tokens, earn gravity every minute, spin the wheel to convert gravity into stardust and win SOL from the treasury.</p>
        <div className="how-steps">
          <div className="how-step"><div className="how-step-num">1</div><div><h3>Hold GKSY</h3><p>Buy and hold GKSY tokens in your Phantom wallet. Every minute, gravity accrues based on your token balance × current USD price.</p></div></div>
          <div className="how-step"><div className="how-step-num">2</div><div><h3>Accumulate Gravity</h3><p>Watch your gravity grow minute by minute. The more GKSY you hold and the longer you hold, the more gravity you accumulate.</p></div></div>
          <div className="how-step"><div className="how-step-num">3</div><div><h3>Spin the Wheel</h3><p>When you're ready, sign a message with Phantom to spin. <strong>All your gravity burns</strong> — converted into permanent stardust. The wheel determines your SOL prize from the treasury.</p></div></div>
          <div className="how-step"><div className="how-step-num">4</div><div><h3>Win SOL</h3><p>Your prize is a percentage of available SOL in the treasury. The more gravity you burn relative to all other holders, the better your odds of hitting bigger tiers.</p></div></div>
          <div className="how-step"><div className="how-step-num">5</div><div><h3>Claim & Repeat</h3><p>Claim your SOL winnings with another signed message. Then keep holding — gravity immediately starts accumulating again for your next spin.</p></div></div>
        </div>
        <div className="gravity-vs-stardust">
          <div className="gvs-card gvs-gravity"><div className="gvs-icon">⬡</div><h3>Gravity</h3><p>Current balance earned by holding GKSY. Burns completely when you spin the wheel. Converts to redeemable SOL from treasury + stardust.</p></div>
          <div className="gvs-arrow">→</div>
          <div className="gvs-card gvs-stardust"><div className="gvs-icon">✦</div><h3>Stardust</h3><p>Permanent. Lifetime accumulation of burned gravity. Leaderboard sorted by stardust. Top stardust holders get special prizes like the Geeksy smart speaker.</p></div>
        </div>
      </section>

      <section className="section section-prizes" id="stardust-prizes">
        <div className="section-label">Stardust Rewards</div>
        <h2>Top stardust holders get real prizes</h2>
        <p className="section-desc">The stardust leaderboard isn't just for bragging rights. Top lifetime stardust holders will receive special physical prizes.</p>
        <div className="prize-grid">
          <div className="prize-card prize-card-main"><div className="prize-icon">🔊</div><h3>Geeksy Smart Speaker</h3><p>Our custom-built AI smart speaker with T527 SoC, FPGA, 4-mic array — runs AI locally, no cloud required. Top stardust holders will receive one before anyone else.</p></div>
          <div className="prize-card"><div className="prize-icon">🎁</div><h3>Exclusive Merch</h3><p>Limited edition Geeksy gear for top leaderboard positions.</p></div>
          <div className="prize-card"><div className="prize-icon">⚡</div><h3>Early Access</h3><p>Priority access to new features, beta programs, and Geeksy hardware drops.</p></div>
        </div>
      </section>

      <section className="section section-bridge" id="market">
        <div className="section-label">GKSY Token</div>
        <h2>The token that powers the gravity game</h2>
        <p className="section-desc">GKSY is the Solana token behind the gravity mechanic. Hold it to earn gravity, spin for SOL, and climb the stardust leaderboard.</p>
        <div id="market-root"><MarketFallback data={marketSnapshot} /></div>
        <script id="ssr-market-data" type="application/json">{JSON.stringify(marketSnapshot)}</script>
        <script id="ssr-gravity-data" type="application/json">{JSON.stringify(gravitySnapshot)}</script>
      </section>

      <section className="section" id="stack">
        <div className="section-label">The Stack Behind Geeksy</div>
        <h2>More than a token game</h2>
        <p className="section-desc">Geeksy is a complete AI ecosystem: local-first assistant, autonomous agent framework, composable LLM toolkit, and custom hardware. The gravity game is the front door.</p>
        <div className="stack-pillars">
          <div className="stack-pillar"><span>01</span><div><h3>jsx-ai</h3><p>Composable JSX prompts for any LLM provider. 5 providers, zero config.</p></div></div>
          <div className="stack-pillar"><span>02</span><div><h3>smart-agent</h3><p>Autonomous agent framework with objectives, validation, and parallel tools.</p></div></div>
          <div className="stack-pillar"><span>03</span><div><h3>geeksy</h3><p>Local-first AI assistant. One command: <code>npx geeksy</code>. SQLite, scheduling, Telegram.</p></div></div>
          <div className="stack-pillar"><span>04</span><div><h3>Hardware</h3><p>Custom smart speaker with T527 SoC + FPGA. Open-source PCB. Local inference.</p></div></div>
        </div>
        <div className="start-grid">
          <div className="start-card"><h3>jsx-ai</h3><p>Composable prompts for any LLM</p><div className="code-block" style={{ marginBottom: '12px' }}><pre>npm install jsx-ai</pre></div><a href="https://www.npmjs.com/package/jsx-ai" className="start-link">npm →</a></div>
          <div className="start-card"><h3>smart-agent</h3><p>Autonomous agent with objectives</p><div className="code-block" style={{ marginBottom: '12px' }}><pre>npm install smart-agent-ai</pre></div><a href="https://www.npmjs.com/package/smart-agent-ai" className="start-link">npm →</a></div>
          <div className="start-card"><h3>geeksy</h3><p>Local-first AI assistant</p><div className="code-block" style={{ marginBottom: '12px' }}><pre>npx geeksy</pre></div><a href="https://www.npmjs.com/package/geeksy" className="start-link">npm →</a></div>
        </div>
      </section>

      <footer className="footer"><div className="footer-links"><a href="https://github.com/7flash">GitHub</a><a href="https://www.npmjs.com/package/jsx-ai">jsx-ai</a><a href="https://www.npmjs.com/package/smart-agent-ai">smart-agent</a><a href="https://www.npmjs.com/package/geeksy">geeksy</a></div><p>Built with Melina.js · Every layer open source · © 2026 geeksy.xyz</p></footer>
    </>
  )
}
