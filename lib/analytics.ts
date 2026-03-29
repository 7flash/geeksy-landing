import { randomUUID } from 'crypto'
import { db } from './db'

export type ExperimentEventInput = {
  experimentId: string
  variantId: string
  eventType: 'exposure' | 'click'
  ctaId?: string | null
  ctaLabel?: string | null
  path?: string | null
  referrer?: string | null
  sessionId?: string | null
  visitorId?: string | null
  userAgent?: string | null
  createdAt?: number
}

export type ExperimentVariantReportRow = {
  variantId: string
  exposures: number
  clicks: number
  uniqueVisitors: number
  ctr: number
}

export type ExperimentCtaReportRow = {
  variantId: string
  ctaId: string | null
  ctaLabel: string | null
  clicks: number
}

export type ExperimentDailyReportRow = {
  day: string
  dayStart: number
  variantId: string
  exposures: number
  clicks: number
  ctr: number
}

export type ExperimentReport = {
  experimentId: string
  since: number
  until: number
  totals: {
    exposures: number
    clicks: number
    uniqueVisitors: number
    ctr: number
  }
  variants: ExperimentVariantReportRow[]
  ctas: ExperimentCtaReportRow[]
  daily: ExperimentDailyReportRow[]
}

export function recordExperimentEvent(input: ExperimentEventInput) {
  const createdAt = input.createdAt || Date.now()
  const id = randomUUID()

  db.query(`
    INSERT INTO experiment_events (
      id, experiment_id, variant_id, event_type,
      cta_id, cta_label, path, referrer,
      session_id, visitor_id, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.experimentId,
    input.variantId,
    input.eventType,
    input.ctaId || null,
    input.ctaLabel || null,
    input.path || null,
    input.referrer || null,
    input.sessionId || null,
    input.visitorId || null,
    input.userAgent || null,
    createdAt,
  )

  return { id, createdAt }
}

export function getExperimentReport(experimentId: string, { since = 0, until = Date.now() }: { since?: number; until?: number } = {}): ExperimentReport {
  const totals = db.query(`
    SELECT
      COUNT(CASE WHEN event_type = 'exposure' THEN 1 END) as exposures,
      COUNT(CASE WHEN event_type = 'click' THEN 1 END) as clicks,
      COUNT(DISTINCT COALESCE(visitor_id, session_id, id)) as uniqueVisitors
    FROM experiment_events
    WHERE experiment_id = ? AND created_at >= ? AND created_at <= ?
  `).get(experimentId, since, until) as {
    exposures: number
    clicks: number
    uniqueVisitors: number
  }

  const variants = db.query(`
    SELECT
      variant_id as variantId,
      COUNT(CASE WHEN event_type = 'exposure' THEN 1 END) as exposures,
      COUNT(CASE WHEN event_type = 'click' THEN 1 END) as clicks,
      COUNT(DISTINCT COALESCE(visitor_id, session_id, id)) as uniqueVisitors
    FROM experiment_events
    WHERE experiment_id = ? AND created_at >= ? AND created_at <= ?
    GROUP BY variant_id
    ORDER BY exposures DESC, clicks DESC, variant_id ASC
  `).all(experimentId, since, until) as Array<{
    variantId: string
    exposures: number
    clicks: number
    uniqueVisitors: number
  }>

  const ctas = db.query(`
    SELECT
      variant_id as variantId,
      cta_id as ctaId,
      cta_label as ctaLabel,
      COUNT(*) as clicks
    FROM experiment_events
    WHERE experiment_id = ? AND event_type = 'click' AND created_at >= ? AND created_at <= ?
    GROUP BY variant_id, cta_id, cta_label
    ORDER BY clicks DESC, variant_id ASC, cta_id ASC
  `).all(experimentId, since, until) as ExperimentCtaReportRow[]

  const daily = db.query(`
    SELECT
      strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') as day,
      (CAST(strftime('%s', strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') || ' 00:00:00') AS INTEGER) * 1000) as dayStart,
      variant_id as variantId,
      COUNT(CASE WHEN event_type = 'exposure' THEN 1 END) as exposures,
      COUNT(CASE WHEN event_type = 'click' THEN 1 END) as clicks
    FROM experiment_events
    WHERE experiment_id = ? AND created_at >= ? AND created_at <= ?
    GROUP BY day, dayStart, variant_id
    ORDER BY dayStart DESC, variant_id ASC
  `).all(experimentId, since, until) as Array<{
    day: string
    dayStart: number
    variantId: string
    exposures: number
    clicks: number
  }>

  const totalExposures = Number(totals?.exposures || 0)
  const totalClicks = Number(totals?.clicks || 0)

  return {
    experimentId,
    since,
    until,
    totals: {
      exposures: totalExposures,
      clicks: totalClicks,
      uniqueVisitors: Number(totals?.uniqueVisitors || 0),
      ctr: totalExposures > 0 ? totalClicks / totalExposures : 0,
    },
    variants: variants.map((row) => ({
      variantId: row.variantId,
      exposures: Number(row.exposures || 0),
      clicks: Number(row.clicks || 0),
      uniqueVisitors: Number(row.uniqueVisitors || 0),
      ctr: Number(row.exposures || 0) > 0 ? Number(row.clicks || 0) / Number(row.exposures || 0) : 0,
    })),
    ctas,
    daily: daily.map((row) => ({
      day: row.day,
      dayStart: Number(row.dayStart || 0),
      variantId: row.variantId,
      exposures: Number(row.exposures || 0),
      clicks: Number(row.clicks || 0),
      ctr: Number(row.exposures || 0) > 0 ? Number(row.clicks || 0) / Number(row.exposures || 0) : 0,
    })),
  }
}

export function toExperimentReportCsv(report: ExperimentReport) {
  const lines = [
    'section,experimentId,variantId,ctaId,ctaLabel,exposures,clicks,uniqueVisitors,ctr,since,until',
    `totals,${report.experimentId},,,,${report.totals.exposures},${report.totals.clicks},${report.totals.uniqueVisitors},${report.totals.ctr},${report.since},${report.until}`,
    ...report.variants.map((row) => `variant,${report.experimentId},${row.variantId},,,${row.exposures},${row.clicks},${row.uniqueVisitors},${row.ctr},${report.since},${report.until}`),
    ...report.ctas.map((row) => `cta,${report.experimentId},${row.variantId},${row.ctaId || ''},${escapeCsv(row.ctaLabel || '')},,${row.clicks},,,${report.since},${report.until}`),
    ...report.daily.map((row) => `daily,${report.experimentId},${row.variantId},${row.day},,${row.exposures},${row.clicks},,${row.ctr},${row.dayStart},${row.dayStart}`),
  ]
  return lines.join('\n')
}

function escapeCsv(value: string) {
  if (!/[",\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}
