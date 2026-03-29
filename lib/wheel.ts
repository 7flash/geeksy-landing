import { createHash, randomUUID } from 'crypto'
import { db } from './db'

const encoder = new TextEncoder()

// Spin burns ALL spendable gravity — no fixed cost
export const WHEEL_CHALLENGE_TTL_MS = Number(process.env.WHEEL_CHALLENGE_TTL_MS || 5 * 60 * 1000)
export const CLAIM_CHALLENGE_TTL_MS = Number(process.env.CLAIM_CHALLENGE_TTL_MS || 10 * 60 * 1000)
export const TREASURY_REWARD_TOKEN = 'SOL'
export const TREASURY_SOURCE = process.env.TREASURY_SOURCE || 'env'
export const TREASURY_AMOUNT = Number(process.env.TREASURY_AMOUNT || 0)
export const TREASURY_SNAPSHOT_COMMAND = (process.env.TREASURY_SNAPSHOT_COMMAND || '').trim()
export const MIN_GRAVITY_TO_SPIN = Number(process.env.MIN_GRAVITY_TO_SPIN || 1)

// Reward tiers — probabilities are base rates, modified by gravity share
export const WHEEL_TIERS = [
  { id: 'dust', probability: 0.45, rewardBps: 5 },
  { id: 'small', probability: 0.28, rewardBps: 10 },
  { id: 'medium', probability: 0.15, rewardBps: 25 },
  { id: 'large', probability: 0.08, rewardBps: 50 },
  { id: 'mega', probability: 0.03, rewardBps: 100 },
  { id: 'cosmic', probability: 0.01, rewardBps: 250 },
] as const

function ensureColumn(table: string, column: string, sql: string) {
  const cols = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((col) => col.name === column)) {
    db.exec(sql)
  }
}

function shellCommand(command: string) {
  return process.platform === 'win32' ? ['cmd', '/c', command] : ['sh', '-lc', command]
}

async function readTreasurySnapshotFromCommand() {
  if (!TREASURY_SNAPSHOT_COMMAND) {
    throw new Error('TREASURY_SNAPSHOT_COMMAND is required when TREASURY_SOURCE=command')
  }

  const proc = Bun.spawn(shellCommand(TREASURY_SNAPSHOT_COMMAND), {
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      TREASURY_SOURCE_MODE: TREASURY_SOURCE,
      TREASURY_DEFAULT_TOKEN: TREASURY_REWARD_TOKEN,
      TREASURY_DEFAULT_AMOUNT: String(TREASURY_AMOUNT),
    },
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `Treasury snapshot command exited with code ${exitCode}`)
  }

  let parsed: { amount?: number | string; token?: string; source?: string }
  try {
    parsed = JSON.parse(stdout || '{}')
  } catch {
    throw new Error(`Treasury snapshot command returned non-JSON output: ${stdout.trim().slice(0, 500)}`)
  }

  const amount = Number(parsed.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Treasury snapshot command must return a non-negative numeric amount')
  }

  return {
    amount,
    token: 'SOL',
    source: (parsed.source || 'command').trim() || 'command',
  }
}

