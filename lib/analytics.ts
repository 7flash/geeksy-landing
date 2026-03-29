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
