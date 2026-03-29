import { consumeSpinChallenge } from '../../../../lib/wheel'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { wallet?: string; challengeId?: string; signature?: string }
    const wallet = (body.wallet || '').trim()
    const challengeId = (body.challengeId || '').trim()
    const signature = (body.signature || '').trim()

    if (!wallet || !challengeId || !signature) {
      return Response.json({ ok: false, error: 'wallet, challengeId, and signature are required' }, { status: 400 })
    }

    const result = await consumeSpinChallenge(wallet, challengeId, signature)
    return Response.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Failed to spin wheel'
    const status = /Challenge|Wallet mismatch|expired|signature|Insufficient|public key|encoding/i.test(message) ? 400 : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
