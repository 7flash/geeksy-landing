import { Head } from 'melina/server'
import { landingExperiments } from '../../../lib/experiments'

const experimentOptions = Object.values(landingExperiments).map((experiment) => ({
  id: experiment.id,
  label: experiment.id,
  variants: Object.keys(experiment.variants),
}))

export default function AdminExperimentsPage() {
  return (
    <>
      <Head>
        <title>Geeksy Experiment Reports</title>
        <meta name="description" content="Internal experiment reporting view for Geeksy landing analytics." />
      </Head>

      <main className="landing-shell">
        <div className="landing landing-wide" style={{ padding: '48px 0 96px' }}>
          <nav className="nav nav-marketing">
            <div className="nav-brand"><div className="logo">G</div><span className="brand-name">Geeksy Analytics</span></div>
            <div className="nav-links">
              <a href="https://geeksy.xyz">Home</a>
              <a href="/admin/claims">Claims</a>
              <a href="https://app.geeksy.xyz" className="btn-primary">Open App →</a>
            </div>
          </nav>

          <section className="section" style={{ padding: '40px 0 0', maxWidth: '1320px' }}>
            <div className="section-label">Experiment analytics</div>
            <h1 style={{ fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: '1.08', marginBottom: '12px' }}>Landing experiment reports</h1>
            <p className="section-desc" style={{ marginBottom: '24px', maxWidth: '920px' }}>
              Review experiment exposures, clicks, CTR, and CTA breakdowns without querying SQLite manually. This page reads the same first-party report API that also powers CSV export.
            </p>
            <div id="admin-experiments-root" />
            <script id="admin-experiment-options" type="application/json">{JSON.stringify(experimentOptions)}</script>
          </section>
        </div>
      </main>
    </>
  )
}
