import { recordExperimentEvent } from '../../../../lib/analytics'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      experimentId?: string
      variantId?: string
      eventType?: 'exposure' | 'click'
      ctaId?: string
      ctaLabel?: string
      path?: string
      referrer?: string
      sessionId?: string
      visitorId?: string
      createdAt?: number
    }

    const experimentId = (body.experimentId || '').trim()
    const variantId = (body.variantId || '').trim()
    const eventType = body.eventType

    if (!experimentId || !variantId || (eventType !== 'exposure' && eventType !== 'click')) {
      return Response.json({ ok: false, error: 'experimentId, variantId, and valid eventType are required' }, { status: 400 })
    }

    const result = recordExperimentEvent({
      experimentId,
      variantId,
      eventType,
      ctaId: (body.ctaId || '').trim() || null,
      ctaLabel: (body.ctaLabel || '').trim() || null,
      path: (body.path || '').trim() || null,
      referrer: (body.referrer || '').trim() || null,
      sessionId: (body.sessionId || '').trim() || null,
      visitorId: (body.visitorId || '').trim() || null,
      userAgent: req.headers.get('user-agent'),
      createdAt: typeof body.createdAt === 'number' ? body.createdAt : Date.now(),
    })

    return Response.json({ ok: true, id: result.id, createdAt: result.createdAt })
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to record experiment event' }, { status: 500 })
  }
}
