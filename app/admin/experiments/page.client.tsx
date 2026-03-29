import { render } from 'melina/client'

type ExperimentOption = {
  id: string
  label: string
  variants: string[]
}

type TrendGroupBy = 'day' | 'week'

type ExperimentReport = {
  experimentId: string
  since: number
  until: number
  groupBy: TrendGroupBy
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
  trend: Array<{
    label: string
    periodStart: number
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

type TrendMetric = 'ctr' | 'exposures' | 'clicks'

const EXPERIMENT_ID_KEY = 'geeksy-admin-experiments:selected-id'
const EXPERIMENT_DAYS_KEY = 'geeksy-admin-experiments:selected-days'
const TREND_GROUP_BY_KEY = 'geeksy-admin-experiments:trend-group-by'
const TREND_METRIC_KEY = 'geeksy-admin-experiments:trend-metric'
const MIN_COMPARISON_EXPOSURES = 25
const TREND_SERIES_COLORS = ['#818cf8', '#f59e0b', '#22c55e', '#ec4899', '#06b6d4', '#a78bfa']

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

function buildPeriodSummary(report: ExperimentReport | null) {
  if (!report?.trend.length) {
    return { currentLabel: null as string | null, previousLabel: null as string | null, leader: null as null | { variantId: string; ctr: number }, controlDelta: null as number | null, leaderDelta: null as number | null }
  }

  const labels = Array.from(new Set(report.trend.map((row) => row.label))).sort((a, b) => b.localeCompare(a))
  const currentLabel = labels[0] || null
  const previousLabel = labels[1] || null
  const currentRows = report.trend.filter((row) => row.label === currentLabel)
  const previousRows = report.trend.filter((row) => row.label === previousLabel)
  const leader = currentRows.slice().sort((a, b) => b.ctr - a.ctr || b.exposures - a.exposures)[0] || null
  const currentControl = currentRows.find((row) => row.variantId === 'control') || null
  const previousControl = previousRows.find((row) => row.variantId === 'control') || null
  const previousLeader = leader ? previousRows.find((row) => row.variantId === leader.variantId) || null : null

  return {
    currentLabel,
    previousLabel,
    leader: leader ? { variantId: leader.variantId, ctr: leader.ctr } : null,
    controlDelta: currentControl && previousControl ? currentControl.ctr - previousControl.ctr : null,
    leaderDelta: leader && previousLeader ? leader.ctr - previousLeader.ctr : null,
  }
}

function TrendChart({ trend, metric, onMetricChange }: { trend: ExperimentReport['trend']; metric: TrendMetric; onMetricChange: (metric: TrendMetric) => void }) {
  if (!trend.length) return null

  const labels = Array.from(new Set(trend.map((row) => row.label))).sort()
  const variants = Array.from(new Set(trend.map((row) => row.variantId))).sort()
  const width = 960
  const height = 280
  const padding = { top: 24, right: 24, bottom: 42, left: 48 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const metricLabel = metric === 'ctr' ? 'CTR' : metric === 'exposures' ? 'Exposures' : 'Clicks'
  const readMetric = (row: ExperimentReport['trend'][number] | undefined) => row ? (metric === 'ctr' ? row.ctr : metric === 'exposures' ? row.exposures : row.clicks) : 0
  const maxValue = Math.max(metric === 'ctr' ? 0.01 : 1, ...trend.map((row) => readMetric(row)))
  const xStep = labels.length > 1 ? plotWidth / (labels.length - 1) : 0

  const colorByVariant = new Map(variants.map((variant, index) => [variant, TREND_SERIES_COLORS[index % TREND_SERIES_COLORS.length]]))
  const pointsByVariant = variants.map((variant) => {
    const rows = labels.map((label, labelIndex) => {
      const row = trend.find((entry) => entry.variantId === variant && entry.label === label)
      const value = readMetric(row)
      const x = padding.left + (labels.length > 1 ? labelIndex * xStep : plotWidth / 2)
      const y = padding.top + plotHeight - (value / maxValue) * plotHeight
      return { label, value, x, y }
    })
    const path = rows.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
    return { variant, color: colorByVariant.get(variant) || '#818cf8', rows, path }
  })

  return <div className="admin-trend-chart-shell">
    <div className="admin-trend-chart-topbar">
      <div className="admin-trend-legend">{pointsByVariant.map((series) => <div className="admin-trend-legend-item" key={series.variant}><span className="admin-trend-legend-dot" style={{ background: series.color }} /><code>{series.variant}</code></div>)}</div>
      <div className="admin-trend-toggle-group">
        {(['ctr', 'exposures', 'clicks'] as TrendMetric[]).map((entry) => <button key={entry} type="button" className={`admin-trend-toggle ${metric === entry ? 'admin-trend-toggle-active' : ''}`} onClick={() => onMetricChange(entry)}>{entry === 'ctr' ? 'CTR' : entry[0]!.toUpperCase() + entry.slice(1)}</button>)}
      </div>
    </div>
    <svg viewBox={`0 0 ${width} ${height}`} className="admin-trend-chart" role="img" aria-label={`Daily experiment ${metricLabel} trend chart`}>
      <line x1={padding.left} y1={padding.top + plotHeight} x2={padding.left + plotWidth} y2={padding.top + plotHeight} className="admin-trend-axis" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} className="admin-trend-axis" />
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = padding.top + plotHeight - tick * plotHeight
        const tickValue = maxValue * tick
        return <g key={tick}>
          <line x1={padding.left} y1={y} x2={padding.left + plotWidth} y2={y} className="admin-trend-grid" />
          <text x={padding.left - 10} y={y + 4} textAnchor="end" className="admin-trend-label">{metric === 'ctr' ? fmtPct(tickValue) : Math.round(tickValue).toString()}</text>
        </g>
      })}
      {labels.map((label, index) => {
        const x = padding.left + (labels.length > 1 ? index * xStep : plotWidth / 2)
        return <text key={label} x={x} y={height - 14} textAnchor="middle" className="admin-trend-label">{label.length > 10 ? label.slice(2) : label.slice(5)}</text>
      })}
      {pointsByVariant.map((series) => <g key={series.variant}>
        <path d={series.path} fill="none" stroke={series.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {series.rows.map((point) => <g key={`${series.variant}:${point.label}`}>
          <circle cx={point.x} cy={point.y} r="4.5" fill={series.color} />
          <title>{`${series.variant} · ${point.label} · ${metric === 'ctr' ? fmtPct(point.value) : point.value}`}</title>
        </g>)}
      </g>)}
    </svg>
  </div>
}

