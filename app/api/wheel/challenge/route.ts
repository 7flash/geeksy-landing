import { createChallenge } from '../../../../lib/wheel'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { wallet?: string }
    const wallet = (body.wallet || '').trim()

    if (!wallet) {
      return Response.json({ ok: false, error: 'wallet is required' }, { status: 400 })
    }

    const challenge = createChallenge(wallet)
    return Response.json({ ok: true, ...challenge })
  } catch (error: any) {
    const message = error?.message || 'Failed to create challenge'
    const status = message.includes('Insufficient spendable gravity') ? 400 : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
