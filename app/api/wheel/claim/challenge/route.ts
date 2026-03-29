import { logWheelEvent, wheelRequestMeta } from '../../../../../lib/wheel-log'
import { createClaimRequest } from '../../../../../lib/wheel'

export async function POST(req: Request) {
  let wallet = ''
  try {
    const body = await req.json() as { wallet?: string }
    wallet = (body.wallet || '').trim()

    if (!wallet) {
      logWheelEvent('claim_challenge.bad_request', wheelRequestMeta({ wallet }))
      return Response.json({ ok: false, error: 'wallet is required' }, { status: 400 })
    }

    const result = createClaimRequest(wallet)
    logWheelEvent('claim_challenge.created', {
      ...wheelRequestMeta({ wallet, requestId: result.requestId }),
      amount: Number(result.amount.toFixed(6)),
      claimCount: result.claimCount,
      expiresAt: result.expiresAt,
    })
    return Response.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Failed to create claim request'
    const status = /wallet is required|No pending rewards|mixed reward tokens/.test(message) ? 400 : 500
    logWheelEvent('claim_challenge.error', { ...wheelRequestMeta({ wallet }), status, message })
    return Response.json({ ok: false, error: message }, { status })
  }
}
