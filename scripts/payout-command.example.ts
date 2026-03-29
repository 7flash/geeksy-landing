type PayoutPayload = {
  requestId: string
  wallet: string
  amount: number
  token: string
  claimCount: number
  claimIds: string[]
  createdAt: number
  updatedAt: number
}

type PayoutResult = {
  ok?: boolean
  status: 'claimed' | 'failed'
  txSignature?: string
  reason?: string
}

async function readStdin() {
  return await new Response(Bun.stdin.stream()).text()
}

function fail(reason: string): never {
  const result: PayoutResult = { ok: false, status: 'failed', reason }
  console.log(JSON.stringify(result))
  process.exit(1)
}

const raw = (await readStdin()).trim()
if (!raw) fail('Missing JSON stdin payload')

let payload: PayoutPayload
try {
  payload = JSON.parse(raw) as PayoutPayload
} catch {
  fail('Invalid JSON stdin payload')
}

if (!payload.requestId || !payload.wallet || !Number.isFinite(Number(payload.amount))) {
  fail('Payload missing requestId, wallet, or numeric amount')
}

// Replace this block with real treasury signing + send logic.
// Expected behavior:
// 1. send payout to payload.wallet for payload.amount/payload.token
// 2. capture the real chain tx signature
// 3. print JSON with status=claimed + txSignature

const mode = (process.env.PAYOUT_TEMPLATE_MODE || 'fail').trim().toLowerCase()

if (mode === 'claimed') {
  const result: PayoutResult = {
    ok: true,
    status: 'claimed',
    txSignature: process.env.PAYOUT_TEMPLATE_TX || `template-tx-${payload.requestId}`,
  }
  console.log(JSON.stringify(result))
  process.exit(0)
}

const result: PayoutResult = {
  ok: false,
  status: 'failed',
  reason: 'Template command only. Replace scripts/payout-command.example.ts with real treasury send logic.',
}
console.log(JSON.stringify(result))
process.exit(0)