function AdminExperimentsApp({
  options,
  experimentId,
  days,
  loading,
  error,
  report,
  trendMetric,
  onTrendMetricChange,
  trendGroupBy,
  onTrendGroupByChange,
}: {
  options: ExperimentOption[]
  experimentId: string
  days: string
  loading: boolean
  error: string | null
  report: ExperimentReport | null
  trendMetric: TrendMetric
  onTrendMetricChange: (metric: TrendMetric) => void
  trendGroupBy: TrendGroupBy
  onTrendGroupByChange: (groupBy: TrendGroupBy) => void
}) {
  const comparison = buildVariantComparison(report)
  const periodSummary = buildPeriodSummary(report)
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
        <div className="admin-field admin-field-status">
          <label htmlFor="admin-experiment-group-by">Group</label>
          <select id="admin-experiment-group-by" value={trendGroupBy}>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
          </select>
        </div>
        <div className="admin-toolbar-actions">
          <button className="btn-primary" id="admin-experiment-load-btn">{loading ? 'Loading…' : 'Load Report'}</button>
          <a className="wheel-secondary-btn admin-link-btn" id="admin-experiment-export-btn" href={`/api/analytics/experiment?experimentId=${encodeURIComponent(experimentId)}&days=${encodeURIComponent(days)}&groupBy=${encodeURIComponent(trendGroupBy)}&format=csv`}>Download CSV</a>
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
            <h3>{trendGroupBy === 'week' ? 'Weekly' : 'Daily'} variant performance</h3>
          </div>
          <div className="gravity-wallet-state">{report.trend.length} {trendGroupBy === 'week' ? 'week' : 'period'}-row{report.trend.length === 1 ? '' : 's'}</div>
        </div>
        {periodSummary.currentLabel ? <div className="admin-period-summary-grid">
          <div className="admin-period-summary-card">
            <div className="market-card-label">Current {trendGroupBy === 'week' ? 'Week' : 'Period'}</div>
            <div className="wallet-summary-value"><code>{periodSummary.currentLabel}</code></div>
            <p>{periodSummary.previousLabel ? `Comparing against ${periodSummary.previousLabel}.` : 'No previous period available yet.'}</p>
          </div>
          <div className="admin-period-summary-card">
            <div className="market-card-label">Current Leader</div>
            <div className="wallet-summary-value">{periodSummary.leader ? <code>{periodSummary.leader.variantId}</code> : '—'}</div>
            <p>{periodSummary.leader ? `${fmtPct(periodSummary.leader.ctr)} ${trendGroupBy === 'week' ? 'this week' : 'this period'}.` : 'No leader yet.'}</p>
          </div>
          <div className="admin-period-summary-card">
            <div className="market-card-label">Leader vs Previous</div>
            <div className={`wallet-summary-value ${periodSummary.leaderDelta != null ? (periodSummary.leaderDelta > 0 ? 'admin-delta-pos' : periodSummary.leaderDelta < 0 ? 'admin-delta-neg' : '') : ''}`}>{fmtDeltaPct(periodSummary.leaderDelta)}</div>
            <p>{periodSummary.previousLabel ? 'CTR change for the current leader vs the previous grouped period.' : 'Need two grouped periods to compare momentum.'}</p>
          </div>
          <div className="admin-period-summary-card">
            <div className="market-card-label">Control vs Previous</div>
            <div className={`wallet-summary-value ${periodSummary.controlDelta != null ? (periodSummary.controlDelta > 0 ? 'admin-delta-pos' : periodSummary.controlDelta < 0 ? 'admin-delta-neg' : '') : ''}`}>{fmtDeltaPct(periodSummary.controlDelta)}</div>
            <p>{periodSummary.previousLabel ? 'Control CTR change vs the previous grouped period.' : 'Need two grouped periods to compare control movement.'}</p>
          </div>
        </div> : null}
        {!report.trend.length ? <div className="admin-empty-card">No {trendGroupBy} trend rows recorded for this window yet.</div> : <>
          <TrendChart trend={report.trend} metric={trendMetric} onMetricChange={onTrendMetricChange} />
          <div className="holders-table-wrap">
            <table className="holders-table">
              <thead>
                <tr><th>Day</th><th>Variant</th><th>Exposures</th><th>Clicks</th><th>CTR</th></tr>
              </thead>
              <tbody>
                {report.trend.map((row, index) => <tr key={`${row.label}:${row.variantId}:${index}`}>
                  <td><code>{row.label}</code></td>
                  <td><code>{row.variantId}</code></td>
                  <td>{row.exposures}</td>
                  <td>{row.clicks}</td>
                  <td>{fmtPct(row.ctr)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>}
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
  const storedGroupBy = readStorage(TREND_GROUP_BY_KEY)
  let experimentId = options.some((option) => option.id === storedExperimentId) ? storedExperimentId! : (options[0]?.id || 'hero-cta-v1')
  let days = ['7', '14', '30', '90'].includes(storedDays || '') ? storedDays! : '30'
  let trendGroupBy: TrendGroupBy = (storedGroupBy === 'week' ? 'week' : 'day')
  let trendMetric: TrendMetric = ['ctr', 'exposures', 'clicks'].includes(readStorage(TREND_METRIC_KEY) || '')
    ? readStorage(TREND_METRIC_KEY)! as TrendMetric
    : 'ctr'
  let loading = false
  let error: string | null = null
  let report: ExperimentReport | null = null

  const renderAll = () => {
    render(<AdminExperimentsApp options={options} experimentId={experimentId} days={days} loading={loading} error={error} report={report} trendMetric={trendMetric} onTrendMetricChange={(metric) => {
      trendMetric = metric
      writeStorage(TREND_METRIC_KEY, trendMetric)
      renderAll()
    }} trendGroupBy={trendGroupBy} onTrendGroupByChange={(groupBy) => {
      trendGroupBy = groupBy
      writeStorage(TREND_GROUP_BY_KEY, trendGroupBy)
      void loadReport()
    }} />, root)

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

    const groupBySelect = document.getElementById('admin-experiment-group-by') as HTMLSelectElement | null
    if (groupBySelect) groupBySelect.onchange = () => {
      trendGroupBy = groupBySelect.value === 'week' ? 'week' : 'day'
      writeStorage(TREND_GROUP_BY_KEY, trendGroupBy)
      void loadReport()
    }

    const loadBtn = document.getElementById('admin-experiment-load-btn') as HTMLButtonElement | null
    if (loadBtn) loadBtn.onclick = () => { void loadReport() }
  }

  const loadReport = async () => {
    loading = true
    error = null
    renderAll()
    try {
      const res = await fetch(`/api/analytics/experiment?experimentId=${encodeURIComponent(experimentId)}&days=${encodeURIComponent(days)}&groupBy=${encodeURIComponent(trendGroupBy)}`)
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
