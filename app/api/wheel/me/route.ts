import { getWheelWalletSummary } from '../../../../lib/wheel'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const wallet = (url.searchParams.get('wallet') || '').trim()

  if (!wallet) {
    return Response.json({ ok: false, error: 'wallet is required' }, { status: 400 })
  }

  try {
    return Response.json({ ok: true, ...getWheelWalletSummary(wallet) })
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to load wallet summary' }, { status: 500 })
  }
}
