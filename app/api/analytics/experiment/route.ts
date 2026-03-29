import { getExperimentReport, recordExperimentEvent, toExperimentReportCsv, type ExperimentTrendGroupBy } from '../../../../lib/analytics'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const experimentId = (url.searchParams.get('experimentId') || '').trim()
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365)
    const format = (url.searchParams.get('format') || 'json').trim()
    const groupBy = ((url.searchParams.get('groupBy') || 'day').trim() === 'week' ? 'week' : 'day') as ExperimentTrendGroupBy
    if (!experimentId) {
      return Response.json({ ok: false, error: 'experimentId is required' }, { status: 400 })
    }

    const until = Date.now()
    const since = until - (days * 24 * 60 * 60 * 1000)
    const report = getExperimentReport(experimentId, { since, until, groupBy })

    if (format === 'csv') {
      return new Response(toExperimentReportCsv(report), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${experimentId}-experiment-report.csv"`,
        },
      })
    }

    return Response.json({ ok: true, report })
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || 'Failed to load experiment report' }, { status: 500 })
  }
}

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
