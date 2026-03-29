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

export type ExperimentTrendGroupBy = 'day' | 'week'

export type ExperimentTrendReportRow = {
  label: string
  periodStart: number
  variantId: string
  exposures: number
  clicks: number
  ctr: number
}

export type ExperimentReport = {
  experimentId: string
  since: number
  until: number
  groupBy: ExperimentTrendGroupBy
  totals: {
    exposures: number
    clicks: number
    uniqueVisitors: number
    ctr: number
  }
  variants: ExperimentVariantReportRow[]
  ctas: ExperimentCtaReportRow[]
  trend: ExperimentTrendReportRow[]
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

export function getExperimentReport(experimentId: string, { since = 0, until = Date.now(), groupBy = 'day' }: { since?: number; until?: number; groupBy?: ExperimentTrendGroupBy } = {}): ExperimentReport {
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

  const trendSql = groupBy === 'week'
    ? `
      SELECT
        (strftime('%Y', created_at / 1000, 'unixepoch') || '-W' || printf('%02d', CAST(strftime('%W', created_at / 1000, 'unixepoch') AS INTEGER))) as label,
        (CAST(strftime('%s', date(created_at / 1000, 'unixepoch', 'weekday 1', '-7 days')) AS INTEGER) * 1000) as periodStart,
        variant_id as variantId,
        COUNT(CASE WHEN event_type = 'exposure' THEN 1 END) as exposures,
        COUNT(CASE WHEN event_type = 'click' THEN 1 END) as clicks
      FROM experiment_events
      WHERE experiment_id = ? AND created_at >= ? AND created_at <= ?
      GROUP BY label, periodStart, variant_id
      ORDER BY periodStart DESC, variant_id ASC
    `
    : `
      SELECT
        strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') as label,
        (CAST(strftime('%s', strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') || ' 00:00:00') AS INTEGER) * 1000) as periodStart,
        variant_id as variantId,
        COUNT(CASE WHEN event_type = 'exposure' THEN 1 END) as exposures,
        COUNT(CASE WHEN event_type = 'click' THEN 1 END) as clicks
      FROM experiment_events
      WHERE experiment_id = ? AND created_at >= ? AND created_at <= ?
      GROUP BY label, periodStart, variant_id
      ORDER BY periodStart DESC, variant_id ASC
    `

  const trend = db.query(trendSql).all(experimentId, since, until) as Array<{
    label: string
    periodStart: number
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
    groupBy,
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
    trend: trend.map((row) => ({
      label: row.label,
      periodStart: Number(row.periodStart || 0),
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
    ...report.trend.map((row) => `trend:${report.groupBy},${report.experimentId},${row.variantId},${row.label},,${row.exposures},${row.clicks},,${row.ctr},${row.periodStart},${row.periodStart}`),
  ]
  return lines.join('\n')
}

function escapeCsv(value: string) {
  if (!/[",\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}
