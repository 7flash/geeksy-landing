import { render } from 'melina/client'

type ExperimentOption = {
  id: string
  label: string
  variants: string[]
}

type ExperimentReport = {
  experimentId: string
  since: number
  until: number
  totals: {
    exposures: number
    clicks: number
    uniqueVisitors: number
    ctr: number
  }
  variants: Array<{
    variantId: string
    exposures: number
    clicks: number
    uniqueVisitors: number
    ctr: number
  }>
  ctas: Array<{
    variantId: string
    ctaId: string | null
    ctaLabel: string | null
    clicks: number
  }>
  daily: Array<{
    day: string
    dayStart: number
    variantId: string
    exposures: number
    clicks: number
    ctr: number
  }>
}

type ReportResponse = {
  ok: boolean
  report?: ExperimentReport
  error?: string
}

const EXPERIMENT_ID_KEY = 'geeksy-admin-experiments:selected-id'
const EXPERIMENT_DAYS_KEY = 'geeksy-admin-experiments:selected-days'
const MIN_COMPARISON_EXPOSURES = 25

function readInitialJson<T>(id: string): T | null {
  const node = document.getElementById(id)
  const text = node?.textContent?.trim()
  if (!text || text === 'null') return null
  try { return JSON.parse(text) as T } catch { return null }
}

function readStorage(key: string) {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function writeStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch {}
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(2)}%`
}

function fmtDeltaPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(2)}%`
}

function fmtDateRange(from: number, to: number) {
  return `${new Date(from).toLocaleString()} → ${new Date(to).toLocaleString()}`
}

function buildVariantComparison(report: ExperimentReport | null) {
  if (!report) return { rows: [], controlVariantId: null as string | null, leaderVariantId: null as string | null, sampleHint: null as string | null }

  const control = report.variants.find((variant) => variant.variantId === 'control') || report.variants[0] || null
  const controlVariantId = control?.variantId || null
  const sampled = report.variants.filter((variant) => variant.exposures >= MIN_COMPARISON_EXPOSURES)
  const leader = sampled.slice().sort((a, b) => b.ctr - a.ctr || b.exposures - a.exposures)[0] || null
  const lowSampleCount = report.variants.filter((variant) => variant.exposures < MIN_COMPARISON_EXPOSURES).length

  return {
    controlVariantId,
    leaderVariantId: leader?.variantId || null,
    sampleHint: lowSampleCount > 0
      ? `${lowSampleCount} variant${lowSampleCount === 1 ? '' : 's'} below ${MIN_COMPARISON_EXPOSURES} exposures — treat results as directional, not decisive.`
      : `All visible variants have at least ${MIN_COMPARISON_EXPOSURES} exposures.` ,
    rows: report.variants.map((variant) => ({
      ...variant,
      deltaVsControl: control ? variant.ctr - control.ctr : null,
      sampleStatus: variant.exposures >= MIN_COMPARISON_EXPOSURES ? 'enough' : 'low',
      isLeader: !!leader && variant.variantId === leader.variantId,
      isControl: !!control && variant.variantId === control.variantId,
    })),
  }
}

function ReportMetricCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <div className="wallet-summary-card">
    <div className="market-card-label">{label}</div>
    <div className="wallet-summary-value">{value}</div>
    <p>{sub}</p>
  </div>
}

