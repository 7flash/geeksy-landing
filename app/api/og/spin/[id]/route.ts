import { db } from '../../../../../lib/db'
import { getWalletMeta } from '../../../../../lib/gksy'

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

function formatDate(ts: number | null | undefined) {
  if (!ts) return 'Live now'
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return 'Live now'
  }
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

  const walletMeta = row ? getWalletMeta(String(row.wallet)) : null
  const title = row
    ? `${String(row.tierId).toUpperCase()} reward unlocked`
    : 'Geeksy Gravity Wheel'
  const subtitle = row
    ? `${walletMeta?.walletDisplay || shortWallet(row.wallet)} hit ${formatRewardPct(Number(row.rewardBps || 0))} treasury rewards`
    : 'Own GKSY. Accumulate gravity. Spin for treasury rewards.'
  const reward = row ? `${formatAmount(Number(row.rewardAmount || 0))} recorded` : 'Live gravity dashboard'
  const status = row ? String(row.status || 'recorded') : 'Wallet-native reward wheel'
  const walletLine = row ? (walletMeta?.walletShort || shortWallet(row.wallet)) : 'Live on geeksy.xyz'
  const tierChip = row ? String(row.tierId).toUpperCase() : 'LIVE'
  const when = row ? formatDate(Number(row.createdAt || 0)) : 'Hold GKSY'

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="44" y1="34" x2="1144" y2="598" gradientUnits="userSpaceOnUse">
      <stop stop-color="#050816"/>
      <stop offset="0.48" stop-color="#14122D"/>
      <stop offset="1" stop-color="#2A1040"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(198 112) rotate(35) scale(500 260)">
      <stop stop-color="#22D3EE" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1030 162) rotate(180) scale(320 260)">
      <stop stop-color="#A855F7" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#A855F7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowC" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(970 516) rotate(180) scale(320 220)">
      <stop stop-color="#EC4899" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#EC4899" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cardStroke" x1="101" y1="63" x2="1098" y2="567" gradientUnits="userSpaceOnUse">
      <stop stop-color="#60A5FA" stop-opacity="0.25"/>
      <stop offset="0.5" stop-color="#A855F7" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#F472B6" stop-opacity="0.25"/>
    </linearGradient>
    <linearGradient id="chip" x1="85" y1="69" x2="255" y2="69" gradientUnits="userSpaceOnUse">
      <stop stop-color="#22D3EE"/>
      <stop offset="1" stop-color="#A855F7"/>
    </linearGradient>
    <linearGradient id="wheelRing" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#22D3EE"/>
      <stop offset="0.5" stop-color="#A855F7"/>
      <stop offset="1" stop-color="#F59E0B"/>
    </linearGradient>
    <filter id="softGlow" x="0" y="0" width="1200" height="630" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>

  <rect x="22" y="18" width="1156" height="594" rx="36" fill="url(#bg)"/>
  <rect x="22" y="18" width="1156" height="594" rx="36" fill="url(#glowA)"/>
  <rect x="22" y="18" width="1156" height="594" rx="36" fill="url(#glowB)"/>
  <rect x="22" y="18" width="1156" height="594" rx="36" fill="url(#glowC)"/>
  <rect x="22.5" y="18.5" width="1155" height="593" rx="35.5" stroke="url(#cardStroke)"/>

  <g opacity="0.85">
    <circle cx="125" cy="83" r="2.8" fill="#F8FAFC"/>
    <circle cx="192" cy="154" r="2.4" fill="#C4B5FD"/>
    <circle cx="302" cy="101" r="1.9" fill="#67E8F9"/>
    <circle cx="1040" cy="89" r="2.5" fill="#F8FAFC"/>
    <circle cx="1112" cy="138" r="1.9" fill="#F9A8D4"/>
    <circle cx="975" cy="540" r="2.4" fill="#C4B5FD"/>
    <circle cx="1080" cy="502" r="1.8" fill="#67E8F9"/>
  </g>

  <rect x="84" y="56" width="184" height="38" rx="19" fill="url(#chip)"/>
  <text x="107" y="81" fill="#F8FAFC" font-size="20" font-family="Inter, Arial, sans-serif" font-weight="800" letter-spacing="1.4">${escapeXml(tierChip)}</text>
  <text x="84" y="136" fill="#A78BFA" font-size="23" font-family="Inter, Arial, sans-serif" font-weight="700" letter-spacing="2.4">GEEKSY GRAVITY WHEEL</text>
  <text x="84" y="228" fill="#F8FAFC" font-size="66" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(title)}</text>
  <text x="84" y="290" fill="#CBD5E1" font-size="31" font-family="Inter, Arial, sans-serif" font-weight="500">${escapeXml(subtitle)}</text>

  <rect x="84" y="338" width="470" height="188" rx="28" fill="#0F1023" fill-opacity="0.86" stroke="#5B5BD6" stroke-opacity="0.32"/>
  <text x="116" y="381" fill="#94A3B8" font-size="21" font-family="Inter, Arial, sans-serif" font-weight="700">Treasury reward</text>
  <text x="116" y="455" fill="#F8FAFC" font-size="52" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(row ? formatRewardPct(Number(row.rewardBps || 0)) : 'Live weighted wheel')}</text>
  <text x="116" y="495" fill="#67E8F9" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="700">${escapeXml(reward)}</text>

  <rect x="584" y="392" width="188" height="134" rx="24" fill="#0F1023" fill-opacity="0.82" stroke="#5B5BD6" stroke-opacity="0.28"/>
  <rect x="792" y="392" width="160" height="134" rx="24" fill="#0F1023" fill-opacity="0.82" stroke="#5B5BD6" stroke-opacity="0.28"/>
  <rect x="972" y="392" width="144" height="134" rx="24" fill="#0F1023" fill-opacity="0.82" stroke="#5B5BD6" stroke-opacity="0.28"/>
  <text x="612" y="431" fill="#94A3B8" font-size="20" font-family="Inter, Arial, sans-serif" font-weight="700">Wallet</text>
  <text x="612" y="482" fill="#F8FAFC" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(walletLine)}</text>
  <text x="820" y="431" fill="#94A3B8" font-size="20" font-family="Inter, Arial, sans-serif" font-weight="700">Status</text>
  <text x="820" y="482" fill="#F8FAFC" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(status)}</text>
  <text x="1000" y="431" fill="#94A3B8" font-size="20" font-family="Inter, Arial, sans-serif" font-weight="700">When</text>
  <text x="1000" y="482" fill="#F8FAFC" font-size="26" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(when)}</text>

  <g transform="translate(897 118)">
    <circle cx="135" cy="135" r="126" fill="#0A0C1C" stroke="#A78BFA" stroke-opacity="0.28" stroke-width="2"/>
    <circle cx="135" cy="135" r="88" fill="#090B18" stroke="url(#wheelRing)" stroke-width="20"/>
    <circle cx="135" cy="135" r="58" fill="#11162D" stroke="#6366F1" stroke-opacity="0.45" stroke-width="2"/>
    <path d="M135 31L170 135H100L135 31Z" fill="#F8FAFC" fill-opacity="0.96"/>
    <circle cx="135" cy="135" r="18" fill="#F8FAFC" fill-opacity="0.95"/>
    <path d="M135 75L152 118L195 135L152 152L135 195L118 152L75 135L118 118L135 75Z" fill="#F59E0B" fill-opacity="0.92" filter="url(#softGlow)"/>
  </g>

  <text x="84" y="570" fill="#94A3B8" font-size="23" font-family="Inter, Arial, sans-serif" font-weight="600">Hold GKSY • Earn gravity minute by minute • Burn gravity into stardust • Win SOL from the treasury</text>
</svg>`

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}
