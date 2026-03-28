import { getAdminClaimRequests, settleClaimRequest } from '../lib/wheel'

type PayoutResult = {
  ok?: boolean
  status?: string
  txSignature?: string
  reason?: string
}

type QueueRequest = ReturnType<typeof getAdminClaimRequests>[number]

const action = (process.env.PAYOUT_ACTION || 'list').trim().toLowerCase()
const watch = ['1', 'true', 'yes'].includes((process.env.PAYOUT_WATCH || '').trim().toLowerCase())
const intervalMs = Number(process.env.PAYOUT_INTERVAL_MS || 30_000)
const requestedStatus = (process.env.PAYOUT_STATUS || 'requested').trim().toLowerCase()
const requestIdFilter = (process.env.PAYOUT_REQUEST_ID || '').trim()
const dryRun = ['1', 'true', 'yes'].includes((process.env.PAYOUT_DRY_RUN || '').trim().toLowerCase())
const payoutCommand = (process.env.TREASURY_PAYOUT_COMMAND || '').trim()
const batchLimit = Math.max(1, Math.min(Number(process.env.PAYOUT_BATCH_LIMIT || 20), 200))

function nowIso() {
  return new Date().toISOString()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shellCommand(command: string) {
  return process.platform === 'win32' ? ['cmd', '/c', command] : ['sh', '-lc', command]
}

function log(...args: any[]) {
  console.log(`[payout-worker ${nowIso()}]`, ...args)
}

function getQueue() {
  const rows = getAdminClaimRequests(requestedStatus, batchLimit)
  return requestIdFilter ? rows.filter((row) => row.id === requestIdFilter) : rows
}

function printQueue(rows: QueueRequest[]) {
  if (!rows.length) {
    log(`No ${requestedStatus} payout requests found.`)
    return
  }
  for (const row of rows) {
    log(`${row.id} | ${row.wallet} | ${row.amount} ${row.token} | claims=${row.claimCount} | status=${row.status}`)
  }
}

async function runTreasuryCommand(request: QueueRequest): Promise<PayoutResult> {
  if (!payoutCommand) {
    throw new Error('TREASURY_PAYOUT_COMMAND is required for process mode')
  }

  const payload = {
    requestId: request.id,
    wallet: request.wallet,
    amount: request.amount,
    token: request.token,
    claimCount: request.claimCount,
    claimIds: request.claimIds,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }

  const proc = Bun.spawn(shellCommand(payoutCommand), {
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      PAYOUT_REQUEST_ID: request.id,
      PAYOUT_WALLET: request.wallet,
      PAYOUT_AMOUNT: String(request.amount),
      PAYOUT_TOKEN: request.token,
      PAYOUT_CLAIM_COUNT: String(request.claimCount),
    },
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    return { ok: false, status: 'failed', reason: stderr.trim() || stdout.trim() || `Treasury command exited with code ${exitCode}` }
  }

  try {
    const json = JSON.parse(stdout || '{}') as PayoutResult
    return json
  } catch {
    return { ok: false, status: 'failed', reason: `Treasury command returned non-JSON output: ${stdout.trim().slice(0, 500)}` }
  }
}

async function processRequest(request: QueueRequest) {
  if (dryRun) {
    log(`[dry-run] would process ${request.id} for ${request.amount} ${request.token} -> ${request.wallet}`)
    return
  }

  const result = await runTreasuryCommand(request)
  const normalizedStatus = (result.status || (result.ok ? 'claimed' : 'failed')).trim().toLowerCase()

  if (normalizedStatus === 'claimed') {
    if (!result.txSignature?.trim()) {
      throw new Error(`Treasury command marked ${request.id} claimed without txSignature`)
    }
    const settled = settleClaimRequest({ requestId: request.id, status: 'claimed', txSignature: result.txSignature })
    log(`claimed ${settled.requestId} tx=${settled.txSignature}`)
    return
  }

  const settled = settleClaimRequest({ requestId: request.id, status: 'failed', reason: result.reason || 'Treasury executor reported failure' })
  log(`failed ${settled.requestId} reason=${settled.reason || 'unknown'}`)
}

async function runOnce() {
  const rows = getQueue()
  printQueue(rows)
  if (action === 'list') return
  for (const row of rows) {
    await processRequest(row)
  }
}

async function main() {
  log(`action=${action} watch=${watch} status=${requestedStatus} batchLimit=${batchLimit} dryRun=${dryRun}`)
  if (action !== 'list' && action !== 'process') {
    throw new Error('PAYOUT_ACTION must be list or process')
  }
  if (!watch) {
    await runOnce()
    return
  }
  while (true) {
    try {
      await runOnce()
    } catch (error: any) {
      log(`error: ${error?.message || error}`)
    }
    await sleep(intervalMs)
  }
}

await main()
