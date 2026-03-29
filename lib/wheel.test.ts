import { describe, expect, test } from 'bun:test'
import { verifyWalletSignature } from './wheel'

const encoder = new TextEncoder()

function bytesToBase58(bytes: Uint8Array) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      const value = digits[i]! * 256 + carry
      digits[i] = value % 58
      carry = Math.floor(value / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  let result = ''
  for (const byte of bytes) {
    if (byte === 0) result += '1'
    else break
  }
  for (let i = digits.length - 1; i >= 0; i--) result += alphabet[digits[i]!]
  return result
}

async function makeSignedMessage() {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const wallet = bytesToBase58(publicKey)
  const message = 'Spin Gravity Wheel — Burn All Gravity\nwallet=test\nchallengeId=123\nnonce=456\nspend=10.0000\nexpiresAt=9999999999999'
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', pair.privateKey, encoder.encode(message)))
  return { wallet, message, signature }
}

describe('verifyWalletSignature', () => {
  test('accepts base64 signatures', async () => {
    const { wallet, message, signature } = await makeSignedMessage()
    const ok = await verifyWalletSignature(wallet, message, Buffer.from(signature).toString('base64'))
    expect(ok).toBe(true)
  })

  test('accepts base64url signatures', async () => {
    const { wallet, message, signature } = await makeSignedMessage()
    const base64url = Buffer.from(signature).toString('base64url')
    const ok = await verifyWalletSignature(wallet, message, base64url)
    expect(ok).toBe(true)
  })

  test('accepts hex signatures', async () => {
    const { wallet, message, signature } = await makeSignedMessage()
    const ok = await verifyWalletSignature(wallet, message, Buffer.from(signature).toString('hex'))
    expect(ok).toBe(true)
  })

  test('accepts base58 signatures', async () => {
    const { wallet, message, signature } = await makeSignedMessage()
    const ok = await verifyWalletSignature(wallet, message, bytesToBase58(signature))
    expect(ok).toBe(true)
  })

  test('rejects malformed signatures with a clear error', async () => {
    const { wallet, message } = await makeSignedMessage()
    await expect(verifyWalletSignature(wallet, message, 'not-a-real-signature')).rejects.toThrow('Invalid wallet signature encoding')
  })
})
