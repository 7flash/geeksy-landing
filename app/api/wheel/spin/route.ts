import { logWheelEvent, wheelRequestMeta } from '../../../../lib/wheel-log'
import { consumeSpinChallenge } from '../../../../lib/wheel'

export async function POST(req: Request) {
  let wallet = ''
  let challengeId = ''
  let signature = ''
  try {
    const body = await req.json() as { wallet?: string; challengeId?: string; signature?: string }
    wallet = (body.wallet || '').trim()
    challengeId = (body.challengeId || '').trim()
    signature = (body.signature || '').trim()

    if (!wallet || !challengeId || !signature) {
      logWheelEvent('spin.bad_request', wheelRequestMeta({ wallet, challengeId, signature }))
      return Response.json({ ok: false, error: 'wallet, challengeId, and signature are required' }, { status: 400 })
    }

    const result = await consumeSpinChallenge(wallet, challengeId, signature)
    logWheelEvent('spin.success', {
      ...wheelRequestMeta({ wallet, challengeId, signature }),
      spendAmount: Number(result.spendAmount.toFixed(4)),
      rewardTier: result.reward.tier,
      rewardAmount: Number(result.reward.rewardAmount.toFixed(6)),
      gravityShare: Number(result.gravityShare.toFixed(6)),
    })
    return Response.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Failed to spin wheel'
    const status = /Challenge|Wallet mismatch|expired|signature|Insufficient|public key|encoding/i.test(message) ? 400 : 500
    logWheelEvent('spin.error', { ...wheelRequestMeta({ wallet, challengeId, signature }), status, message })
    return Response.json({ ok: false, error: message }, { status })
  }
}
