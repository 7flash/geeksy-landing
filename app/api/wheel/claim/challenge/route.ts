import { createClaimRequest } from '../../../../../lib/wheel'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { wallet?: string }
    const wallet = (body.wallet || '').trim()

    if (!wallet) {
      return Response.json({ ok: false, error: 'wallet is required' }, { status: 400 })
    }

    const result = createClaimRequest(wallet)
    return Response.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Failed to create claim request'
    const status = /wallet is required|No pending rewards|mixed reward tokens/.test(message) ? 400 : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
