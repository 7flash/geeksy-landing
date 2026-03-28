import { settleClaimRequest } from '../../../../../../lib/wheel'
import { requireWheelAdmin } from '../../_auth'

export async function POST(req: Request) {
  try {
    if (!requireWheelAdmin(req)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      requestId?: string
      status?: string
      txSignature?: string
      reason?: string
    }

    const requestId = (body.requestId || '').trim()
    const status = (body.status || '').trim()
    const txSignature = (body.txSignature || '').trim()
    const reason = (body.reason || '').trim()

    if (!requestId || !status) {
      return Response.json({ ok: false, error: 'requestId and status are required' }, { status: 400 })
    }

    const result = settleClaimRequest({ requestId, status, txSignature, reason })
    return Response.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Failed to settle claim request'
    const statusCode = /required|not found|already|Only requested|txSignature/.test(message) ? 400 : 500
    return Response.json({ ok: false, error: message }, { status: statusCode })
  }
}
