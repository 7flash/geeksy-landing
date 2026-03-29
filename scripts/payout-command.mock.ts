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

function exitJson(result: PayoutResult, code = 0): never {
  console.log(JSON.stringify(result))
  process.exit(code)
}

const raw = (await readStdin()).trim()
if (!raw) exitJson({ ok: false, status: 'failed', reason: 'Missing JSON stdin payload' }, 1)

let payload: PayoutPayload
try {
  payload = JSON.parse(raw) as PayoutPayload
} catch {
  exitJson({ ok: false, status: 'failed', reason: 'Invalid JSON stdin payload' }, 1)
}

if (!payload.requestId || !payload.wallet || !Number.isFinite(Number(payload.amount))) {
  exitJson({ ok: false, status: 'failed', reason: 'Payload missing requestId, wallet, or numeric amount' }, 1)
}

const mode = (process.env.PAYOUT_MOCK_MODE || 'failed').trim().toLowerCase()

if (mode === 'claimed') {
  exitJson({
    ok: true,
    status: 'claimed',
    txSignature: process.env.PAYOUT_MOCK_TX || `mock-tx-${payload.requestId}`,
  })
}

if (mode === 'failed') {
  exitJson({
    ok: false,
    status: 'failed',
    reason: process.env.PAYOUT_MOCK_REASON || 'Mock payout command intentionally failing. Set PAYOUT_MOCK_MODE=claimed for contract testing.',
  })
}

exitJson({ ok: false, status: 'failed', reason: `Unsupported PAYOUT_MOCK_MODE=${mode}` }, 1)
