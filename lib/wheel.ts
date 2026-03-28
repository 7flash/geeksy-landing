import { createHash, randomUUID } from 'crypto'
import { db } from './db'

const encoder = new TextEncoder()

export const WHEEL_SPEND_AMOUNT = Number(process.env.WHEEL_SPEND_AMOUNT || 100)
export const WHEEL_CHALLENGE_TTL_MS = Number(process.env.WHEEL_CHALLENGE_TTL_MS || 5 * 60 * 1000)
export const TREASURY_REWARD_TOKEN = process.env.TREASURY_REWARD_TOKEN || 'USDC'
export const TREASURY_SOURCE = process.env.TREASURY_SOURCE || 'env'
export const TREASURY_AMOUNT = Number(process.env.TREASURY_AMOUNT || 0)

export const WHEEL_TIERS = [
  { id: 'dust', probability: 0.45, rewardBps: 5 },
  { id: 'small', probability: 0.28, rewardBps: 10 },
  { id: 'medium', probability: 0.15, rewardBps: 25 },
  { id: 'large', probability: 0.08, rewardBps: 50 },
  { id: 'mega', probability: 0.03, rewardBps: 100 },
  { id: 'cosmic', probability: 0.01, rewardBps: 250 },
] as const

export function ensureWheelSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_gravity_ledger (
      wallet TEXT PRIMARY KEY,
      total_earned REAL NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
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
  `)
}

export function getWalletGravity(wallet: string) {
  const row = db.query(`
    SELECT 
      COALESCE(g.points, 0) as totalEarned,
      COALESCE(l.total_spent, 0) as totalSpent,
      COALESCE(g.points, 0) - COALESCE(l.total_spent, 0) as spendable,
      COALESCE(g.last_credited_at, 0) as lastUpdated
    FROM (SELECT ? as wallet) w
    LEFT JOIN gravity_points g ON g.wallet = w.wallet
    LEFT JOIN wallet_gravity_ledger l ON l.wallet = w.wallet
  `).get(wallet) as { totalEarned: number; totalSpent: number; spendable: number; lastUpdated: number }

  return {
    totalEarned: row?.totalEarned || 0,
    totalSpent: row?.totalSpent || 0,
    spendable: row?.spendable || 0,
    lastUpdated: row?.lastUpdated || 0,
  }
}

export function syncWalletLedger(wallet: string, now = Date.now()) {
  const current = getWalletGravity(wallet)
  db.query(`
    INSERT INTO wallet_gravity_ledger (wallet, total_earned, total_spent, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(wallet) DO UPDATE SET
      total_earned = excluded.total_earned,
      updated_at = excluded.updated_at
  `).run(wallet, current.totalEarned, current.totalSpent, now)
  return getWalletGravity(wallet)
}

export function createTreasurySnapshot(now = Date.now()) {
  const id = randomUUID()
  db.query(`INSERT INTO treasury_snapshots (id, token, amount, source, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    TREASURY_REWARD_TOKEN,
    TREASURY_AMOUNT,
    TREASURY_SOURCE,
    now,
  )
  return { id, token: TREASURY_REWARD_TOKEN, amount: TREASURY_AMOUNT, source: TREASURY_SOURCE, createdAt: now }
}

export function buildSpinMessage(wallet: string, challengeId: string, nonce: string, spendAmount: number, expiresAt: number) {
  return [
    'Spin Gravity Wheel',
    `wallet=${wallet}`,
    `challengeId=${challengeId}`,
    `nonce=${nonce}`,
    `spend=${spendAmount}`,
    `expiresAt=${expiresAt}`,
  ].join('\n')
}

export function createChallenge(wallet: string) {
  ensureWheelSchema()
  const now = Date.now()
  const synced = syncWalletLedger(wallet, now)
  if (synced.spendable < WHEEL_SPEND_AMOUNT) {
    throw new Error(`Insufficient spendable gravity. Need ${WHEEL_SPEND_AMOUNT}, have ${Math.max(0, synced.spendable).toFixed(2)}`)
  }

  const challengeId = randomUUID()
  const nonce = randomUUID()
  const expiresAt = now + WHEEL_CHALLENGE_TTL_MS
  const treasurySnapshot = createTreasurySnapshot(now)
  const message = buildSpinMessage(wallet, challengeId, nonce, WHEEL_SPEND_AMOUNT, expiresAt)

  db.query(`
    INSERT INTO wheel_challenges (id, wallet, nonce, spend_amount, expires_at, treasury_snapshot_id, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(challengeId, wallet, nonce, WHEEL_SPEND_AMOUNT, expiresAt, treasurySnapshot.id, message, now)

  return {
    challengeId,
    wallet,
    nonce,
    spendAmount: WHEEL_SPEND_AMOUNT,
    expiresAt,
    message,
    treasurySnapshot,
    spendableBefore: synced.spendable,
  }
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

function chooseTier(randomFloat: number) {
  let cursor = 0
  for (const tier of WHEEL_TIERS) {
    cursor += tier.probability
    if (randomFloat <= cursor) return tier
  }
  return WHEEL_TIERS[WHEEL_TIERS.length - 1]
}

function b64ToBytes(value: string) {
  return Uint8Array.from(Buffer.from(value, 'base64'))
}

function base58Decode(input: string) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const base = 58
  const bytes = [0]
  for (const char of input) {
    const value = alphabet.indexOf(char)
    if (value < 0) throw new Error('Invalid base58 string')
    let carry = value
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
  for (const char of input) {
    if (char === '1') bytes.push(0)
    else break
  }
  return Uint8Array.from(bytes.reverse())
}

export async function verifyWalletSignature(wallet: string, message: string, signatureB64: string) {
  const publicKeyRaw = base58Decode(wallet)
  const signature = b64ToBytes(signatureB64)
  const key = await crypto.subtle.importKey('raw', publicKeyRaw, { name: 'Ed25519' }, false, ['verify'])
  return await crypto.subtle.verify('Ed25519', key, signature, encoder.encode(message))
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
  if (before.spendable < challenge.spend_amount) {
    throw new Error(`Insufficient spendable gravity. Need ${challenge.spend_amount}, have ${Math.max(0, before.spendable).toFixed(2)}`)
  }

  const rngHash = sha256Hex([process.env.WHEEL_SERVER_SEED || 'dev-seed', wallet, challenge.id, challenge.nonce, String(now)].join('|'))
  const randomFloat = parseInt(rngHash.slice(0, 12), 16) / 0xffffffffffff
  const tier = chooseTier(randomFloat)
  const rewardAmount = treasury.amount * (tier.rewardBps / 10_000)
  const afterSpent = before.totalSpent + challenge.spend_amount
  const afterSpendable = before.totalEarned - afterSpent
  const spinId = randomUUID()
  const claimId = randomUUID()

  db.transaction(() => {
    db.query(`UPDATE wheel_challenges SET used_at = ? WHERE id = ?`).run(now, challenge.id)
    db.query(`
      INSERT INTO wallet_gravity_ledger (wallet, total_earned, total_spent, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(wallet) DO UPDATE SET
        total_earned = excluded.total_earned,
        total_spent = excluded.total_spent,
        updated_at = excluded.updated_at
    `).run(wallet, before.totalEarned, afterSpent, now)

    db.query(`
      INSERT INTO wheel_spins (
        id, wallet, challenge_id, spend_amount, wallet_gravity_before, wallet_gravity_after,
        tier_id, reward_bps, treasury_snapshot_id, treasury_amount_at_spin, reward_amount,
        signature, rng_hash, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      spinId,
      wallet,
      challenge.id,
      challenge.spend_amount,
      before.spendable,
      afterSpendable,
      tier.id,
      tier.rewardBps,
      treasury.id,
      treasury.amount,
      rewardAmount,
      signature,
      rngHash,
      'settled',
      now,
    )

    db.query(`
      INSERT INTO wheel_claims (id, spin_id, wallet, amount, token, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(claimId, spinId, wallet, rewardAmount, treasury.token, rewardAmount > 0 ? 'pending' : 'void', now, now)
  })()

  return {
    spinId,
    claimId,
    wallet,
    spendAmount: challenge.spend_amount,
    gravityBefore: before.spendable,
    gravityAfter: afterSpendable,
    reward: {
      tier: tier.id,
      rewardBps: tier.rewardBps,
      treasuryAmount: treasury.amount,
      rewardAmount,
      token: treasury.token,
      source: treasury.source,
    },
    rngHash,
  }
}

export function getWheelWalletSummary(wallet: string) {
  ensureWheelSchema()
  const synced = syncWalletLedger(wallet)
  const claims = db.query(`
    SELECT COUNT(*) as pendingClaims, COALESCE(SUM(amount), 0) as claimableAmount
    FROM wheel_claims
    WHERE wallet = ? AND status = 'pending'
  `).get(wallet) as { pendingClaims: number; claimableAmount: number }

  const latestSpin = db.query(`
    SELECT id, tier_id as tierId, reward_amount as rewardAmount, created_at as createdAt
    FROM wheel_spins
    WHERE wallet = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(wallet) as { id: string; tierId: string; rewardAmount: number; createdAt: number } | null

  return {
    wallet,
    totalEarned: synced.totalEarned,
    totalSpent: synced.totalSpent,
    spendable: synced.spendable,
    pendingClaims: claims?.pendingClaims || 0,
    claimableAmount: claims?.claimableAmount || 0,
    wheelSpendAmount: WHEEL_SPEND_AMOUNT,
    rewardToken: TREASURY_REWARD_TOKEN,
    rewardTiers: WHEEL_TIERS,
    latestSpin,
  }
}