export function ensureWheelSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_gravity_ledger (
      wallet TEXT PRIMARY KEY,
      total_earned REAL NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      stardust REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wheel_challenges (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      nonce TEXT NOT NULL UNIQUE,
      spend_amount REAL NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      treasury_snapshot_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS treasury_snapshots (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wheel_spins (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      spend_amount REAL NOT NULL,
      wallet_gravity_before REAL NOT NULL,
      wallet_gravity_after REAL NOT NULL,
      tier_id TEXT NOT NULL,
      reward_bps INTEGER NOT NULL,
      treasury_snapshot_id TEXT NOT NULL,
      treasury_amount_at_spin REAL NOT NULL,
      reward_amount REAL NOT NULL,
      gravity_share REAL NOT NULL DEFAULT 0,
      signature TEXT,
      rng_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wheel_claims (
      id TEXT PRIMARY KEY,
      spin_id TEXT NOT NULL,
      wallet TEXT NOT NULL,
      amount REAL NOT NULL,
      token TEXT NOT NULL,
      status TEXT NOT NULL,
      tx_signature TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS claim_requests (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      amount REAL NOT NULL,
      token TEXT NOT NULL,
      claim_count INTEGER NOT NULL,
      nonce TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      message TEXT NOT NULL,
      signature TEXT,
      status TEXT NOT NULL,
      processed_at INTEGER,
      tx_signature TEXT,
      admin_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS claim_request_items (
      request_id TEXT NOT NULL,
      claim_id TEXT NOT NULL,
      PRIMARY KEY (request_id, claim_id)
    );
  `)

  ensureColumn('wallet_gravity_ledger', 'stardust', `ALTER TABLE wallet_gravity_ledger ADD COLUMN stardust REAL NOT NULL DEFAULT 0`)
  ensureColumn('wheel_claims', 'request_id', `ALTER TABLE wheel_claims ADD COLUMN request_id TEXT`)
  ensureColumn('wheel_claims', 'requested_at', `ALTER TABLE wheel_claims ADD COLUMN requested_at INTEGER`)
  ensureColumn('claim_requests', 'tx_signature', `ALTER TABLE claim_requests ADD COLUMN tx_signature TEXT`)
  ensureColumn('claim_requests', 'admin_reason', `ALTER TABLE claim_requests ADD COLUMN admin_reason TEXT`)
  ensureColumn('wheel_spins', 'gravity_share', `ALTER TABLE wheel_spins ADD COLUMN gravity_share REAL NOT NULL DEFAULT 0`)
}

export function getWalletGravity(wallet: string) {
  const row = db.query(`
    SELECT 
      COALESCE(g.points, 0) as totalEarned,
      COALESCE(l.total_spent, 0) as totalSpent,
      COALESCE(g.points, 0) - COALESCE(l.total_spent, 0) as spendable,
      COALESCE(l.stardust, 0) as stardust,
      COALESCE(g.last_credited_at, 0) as lastUpdated
    FROM (SELECT ? as wallet) w
    LEFT JOIN gravity_points g ON g.wallet = w.wallet
    LEFT JOIN wallet_gravity_ledger l ON l.wallet = w.wallet
  `).get(wallet) as { totalEarned: number; totalSpent: number; spendable: number; stardust: number; lastUpdated: number }

  return {
    totalEarned: row?.totalEarned || 0,
    totalSpent: row?.totalSpent || 0,
    spendable: Math.max(0, row?.spendable || 0),
    stardust: row?.stardust || 0,
    lastUpdated: row?.lastUpdated || 0,
  }
}

/** Get total remaining gravity across ALL holders (for share calculation) */
export function getTotalRemainingGravity() {
  const row = db.query(`
    SELECT COALESCE(SUM(
      COALESCE(g.points, 0) - COALESCE(l.total_spent, 0)
    ), 0) as totalRemaining
    FROM gravity_points g
    LEFT JOIN wallet_gravity_ledger l ON l.wallet = g.wallet
    WHERE COALESCE(g.points, 0) - COALESCE(l.total_spent, 0) > 0
  `).get() as { totalRemaining: number }
  return row?.totalRemaining || 0
}

export function syncWalletLedger(wallet: string, now = Date.now()) {
  const current = getWalletGravity(wallet)
  db.query(`
    INSERT INTO wallet_gravity_ledger (wallet, total_earned, total_spent, stardust, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(wallet) DO UPDATE SET
      total_earned = excluded.total_earned,
      stardust = wallet_gravity_ledger.stardust,
      updated_at = excluded.updated_at
  `).run(wallet, current.totalEarned, current.totalSpent, current.stardust, now)
  return getWalletGravity(wallet)
}

export async function createTreasurySnapshot(now = Date.now()) {
  const snapshot = TREASURY_SOURCE === 'command'
    ? await readTreasurySnapshotFromCommand()
    : { token: TREASURY_REWARD_TOKEN, amount: TREASURY_AMOUNT, source: TREASURY_SOURCE }

  const id = randomUUID()
  db.query(`INSERT INTO treasury_snapshots (id, token, amount, source, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    snapshot.token,
    snapshot.amount,
    snapshot.source,
    now,
  )
  return { id, token: snapshot.token, amount: snapshot.amount, source: snapshot.source, createdAt: now }
}

export function buildSpinMessage(wallet: string, challengeId: string, nonce: string, spendAmount: number, expiresAt: number) {
  return [
    'Spin Gravity Wheel — Burn All Gravity',
    `wallet=${wallet}`,
    `challengeId=${challengeId}`,
    `nonce=${nonce}`,
    `spend=${spendAmount.toFixed(4)}`,
    `expiresAt=${expiresAt}`,
  ].join('\n')
}

export function buildClaimMessage(wallet: string, requestId: string, nonce: string, amount: number, claimCount: number, token: string, expiresAt: number) {
  return [
    'Claim SOL Rewards',
    `wallet=${wallet}`,
    `requestId=${requestId}`,
    `nonce=${nonce}`,
    `amount=${amount}`,
    `claimCount=${claimCount}`,
    `token=${token}`,
    `expiresAt=${expiresAt}`,
  ].join('\n')
}

export async function createChallenge(wallet: string) {
  ensureWheelSchema()
  const now = Date.now()
  const synced = syncWalletLedger(wallet, now)
  if (synced.spendable < MIN_GRAVITY_TO_SPIN) {
    throw new Error(`Insufficient spendable gravity. Need at least ${MIN_GRAVITY_TO_SPIN}, have ${synced.spendable.toFixed(2)}`)
  }

  // Burn ALL spendable gravity
  const spendAmount = synced.spendable

  const challengeId = randomUUID()
  const nonce = randomUUID()
  const expiresAt = now + WHEEL_CHALLENGE_TTL_MS
  const treasurySnapshot = await createTreasurySnapshot(now)
  const message = buildSpinMessage(wallet, challengeId, nonce, spendAmount, expiresAt)

  db.query(`
    INSERT INTO wheel_challenges (id, wallet, nonce, spend_amount, expires_at, treasury_snapshot_id, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(challengeId, wallet, nonce, spendAmount, expiresAt, treasurySnapshot.id, message, now)

  return {
    challengeId,
    wallet,
    nonce,
    spendAmount,
    expiresAt,
    message,
    treasurySnapshot,
    spendableBefore: synced.spendable,
  }
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Choose reward tier, influenced by the user's gravity share.
 * Higher gravity share = better chance of landing on higher tiers.
 * 
 * gravityShare: 0..1 representing user's fraction of total remaining gravity
 * randomFloat: 0..1 raw random
 * 
 * The share shifts the probability distribution upward:
 * - At 0% share: base probabilities apply
 * - At higher shares: probability mass shifts toward better tiers
 */
function chooseTierWeighted(randomFloat: number, gravityShare: number) {
  // Boost factor: gravity share amplifies upward shift
  // Max boost at 100% share doubles the chance of better tiers
  const boost = Math.min(gravityShare * 2, 0.8) // cap at 0.8 shift

  // Shift the random number downward (lower = better tier since we accumulate from dust)
  // Actually: we want higher share to shift toward HIGHER tiers
  // So we push the random number higher, making it more likely to pass lower-tier thresholds
  const adjustedRandom = randomFloat * (1 - boost) + boost * 0.5

  let cursor = 0
  for (const tier of WHEEL_TIERS) {
    cursor += tier.probability
    if (adjustedRandom <= cursor) return tier
  }
  return WHEEL_TIERS[WHEEL_TIERS.length - 1]
}

function decodeBase64Loose(value: string) {
  const normalized = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!normalized) throw new Error('Empty base64 value')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Uint8Array.from(Buffer.from(padded, 'base64'))
}

function decodeHex(value: string) {
  const normalized = value.trim().replace(/^0x/i, '')
  if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized)) {
    throw new Error('Invalid hex string')
  }
  return Uint8Array.from(Buffer.from(normalized, 'hex'))
}

function base58Decode(input: string) {
  const value = input.trim()
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const base = 58
  const bytes = [0]
  for (const char of value) {
    const digit = alphabet.indexOf(char)
    if (digit < 0) throw new Error('Invalid base58 string')
    let carry = digit
    for (let i = 0; i < bytes.length; i++) {
      const x = bytes[i]! * base + carry
      bytes[i] = x & 0xff
      carry = x >> 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (const char of value) {
    if (char === '1') bytes.push(0)
    else break
  }
  return Uint8Array.from(bytes.reverse())
}

function parseSignatureBytes(signature: string) {
  const value = signature.trim()
  const decoders = [
    () => decodeBase64Loose(value),
    () => decodeHex(value),
    () => base58Decode(value),
  ]

  for (const decode of decoders) {
    try {
      const bytes = decode()
      if (bytes.length === 64) return bytes
    } catch {}
  }

  throw new Error('Invalid wallet signature encoding')
}

export async function verifyWalletSignature(wallet: string, message: string, signatureValue: string) {
  const trimmedWallet = wallet.trim()
  if (!trimmedWallet) throw new Error('Wallet is required')

  let publicKeyRaw: Uint8Array
  try {
    publicKeyRaw = base58Decode(trimmedWallet)
  } catch {
    throw new Error('Invalid wallet public key')
  }
  if (publicKeyRaw.length !== 32) {
    throw new Error('Invalid wallet public key length')
  }

  const publicKeyBytes = Uint8Array.from(publicKeyRaw)
  const signatureBytes = Uint8Array.from(parseSignatureBytes(signatureValue))
  const messageBytes = Uint8Array.from(encoder.encode(message))

  try {
    const key = await crypto.subtle.importKey('raw', publicKeyBytes, { name: 'Ed25519' }, false, ['verify'])
    return await crypto.subtle.verify('Ed25519', key, signatureBytes, messageBytes)
  } catch {
    throw new Error('Failed to verify wallet signature')
  }
}

export async function consumeSpinChallenge(wallet: string, challengeId: string, signature: string) {
  ensureWheelSchema()
  const now = Date.now()
  const challenge = db.query(`
    SELECT id, wallet, nonce, spend_amount, expires_at, used_at, treasury_snapshot_id, message, created_at
    FROM wheel_challenges
    WHERE id = ?
  `).get(challengeId) as {
    id: string
    wallet: string
    nonce: string
    spend_amount: number
    expires_at: number
    used_at: number | null
    treasury_snapshot_id: string
    message: string
    created_at: number
  } | null

  if (!challenge) throw new Error('Challenge not found')
  if (challenge.wallet !== wallet) throw new Error('Wallet mismatch')
  if (challenge.used_at) throw new Error('Challenge already used')
  if (challenge.expires_at < now) throw new Error('Challenge expired')

  const ok = await verifyWalletSignature(wallet, challenge.message, signature)
  if (!ok) throw new Error('Invalid wallet signature')

  const treasury = db.query(`SELECT id, token, amount, source, created_at FROM treasury_snapshots WHERE id = ?`).get(challenge.treasury_snapshot_id) as {
    id: string
    token: string
    amount: number
    source: string
    created_at: number
  } | null
  if (!treasury) throw new Error('Treasury snapshot missing')

  const before = syncWalletLedger(wallet, now)
  const spendAmount = before.spendable // burn ALL remaining gravity
  if (spendAmount < MIN_GRAVITY_TO_SPIN) {
    throw new Error(`Insufficient spendable gravity. Need at least ${MIN_GRAVITY_TO_SPIN}, have ${Math.max(0, before.spendable).toFixed(2)}`)
  }

  // Calculate gravity share: user's gravity vs total remaining gravity
  const totalRemainingGravity = getTotalRemainingGravity()
  const gravityShare = totalRemainingGravity > 0 ? spendAmount / totalRemainingGravity : 0

  const rngHash = sha256Hex([process.env.WHEEL_SERVER_SEED || 'dev-seed', wallet, challenge.id, challenge.nonce, String(now)].join('|'))
  const randomFloat = parseInt(rngHash.slice(0, 12), 16) / 0xffffffffffff

  // Choose tier with gravity-share weighting
  const tier = chooseTierWeighted(randomFloat, gravityShare)

  // Reward in SOL from treasury
  const rewardAmount = treasury.amount * (tier.rewardBps / 10_000)
  const afterSpent = before.totalSpent + spendAmount
  const afterSpendable = 0 // all gravity burned
  const newStardust = before.stardust + spendAmount // gravity becomes stardust
  const spinId = randomUUID()
  const claimId = randomUUID()

  db.transaction(() => {
    db.query(`UPDATE wheel_challenges SET used_at = ? WHERE id = ?`).run(now, challenge.id)

    // Update ledger: burn all gravity, add to stardust
    db.query(`
      INSERT INTO wallet_gravity_ledger (wallet, total_earned, total_spent, stardust, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(wallet) DO UPDATE SET
        total_earned = excluded.total_earned,
        total_spent = excluded.total_spent,
        stardust = excluded.stardust,
        updated_at = excluded.updated_at
    `).run(wallet, before.totalEarned, afterSpent, newStardust, now)

    // Also update stardust on gravity_points table for leaderboard
    db.query(`UPDATE gravity_points SET stardust = ? WHERE wallet = ?`).run(newStardust, wallet)

    db.query(`
      INSERT INTO wheel_spins (
        id, wallet, challenge_id, spend_amount, wallet_gravity_before, wallet_gravity_after,
        tier_id, reward_bps, treasury_snapshot_id, treasury_amount_at_spin, reward_amount,
        gravity_share, signature, rng_hash, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      spinId,
      wallet,
      challenge.id,
      spendAmount,
      before.spendable,
      afterSpendable,
      tier.id,
      tier.rewardBps,
      treasury.id,
      treasury.amount,
      rewardAmount,
      gravityShare,
      signature,
      rngHash,
      'settled',
      now,
    )

    db.query(`
      INSERT INTO wheel_claims (id, spin_id, wallet, amount, token, status, tx_signature, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(claimId, spinId, wallet, rewardAmount, 'SOL', rewardAmount > 0 ? 'pending' : 'void', null, now, now)
  })()

  return {
    spinId,
    claimId,
    wallet,
    spendAmount,
    gravityBefore: before.spendable,
    gravityAfter: afterSpendable,
    stardustEarned: spendAmount,
    totalStardust: newStardust,
    gravityShare,
    reward: {
      tier: tier.id,
      rewardBps: tier.rewardBps,
      treasuryAmount: treasury.amount,
      rewardAmount,
      token: 'SOL',
      source: treasury.source,
    },
    rngHash,
  }
}

export function createClaimRequest(wallet: string) {
  ensureWheelSchema()
  const now = Date.now()
  const pendingClaims = db.query(`
    SELECT id, amount, token
    FROM wheel_claims
    WHERE wallet = ? AND status = 'pending'
    ORDER BY created_at ASC
  `).all(wallet) as Array<{ id: string; amount: number; token: string }>

  if (!pendingClaims.length) {
    throw new Error('No pending rewards to claim')
  }

  const token = 'SOL'
  const amount = pendingClaims.reduce((sum, claim) => sum + Number(claim.amount || 0), 0)
  const requestId = randomUUID()
  const nonce = randomUUID()
  const expiresAt = now + CLAIM_CHALLENGE_TTL_MS
  const message = buildClaimMessage(wallet, requestId, nonce, amount, pendingClaims.length, token, expiresAt)

  db.transaction(() => {
    db.query(`
      INSERT INTO claim_requests (id, wallet, amount, token, claim_count, nonce, expires_at, message, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(requestId, wallet, amount, token, pendingClaims.length, nonce, expiresAt, message, 'challenge_created', now, now)

    for (const claim of pendingClaims) {
      db.query(`INSERT INTO claim_request_items (request_id, claim_id) VALUES (?, ?)`).run(requestId, claim.id)
    }
  })()

  return {
    requestId,
    wallet,
    amount,
    token,
    claimCount: pendingClaims.length,
    nonce,
    expiresAt,
    message,
    claimIds: pendingClaims.map((claim) => claim.id),
  }
}

export async function consumeClaimRequest(wallet: string, requestId: string, signature: string) {
  ensureWheelSchema()
  const now = Date.now()
  const request = db.query(`
    SELECT id, wallet, amount, token, claim_count, nonce, expires_at, message, signature, status, processed_at, created_at, updated_at
    FROM claim_requests
    WHERE id = ?
  `).get(requestId) as {
    id: string
    wallet: string
    amount: number
    token: string
    claim_count: number
    nonce: string
    expires_at: number
    message: string
    signature: string | null
    status: string
    processed_at: number | null
    created_at: number
    updated_at: number
  } | null

  if (!request) throw new Error('Claim request not found')
  if (request.wallet !== wallet) throw new Error('Wallet mismatch')
  if (request.processed_at || request.status === 'requested') throw new Error('Claim request already used')
  if (request.expires_at < now) throw new Error('Claim request expired')

  const linkedClaims = db.query(`
    SELECT c.id, c.amount, c.token, c.status
    FROM claim_request_items i
    JOIN wheel_claims c ON c.id = i.claim_id
    WHERE i.request_id = ?
    ORDER BY c.created_at ASC
  `).all(requestId) as Array<{ id: string; amount: number; token: string; status: string }>

  if (!linkedClaims.length) throw new Error('Claim request has no claim rows')
  if (linkedClaims.some((claim) => claim.status !== 'pending')) throw new Error('Some rewards are no longer claimable')

  const amount = linkedClaims.reduce((sum, claim) => sum + Number(claim.amount || 0), 0)
  if (Math.abs(amount - Number(request.amount || 0)) > 1e-9) {
    throw new Error('Claim amount mismatch')
  }

  const isOk = await verifyWalletSignature(wallet, request.message, signature)
  if (!isOk) throw new Error('Invalid wallet signature')

  db.transaction(() => {
    db.query(`
      UPDATE claim_requests
      SET signature = ?, status = 'requested', updated_at = ?
      WHERE id = ?
    `).run(signature, now, requestId)

    db.query(`
      UPDATE wheel_claims
      SET status = 'requested', request_id = ?, requested_at = ?, updated_at = ?
      WHERE id IN (SELECT claim_id FROM claim_request_items WHERE request_id = ?)
    `).run(requestId, now, now, requestId)
  })()

  return {
    requestId,
    wallet,
    amount,
    token: 'SOL',
    claimCount: linkedClaims.length,
    status: 'requested',
    requestedAt: now,
    claimIds: linkedClaims.map((claim) => claim.id),
  }
}

export function getClaimHistory(wallet: string, limit = 20) {
  ensureWheelSchema()
  const rows = db.query(`
    SELECT c.id, c.spin_id as spinId, c.wallet, c.amount, c.token, c.status, c.tx_signature as txSignature,
           c.request_id as requestId, c.requested_at as requestedAt, c.created_at as createdAt, c.updated_at as updatedAt,
           s.tier_id as tierId, s.reward_bps as rewardBps
    FROM wheel_claims c
    LEFT JOIN wheel_spins s ON s.id = c.spin_id
    WHERE c.wallet = ?
    ORDER BY c.updated_at DESC, c.created_at DESC
    LIMIT ?
  `).all(wallet, limit) as Array<{
    id: string
    spinId: string
    wallet: string
    amount: number
    token: string
    status: string
    txSignature: string | null
    requestId: string | null
    requestedAt: number | null
    createdAt: number
    updatedAt: number
    tierId: string | null
    rewardBps: number | null
  }>

  return rows
}

export function getAdminClaimRequests(status = 'requested', limit = 50) {
  ensureWheelSchema()
  const rows = db.query(`
    SELECT r.id, r.wallet, r.amount, r.token, r.claim_count as claimCount, r.status, r.processed_at as processedAt,
           r.tx_signature as txSignature, r.admin_reason as adminReason, r.created_at as createdAt, r.updated_at as updatedAt,
           COALESCE(group_concat(c.id, ','), '') as claimIds
    FROM claim_requests r
    LEFT JOIN claim_request_items i ON i.request_id = r.id
    LEFT JOIN wheel_claims c ON c.id = i.claim_id
    WHERE r.status = ?
    GROUP BY r.id
    ORDER BY r.created_at ASC
    LIMIT ?
  `).all(status, limit) as Array<{
    id: string
    wallet: string
    amount: number
    token: string
    claimCount: number
    status: string
    processedAt: number | null
    txSignature: string | null
    adminReason: string | null
    createdAt: number
    updatedAt: number
    claimIds: string
  }>

  return rows.map((row) => ({
    ...row,
    claimIds: row.claimIds ? row.claimIds.split(',').filter(Boolean) : [],
  }))
}

export function settleClaimRequest({ requestId, status, txSignature, reason }: { requestId: string; status: string; txSignature?: string; reason?: string }) {
  ensureWheelSchema()
  const nextStatus = status.trim().toLowerCase()
  if (nextStatus !== 'claimed' && nextStatus !== 'failed') {
    throw new Error('status must be claimed or failed')
  }
  if (nextStatus === 'claimed' && !txSignature?.trim()) {
    throw new Error('txSignature is required when marking a claim as claimed')
  }

  const now = Date.now()
  const request = db.query(`
    SELECT id, wallet, amount, token, claim_count as claimCount, status, processed_at as processedAt
    FROM claim_requests
    WHERE id = ?
  `).get(requestId) as {
    id: string
    wallet: string
    amount: number
    token: string
    claimCount: number
    status: string
    processedAt: number | null
  } | null

  if (!request) throw new Error('Claim request not found')
  if (request.status !== 'requested') throw new Error('Only requested claim flows can be settled')
  if (request.processedAt) throw new Error('Claim request already settled')

  const claimRows = db.query(`
    SELECT c.id, c.status
    FROM claim_request_items i
    JOIN wheel_claims c ON c.id = i.claim_id
    WHERE i.request_id = ?
  `).all(requestId) as Array<{ id: string; status: string }>

  if (!claimRows.length) throw new Error('Claim request has no linked claim rows')
  if (claimRows.some((row) => row.status !== 'requested')) {
    throw new Error('Claim rows are not all in requested state')
  }

  const normalizedTx = txSignature?.trim() || null
  const normalizedReason = reason?.trim() || null

  db.transaction(() => {
    db.query(`
      UPDATE claim_requests
      SET status = ?, processed_at = ?, tx_signature = ?, admin_reason = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, now, normalizedTx, normalizedReason, now, requestId)

    db.query(`
      UPDATE wheel_claims
      SET status = ?, tx_signature = ?, updated_at = ?
      WHERE id IN (SELECT claim_id FROM claim_request_items WHERE request_id = ?)
    `).run(nextStatus, normalizedTx, now, requestId)
  })()

  return {
    requestId,
    wallet: request.wallet,
    status: nextStatus,
    txSignature: normalizedTx,
    reason: normalizedReason,
    processedAt: now,
    claimCount: claimRows.length,
  }
}

export function getWheelWalletSummary(wallet: string) {
  ensureWheelSchema()
  const synced = syncWalletLedger(wallet)
  const totalRemaining = getTotalRemainingGravity()
  const gravityShare = totalRemaining > 0 ? synced.spendable / totalRemaining : 0

  const latestTreasury = db.query(`
    SELECT token, amount, source, created_at as createdAt
    FROM treasury_snapshots
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as { token: string; amount: number; source: string; createdAt: number } | null

  const claims = db.query(`
    SELECT
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingClaims,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as claimableAmount,
      COUNT(CASE WHEN status = 'requested' THEN 1 END) as requestedClaims,
      COALESCE(SUM(CASE WHEN status = 'requested' THEN amount ELSE 0 END), 0) as requestedAmount
    FROM wheel_claims
    WHERE wallet = ?
  `).get(wallet) as {
    pendingClaims: number
    claimableAmount: number
    requestedClaims: number
    requestedAmount: number
  }

  const latestSpin = db.query(`
    SELECT id, tier_id as tierId, reward_amount as rewardAmount, gravity_share as gravityShare, created_at as createdAt
    FROM wheel_spins
    WHERE wallet = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(wallet) as { id: string; tierId: string; rewardAmount: number; gravityShare: number; createdAt: number } | null

  const latestClaimRequest = db.query(`
    SELECT id, amount, token, claim_count as claimCount, status, processed_at as processedAt,
           tx_signature as txSignature, admin_reason as adminReason, created_at as createdAt
    FROM claim_requests
    WHERE wallet = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(wallet) as {
    id: string
    amount: number
    token: string
    claimCount: number
    status: string
    processedAt: number | null
    txSignature: string | null
    adminReason: string | null
    createdAt: number
  } | null

  return {
    wallet,
    totalEarned: synced.totalEarned,
    totalSpent: synced.totalSpent,
    spendable: synced.spendable,
    stardust: synced.stardust,
    gravityShare,
    totalRemainingGravity: totalRemaining,
    pendingClaims: claims?.pendingClaims || 0,
    claimableAmount: claims?.claimableAmount || 0,
    requestedClaims: claims?.requestedClaims || 0,
    requestedAmount: claims?.requestedAmount || 0,
    minGravityToSpin: MIN_GRAVITY_TO_SPIN,
    rewardToken: 'SOL',
    rewardTiers: WHEEL_TIERS,
    latestSpin,
    latestClaimRequest,
    latestTreasury,
  }
}
