import { Head } from 'melina/server'
import { db } from '../../../lib/db'

function shortWallet(wallet: string | null) {
  return wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-6)}` : 'unknown'
}

function fmtPoints(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(2)
}

function rewardPctLabel(rewardBps: number) {
  return `${(rewardBps / 100).toFixed(2)}%`
}

export default function SpinSharePage({ params }: { params: { id: string } }) {
  const id = params?.id || ''
  const spin = db.query(`
    SELECT id, wallet, tier_id as tierId, reward_bps as rewardBps, reward_amount as rewardAmount,
           treasury_amount_at_spin as treasuryAmountAtSpin, status, created_at as createdAt
    FROM wheel_spins
    WHERE id = ?
    LIMIT 1
  `).get(id) as any

  const url = `https://geeksy.xyz/spin/${id}`
  const imageUrl = `https://geeksy.xyz/api/og/spin/${id}`
  const title = spin
    ? `Geeksy ${String(spin.tierId).toUpperCase()} spin — ${rewardPctLabel(Number(spin.rewardBps || 0))} treasury reward`
    : 'Geeksy gravity wheel spin'
  const description = spin
    ? `${shortWallet(spin.wallet)} unlocked ${rewardPctLabel(Number(spin.rewardBps || 0))} treasury rewards (${fmtPoints(Number(spin.rewardAmount || 0))} recorded) by spending accumulated GKSY gravity.`
    : 'A shared Geeksy gravity-wheel result. Own GKSY, accumulate gravity minute by minute, and spin for treasury rewards.'

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
      </Head>

      <main className="landing-shell">
        <div className="landing" style={{ padding: '72px 0 96px' }}>
          <nav className="nav nav-marketing">
            <div className="nav-brand"><div className="logo">G</div><span className="brand-name">Geeksy</span></div>
            <div className="nav-links">
              <a href="https://geeksy.xyz">Home</a>
              <a href="https://app.geeksy.xyz" className="btn-primary">Open App →</a>
            </div>
          </nav>

          <section className="gravity-dashboard-card cosmic-dashboard-card" style={{ marginTop: '32px' }}>
            <div className="market-card-label">Shared Gravity Spin</div>
            <h1 style={{ fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: '1.08', marginBottom: '12px' }}>
              {spin ? `${String(spin.tierId).toUpperCase()} reward unlocked` : 'Spin not found'}
            </h1>
            <p className="section-desc" style={{ marginBottom: '24px', maxWidth: '860px' }}>
              {spin
                ? `${shortWallet(spin.wallet)} unlocked ${rewardPctLabel(Number(spin.rewardBps || 0))} of treasury rewards by spending accumulated GKSY gravity.`
                : 'This shared spin link does not currently point to a stored wheel result.'}
            </p>

            {spin ? (
              <div className="featured-spin-card" style={{ marginBottom: '20px' }}>
                <div className="featured-spin-top">
                  <div>
                    <h4>{String(spin.tierId).toUpperCase()}</h4>
                    <p>{new Date(Number(spin.createdAt)).toLocaleString()}</p>
                  </div>
                  <a className="btn-primary featured-spin-x-link" href={`https://geeksy.xyz/?spin=${spin.id}`}>Open in live dashboard</a>
                </div>
                <div className="featured-spin-metrics">
                  <div><span>Wallet</span><strong>{shortWallet(spin.wallet)}</strong></div>
                  <div><span>Reward</span><strong>{rewardPctLabel(Number(spin.rewardBps || 0))} treasury</strong></div>
                  <div><span>Recorded</span><strong>{fmtPoints(Number(spin.rewardAmount || 0))}</strong></div>
                </div>
              </div>
            ) : null}

            <div className="gravity-hero-actions">
              <a href={spin ? `https://geeksy.xyz/?spin=${spin.id}` : 'https://geeksy.xyz'} className="btn-hero">View on geeksy.xyz</a>
              <a href="https://app.geeksy.xyz" className="wheel-secondary-btn">Open the app</a>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
