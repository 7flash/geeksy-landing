function shortWallet(wallet: string | null | undefined) {
  if (!wallet) return null
  return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`
}

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-6)}`
}

function signatureMeta(signature: string | null | undefined) {
  const value = (signature || '').trim()
  if (!value) return { length: 0, prefix: null }
  return { length: value.length, prefix: value.slice(0, 12) }
}

export function logWheelEvent(event: string, details: Record<string, unknown>) {
  console.log(`[wheel] ${event}`, JSON.stringify(details))
}

export function wheelRequestMeta(input: {
  wallet?: string | null
  challengeId?: string | null
  requestId?: string | null
  signature?: string | null
}) {
  return {
    wallet: shortWallet(input.wallet),
    challengeId: shortId(input.challengeId),
    requestId: shortId(input.requestId),
    signature: signatureMeta(input.signature),
  }
}