function AdminExperimentsApp({
  options,
  experimentId,
  days,
  loading,
  error,
  report,
}: {
  options: ExperimentOption[]
  experimentId: string
  days: string
  loading: boolean
  error: string | null
  report: ExperimentReport | null
}) {
  const comparison = buildVariantComparison(report)
  return <div className="admin-claims-shell">
    <div className="admin-toolbar-card">
      <div className="admin-toolbar-grid admin-experiments-toolbar-grid">
        <div className="admin-field">
          <label htmlFor="admin-experiment-id">Experiment</label>
          <select id="admin-experiment-id" value={experimentId}>
            {options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
          </select>
        </div>
        <div className="admin-field admin-field-status">
          <label htmlFor="admin-experiment-days">Window</label>
          <select id="admin-experiment-days" value={days}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
        <div className="admin-toolbar-actions">
          <button className="btn-primary" id="admin-experiment-load-btn">{loading ? 'Loading…' : 'Load Report'}</button>
          <a className="wheel-secondary-btn admin-link-btn" id="admin-experiment-export-btn" href={`/api/analytics/experiment?experimentId=${encodeURIComponent(experimentId)}&days=${encodeURIComponent(days)}&format=csv`}>Download CSV</a>
        </div>
      </div>
      <p className="admin-toolbar-help">Uses the first-party experiment analytics API. CSV export is suitable for spreadsheet review and operator snapshots.</p>
      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
    </div>

    {!report ? <div className="admin-empty-card">{loading ? 'Loading experiment report…' : 'Load a report to see variant performance.'}</div> : <>
      <div className="admin-queue-header">
        <div>
          <div className="market-card-label">Report summary</div>
          <h3>{report.experimentId}</h3>
        </div>
        <div className="gravity-wallet-state">{fmtDateRange(report.since, report.until)}</div>
      </div>

      <div className="wallet-summary-grid wallet-summary-grid-4">
        <ReportMetricCard label="Exposures" value={report.totals.exposures} sub="Variant impressions recorded." />
        <ReportMetricCard label="Clicks" value={report.totals.clicks} sub="Tracked CTA interactions." />
        <ReportMetricCard label="CTR" value={fmtPct(report.totals.ctr)} sub="Clicks divided by exposures." />
        <ReportMetricCard label="Unique Visitors" value={report.totals.uniqueVisitors} sub="Distinct visitor/session identifiers." />
      </div>

      <div className="admin-toolbar-card">
        <div className="admin-queue-header">
          <div>
            <div className="market-card-label">Variant performance</div>
            <h3>By assigned variant</h3>
          </div>
          <div className="gravity-wallet-state">{report.variants.length} variant{report.variants.length === 1 ? '' : 's'}</div>
        </div>
        {comparison.sampleHint ? <div className="admin-experiment-hint">{comparison.sampleHint}</div> : null}
        {comparison.leaderVariantId ? <div className="admin-experiment-leader">Current leader: <code>{comparison.leaderVariantId}</code>{comparison.controlVariantId ? <> · vs control <code>{comparison.controlVariantId}</code></> : null}</div> : null}
        {!comparison.rows.length ? <div className="admin-empty-card">No experiment events recorded for this window yet.</div> : <div className="holders-table-wrap">
          <table className="holders-table">
            <thead>
              <tr><th>Variant</th><th>Status</th><th>Exposures</th><th>Clicks</th><th>CTR</th><th>Δ vs Control</th><th>Unique Visitors</th></tr>
            </thead>
            <tbody>
              {comparison.rows.map((variant) => <tr key={variant.variantId} className={variant.isLeader ? 'admin-experiment-row-leader' : variant.isControl ? 'admin-experiment-row-control' : ''}>
                <td>
                  <div className="admin-experiment-variant-cell">
                    <code>{variant.variantId}</code>
                    {variant.isLeader ? <span className="admin-experiment-pill admin-experiment-pill-leader">Leader</span> : null}
                    {variant.isControl ? <span className="admin-experiment-pill admin-experiment-pill-control">Control</span> : null}
                  </div>
                </td>
                <td><span className={`admin-experiment-pill ${variant.sampleStatus === 'enough' ? 'admin-experiment-pill-sampled' : 'admin-experiment-pill-low-sample'}`}>{variant.sampleStatus === 'enough' ? 'Sample OK' : 'Low Sample'}</span></td>
                <td>{variant.exposures}</td>
                <td>{variant.clicks}</td>
                <td>{fmtPct(variant.ctr)}</td>
                <td className={variant.deltaVsControl != null ? (variant.deltaVsControl > 0 ? 'admin-delta-pos' : variant.deltaVsControl < 0 ? 'admin-delta-neg' : '') : ''}>{variant.isControl ? 'baseline' : fmtDeltaPct(variant.deltaVsControl)}</td>
                <td>{variant.uniqueVisitors}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </div>

      <div className="admin-toolbar-card">
        <div className="admin-queue-header">
          <div>
            <div className="market-card-label">Trend history</div>
            <h3>Daily variant performance</h3>
          </div>
          <div className="gravity-wallet-state">{report.daily.length} day-row{report.daily.length === 1 ? '' : 's'}</div>
        </div>
        {!report.daily.length ? <div className="admin-empty-card">No daily trend rows recorded for this window yet.</div> : <div className="holders-table-wrap">
          <table className="holders-table">
            <thead>
              <tr><th>Day</th><th>Variant</th><th>Exposures</th><th>Clicks</th><th>CTR</th></tr>
            </thead>
            <tbody>
              {report.daily.map((row, index) => <tr key={`${row.day}:${row.variantId}:${index}`}>
                <td><code>{row.day}</code></td>
                <td><code>{row.variantId}</code></td>
                <td>{row.exposures}</td>
                <td>{row.clicks}</td>
                <td>{fmtPct(row.ctr)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </div>

      <div className="admin-toolbar-card">
        <div className="admin-queue-header">
          <div>
            <div className="market-card-label">CTA breakdown</div>
            <h3>Clicks by CTA</h3>
          </div>
          <div className="gravity-wallet-state">{report.ctas.length} CTA row{report.ctas.length === 1 ? '' : 's'}</div>
        </div>
        {!report.ctas.length ? <div className="admin-empty-card">No CTA clicks recorded for this window yet.</div> : <div className="holders-table-wrap">
          <table className="holders-table">
            <thead>
              <tr><th>Variant</th><th>CTA</th><th>Label</th><th>Clicks</th></tr>
            </thead>
            <tbody>
              {report.ctas.map((cta, index) => <tr key={`${cta.variantId}:${cta.ctaId || 'none'}:${index}`}>
                <td><code>{cta.variantId}</code></td>
                <td><code>{cta.ctaId || '—'}</code></td>
                <td>{cta.ctaLabel || '—'}</td>
                <td>{cta.clicks}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </div>
    </>}
  </div>
}

export default function mount() {
  const root = document.getElementById('admin-experiments-root')
  if (!root) return

  const options = readInitialJson<ExperimentOption[]>('admin-experiment-options') || []
  const storedExperimentId = readStorage(EXPERIMENT_ID_KEY)
  const storedDays = readStorage(EXPERIMENT_DAYS_KEY)
  let experimentId = options.some((option) => option.id === storedExperimentId) ? storedExperimentId! : (options[0]?.id || 'hero-cta-v1')
  let days = ['7', '14', '30', '90'].includes(storedDays || '') ? storedDays! : '30'
  let loading = false
  let error: string | null = null
  let report: ExperimentReport | null = null

  const renderAll = () => {
    render(<AdminExperimentsApp options={options} experimentId={experimentId} days={days} loading={loading} error={error} report={report} />, root)

    const experimentSelect = document.getElementById('admin-experiment-id') as HTMLSelectElement | null
    if (experimentSelect) experimentSelect.onchange = () => {
      experimentId = experimentSelect.value
      writeStorage(EXPERIMENT_ID_KEY, experimentId)
      renderAll()
    }

    const daysSelect = document.getElementById('admin-experiment-days') as HTMLSelectElement | null
    if (daysSelect) daysSelect.onchange = () => {
      days = daysSelect.value
      writeStorage(EXPERIMENT_DAYS_KEY, days)
      renderAll()
    }

    const loadBtn = document.getElementById('admin-experiment-load-btn') as HTMLButtonElement | null
    if (loadBtn) loadBtn.onclick = () => { void loadReport() }
  }

  const loadReport = async () => {
    loading = true
    error = null
    renderAll()
    try {
      const res = await fetch(`/api/analytics/experiment?experimentId=${encodeURIComponent(experimentId)}&days=${encodeURIComponent(days)}`)
      const json = await res.json() as ReportResponse
      if (!res.ok || !json.ok || !json.report) throw new Error(json.error || 'Failed to load experiment report')
      report = json.report
    } catch (err: any) {
      report = null
      error = err?.message || 'Failed to load experiment report'
    } finally {
      loading = false
      renderAll()
    }
  }

  renderAll()
  void loadReport()

  return () => render(null, root)
}
