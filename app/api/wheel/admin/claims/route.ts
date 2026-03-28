import { getAdminClaimRequests } from '../../../../../lib/wheel'
import { requireWheelAdmin } from '../_auth'

export async function GET(req: Request) {
  try {
    if (!requireWheelAdmin(req)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const status = (url.searchParams.get('status') || 'requested').trim()
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200)

    return Response.json({ ok: true, requests: getAdminClaimRequests(status, limit) })
  } catch (error: any) {
    const message = error?.message || 'Failed to load admin claim requests'
    const statusCode = /not configured/.test(message) ? 500 : 500
    return Response.json({ ok: false, error: message }, { status: statusCode })
  }
}
