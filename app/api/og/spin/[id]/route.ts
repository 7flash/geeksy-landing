import { db } from '../../../../../lib/db'

function shortWallet(wallet: string | null) {
  return wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-6)}` : 'unknown'
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatRewardPct(rewardBps: number) {
  return `${(rewardBps / 100).toFixed(2)}%`
}

function formatAmount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(2)
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params?.id || ''
  const row = db.query(`
    SELECT id, wallet, tier_id as tierId, reward_bps as rewardBps, reward_amount as rewardAmount,
           treasury_amount_at_spin as treasuryAmountAtSpin, status, created_at as createdAt
    FROM wheel_spins
    WHERE id = ?
    LIMIT 1
  `).get(id) as any

  const title = row
    ? `Geeksy ${String(row.tierId).toUpperCase()} Spin`
    : 'Geeksy Gravity Wheel'
  const subtitle = row
    ? `${shortWallet(row.wallet)} unlocked ${formatRewardPct(Number(row.rewardBps || 0))} treasury rewards`
    : 'Own GKSY. Accumulate gravity. Spin for treasury rewards.'
  const reward = row ? `${formatAmount(Number(row.rewardAmount || 0))} recorded` : 'Live gravity dashboard'
  const status = row ? String(row.status || 'recorded') : 'Wallet-native reward wheel'

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#06060E"/>
      <stop offset="0.55" stop-color="#12122A"/>
      <stop offset="1" stop-color="#1E1035"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(190 120) rotate(42) scale(420 260)">
      <stop stop-color="#6366F1" stop-opacity="0.48"/>
      <stop offset="1" stop-color="#6366F1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(980 500) rotate(180) scale(360 260)">
      <stop stop-color="#EC4899" stop-opacity="0.36"/>
      <stop offset="1" stop-color="#EC4899" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" rx="32" fill="url(#bg)"/>
  <rect width="1200" height="630" rx="32" fill="url(#glow1)"/>
  <rect width="1200" height="630" rx="32" fill="url(#glow2)"/>
  <circle cx="1020" cy="170" r="96" fill="#0F172A" stroke="#A78BFA" stroke-opacity="0.4" stroke-width="2"/>
  <circle cx="1020" cy="170" r="66" fill="#111128" stroke="#6366F1" stroke-opacity="0.55" stroke-width="18"/>
  <path d="M1020 68L1072 170H968L1020 68Z" fill="#F8FAFC" fill-opacity="0.92"/>
  <text x="84" y="120" fill="#A78BFA" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="700" letter-spacing="2">GEEKSY GRAVITY WHEEL</text>
  <text x="84" y="222" fill="#F8FAFC" font-size="72" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(title)}</text>
  <text x="84" y="292" fill="#CBD5E1" font-size="34" font-family="Inter, Arial, sans-serif" font-weight="500">${escapeXml(subtitle)}</text>
  <rect x="84" y="364" width="440" height="146" rx="24" fill="#111128" fill-opacity="0.84" stroke="#6366F1" stroke-opacity="0.28"/>
  <rect x="548" y="364" width="272" height="146" rx="24" fill="#111128" fill-opacity="0.84" stroke="#6366F1" stroke-opacity="0.28"/>
  <rect x="844" y="364" width="272" height="146" rx="24" fill="#111128" fill-opacity="0.84" stroke="#6366F1" stroke-opacity="0.28"/>
  <text x="116" y="405" fill="#94A3B8" font-size="22" font-family="Inter, Arial, sans-serif" font-weight="700">Reward</text>
  <text x="116" y="466" fill="#F8FAFC" font-size="42" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(row ? formatRewardPct(Number(row.rewardBps || 0)) + ' treasury' : 'Live weighted wheel')}</text>
  <text x="580" y="405" fill="#94A3B8" font-size="22" font-family="Inter, Arial, sans-serif" font-weight="700">Recorded</text>
  <text x="580" y="466" fill="#F8FAFC" font-size="42" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(reward)}</text>
  <text x="876" y="405" fill="#94A3B8" font-size="22" font-family="Inter, Arial, sans-serif" font-weight="700">Status</text>
  <text x="876" y="466" fill="#F8FAFC" font-size="42" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(status)}</text>
  <text x="84" y="574" fill="#94A3B8" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="500">Own GKSY • Accumulate gravity minute by minute • Spend gravity to unlock treasury rewards</text>
</svg>`

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}
