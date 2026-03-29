import { logWheelEvent, wheelRequestMeta } from '../../../../lib/wheel-log'
import { createChallenge } from '../../../../lib/wheel'

export async function POST(req: Request) {
  let wallet = ''
  try {
    const body = await req.json() as { wallet?: string }
    wallet = (body.wallet || '').trim()

    if (!wallet) {
      logWheelEvent('challenge.bad_request', wheelRequestMeta({ wallet }))
      return Response.json({ ok: false, error: 'wallet is required' }, { status: 400 })
    }

    const challenge = await createChallenge(wallet)
    logWheelEvent('challenge.created', {
      ...wheelRequestMeta({ wallet, challengeId: challenge.challengeId }),
      spendAmount: Number(challenge.spendAmount.toFixed(4)),
      expiresAt: challenge.expiresAt,
      treasuryAmount: Number(challenge.treasurySnapshot.amount.toFixed(6)),
    })
    return Response.json({ ok: true, ...challenge })
  } catch (error: any) {
    const message = error?.message || 'Failed to create challenge'
    const status = message.includes('Insufficient spendable gravity') ? 400 : 500
    logWheelEvent('challenge.error', { ...wheelRequestMeta({ wallet }), status, message })
    return Response.json({ ok: false, error: message }, { status })
  }
}
