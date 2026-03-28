import { Head } from 'melina/server'

export default function AdminClaimsPage() {
  return (
    <>
      <Head>
        <title>Geeksy Admin Claims Console</title>
        <meta name="description" content="Internal payout settlement console for Geeksy wheel claims." />
      </Head>

      <main className="landing-shell">
        <div className="landing landing-wide" style={{ padding: '48px 0 96px' }}>
          <nav className="nav nav-marketing">
            <div className="nav-brand"><div className="logo">G</div><span className="brand-name">Geeksy Admin</span></div>
            <div className="nav-links">
              <a href="https://geeksy.xyz">Home</a>
              <a href="https://app.geeksy.xyz" className="btn-primary">Open App →</a>
            </div>
          </nav>

          <section className="section" style={{ padding: '40px 0 0', maxWidth: '1320px' }}>
            <div className="section-label">Manual settlement console</div>
            <h1 style={{ fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: '1.08', marginBottom: '12px' }}>Admin claims queue</h1>
            <p className="section-desc" style={{ marginBottom: '24px', maxWidth: '900px' }}>
              This console is for internal payout operations only. Paste the admin token locally in your browser, review requested claim batches, then mark them <code>claimed</code> with a payout tx signature or <code>failed</code> with an operator reason.
            </p>
            <div id="admin-claims-root" />
          </section>
        </div>
      </main>
    </>
  )
}
