import { consumeClaimRequest } from '../../../../lib/wheel'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { wallet?: string; requestId?: string; signature?: string }
    const wallet = (body.wallet || '').trim()
    const requestId = (body.requestId || '').trim()
    const signature = (body.signature || '').trim()

    if (!wallet || !requestId || !signature) {
      return Response.json({ ok: false, error: 'wallet, requestId, and signature are required' }, { status: 400 })
    }

    const result = await consumeClaimRequest(wallet, requestId, signature)
    return Response.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Failed to submit claim request'
    const status = /Wallet mismatch|expired|signature|No pending rewards|already used|no longer claimable|mismatch|not found/.test(message) ? 400 : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
