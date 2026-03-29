import { logWheelEvent, wheelRequestMeta } from '../../../../lib/wheel-log'
import { consumeClaimRequest } from '../../../../lib/wheel'

export async function POST(req: Request) {
  let wallet = ''
  let requestId = ''
  let signature = ''
  try {
    const body = await req.json() as { wallet?: string; requestId?: string; signature?: string }
    wallet = (body.wallet || '').trim()
    requestId = (body.requestId || '').trim()
    signature = (body.signature || '').trim()

    if (!wallet || !requestId || !signature) {
      logWheelEvent('claim.bad_request', wheelRequestMeta({ wallet, requestId, signature }))
      return Response.json({ ok: false, error: 'wallet, requestId, and signature are required' }, { status: 400 })
    }

    const result = await consumeClaimRequest(wallet, requestId, signature)
    logWheelEvent('claim.success', {
      ...wheelRequestMeta({ wallet, requestId, signature }),
      amount: Number(result.amount.toFixed(6)),
      claimCount: result.claimCount,
      requestedAt: result.requestedAt,
    })
    return Response.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Failed to submit claim request'
    const status = /Wallet mismatch|expired|signature|No pending rewards|already used|no longer claimable|mismatch|not found|public key|encoding/i.test(message) ? 400 : 500
    logWheelEvent('claim.error', { ...wheelRequestMeta({ wallet, requestId, signature }), status, message })
    return Response.json({ ok: false, error: message }, { status })
  }
}
