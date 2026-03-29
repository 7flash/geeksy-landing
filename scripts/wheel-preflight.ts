import { getRpcUrl } from '../lib/gksy'
import { TREASURY_SOURCE, TREASURY_SNAPSHOT_COMMAND } from '../lib/wheel'

function shellCommand(command: string) {
  return process.platform === 'win32' ? ['cmd', '/c', command] : ['sh', '-lc', command]
}

function short(value: string | undefined | null) {
  const v = (value || '').trim()
  if (!v) return '(unset)'
  if (v.length <= 14) return v
  return `${v.slice(0, 6)}...${v.slice(-4)}`
}

async function runCommand(command: string, label: string, stdinText?: string) {
  const proc = Bun.spawn(shellCommand(command), {
    stdin: stdinText ? new TextEncoder().encode(stdinText) : 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: Bun.env,
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  console.log(`\n[preflight] ${label}`)
  console.log(`[preflight] command: ${command}`)
  console.log(`[preflight] exit: ${exitCode}`)
  if (stdout.trim()) console.log(`[preflight] stdout: ${stdout.trim()}`)
  if (stderr.trim()) console.log(`[preflight] stderr: ${stderr.trim()}`)

  return { exitCode, stdout, stderr }
}

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function validateSnapshotCommand() {
  if (TREASURY_SOURCE !== 'command') {
    console.log(`\n[preflight] treasury snapshot mode: ${TREASURY_SOURCE} (no command execution required)`)
    return
  }

  assert(TREASURY_SNAPSHOT_COMMAND, 'TREASURY_SNAPSHOT_COMMAND is required when TREASURY_SOURCE=command')
  const result = await runCommand(TREASURY_SNAPSHOT_COMMAND, 'treasury snapshot command')
  assert(result.exitCode === 0, 'Treasury snapshot command exited non-zero')

  let parsed: any
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    throw new Error('Treasury snapshot command did not return valid JSON')
  }

  assert(Number.isFinite(Number(parsed.amount)) && Number(parsed.amount) >= 0, 'Snapshot JSON must contain non-negative numeric amount')
  console.log(`[preflight] snapshot ok: amount=${parsed.amount} token=${parsed.token || 'SOL'} source=${parsed.source || 'command'}`)
}

async function validatePayoutCommand() {
  const payoutCommand = (process.env.TREASURY_PAYOUT_COMMAND || '').trim()
  if (!payoutCommand) {
    console.log('\n[preflight] payout command: not configured (skipping)')
    return
  }

  const payload = {
    requestId: 'preflight-request',
    wallet: process.env.TREASURY_WALLET || 'preflight-wallet',
    amount: 0.123456,
    token: 'SOL',
    claimCount: 1,
    claimIds: ['preflight-claim'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = await runCommand(payoutCommand, 'treasury payout command', JSON.stringify(payload))
  assert(result.exitCode === 0, 'Treasury payout command exited non-zero for preflight payload')

  let parsed: any
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    throw new Error('Treasury payout command did not return valid JSON')
  }

  const normalizedStatus = String(parsed.status || (parsed.ok ? 'claimed' : 'failed')).trim().toLowerCase()
  assert(normalizedStatus === 'claimed' || normalizedStatus === 'failed', 'Payout JSON must resolve to claimed or failed status')
  if (normalizedStatus === 'claimed') {
    assert((parsed.txSignature || '').trim(), 'Payout JSON must include txSignature when status=claimed')
  }
  console.log(`[preflight] payout ok: status=${normalizedStatus}${parsed.txSignature ? ` tx=${parsed.txSignature}` : ''}`)
}

console.log('[preflight] Geeksy wheel preflight')
console.log(`[preflight] treasury source: ${TREASURY_SOURCE}`)
console.log(`[preflight] treasury wallet: ${short(process.env.TREASURY_WALLET)}`)
console.log(`[preflight] treasury asset: ${(process.env.TREASURY_ASSET || process.env.TREASURY_TOKEN_MINT || 'GKSY').trim() || 'GKSY'}`)
console.log(`[preflight] rpc host: ${(() => { try { return new URL(process.env.TREASURY_RPC_URL || process.env.HELIUS_RPC_URL || getRpcUrl()).host } catch { return 'unknown' } })()}`)
console.log(`[preflight] snapshot command configured: ${TREASURY_SNAPSHOT_COMMAND ? 'yes' : 'no'}`)
console.log(`[preflight] payout command configured: ${(process.env.TREASURY_PAYOUT_COMMAND || '').trim() ? 'yes' : 'no'}`)

try {
  await validateSnapshotCommand()
  await validatePayoutCommand()
  console.log('\n[preflight] OK — wheel treasury configuration looks runnable.')
} catch (error: any) {
  console.error(`\n[preflight] FAILED — ${error?.message || error}`)
  process.exit(1)
}
