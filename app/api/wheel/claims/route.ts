import { getClaimHistory } from '../../../../lib/wheel'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const wallet = (url.searchParams.get('wallet') || '').trim()
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100)

    if (!wallet) {
      return Response.json({ ok: false, error: 'wallet is required' }, { status: 400 })
    }

    return Response.json({ ok: true, claims: getClaimHistory(wallet, limit) })
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to load claim history' }, { status: 500 })
  }
}
