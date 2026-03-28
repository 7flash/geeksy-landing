import { render } from 'melina/client'

type AdminClaimRequest = {
  id: string
  wallet: string
  amount: number
  token: string
  claimCount: number
  status: string
  processedAt: number | null
  txSignature: string | null
  adminReason: string | null
  createdAt: number
  updatedAt: number
  claimIds: string[]
}

type AdminClaimsData = {
  ok: boolean
  requests?: AdminClaimRequest[]
  error?: string
}

function fmtPoints(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(2)
}

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`
}

function StatusPill({ status }: { status: string }) {
  return <span className={`admin-status-pill admin-status-${status}`}>{status}</span>
}

function AdminClaimsApp({
  token,
  status,
  loading,
  error,
  notice,
  requests,
  txValues,
  reasonValues,
}: {
  token: string
  status: string
  loading: boolean
  error: string | null
  notice: string | null
  requests: AdminClaimRequest[]
  txValues: Record<string, string>
  reasonValues: Record<string, string>
}) {
  return <div className="admin-claims-shell">
    <div className="admin-toolbar-card">
      <div className="admin-toolbar-grid">
        <div className="admin-field">
          <label htmlFor="admin-token-input">Admin token</label>
          <input id="admin-token-input" type="password" value={token} placeholder="Paste WHEEL_ADMIN_TOKEN" />
        </div>
        <div className="admin-field admin-field-status">
          <label htmlFor="admin-status-select">Queue</label>
          <select id="admin-status-select" value={status}>
            <option value="requested">Requested</option>
            <option value="claimed">Claimed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="admin-toolbar-actions">
          <button className="btn-primary" id="admin-load-btn">{loading ? 'Loading…' : 'Load Requests'}</button>
          <button className="wheel-secondary-btn" id="admin-clear-btn">Clear Token</button>
        </div>
      </div>
      <p className="admin-toolbar-help">The token is stored only in your local browser storage for convenience. Requests are still authenticated server-side through the admin header.</p>
      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {notice ? <div className="admin-alert admin-alert-success">{notice}</div> : null}
    </div>

    <div className="admin-queue-header">
      <div>
        <div className="market-card-label">Settlement queue</div>
        <h3>{status[0]?.toUpperCase() + status.slice(1)} requests</h3>
      </div>
      <div className="gravity-wallet-state">{requests.length} batch{requests.length === 1 ? '' : 'es'}</div>
    </div>

    {!requests.length ? <div className="admin-empty-card">{loading ? 'Loading claim requests…' : 'No claim requests in this queue right now.'}</div> : <div className="admin-claims-list">{requests.map((request) => <div className="admin-claim-card" key={request.id}>
      <div className="admin-claim-card-top">
        <div>
          <div className="market-card-label">Claim Request</div>
          <h4>{shortWallet(request.wallet)} · {fmtPoints(request.amount)} {request.token}</h4>
        </div>
        <StatusPill status={request.status} />
      </div>

      <div className="admin-claim-metrics">
        <div><span>Wallet</span><strong>{request.wallet}</strong></div>
        <div><span>Claims</span><strong>{request.claimCount}</strong></div>
        <div><span>Created</span><strong>{new Date(request.createdAt).toLocaleString()}</strong></div>
        <div><span>Updated</span><strong>{new Date(request.updatedAt).toLocaleString()}</strong></div>
      </div>

      <div className="admin-claim-ids"><span>Claim IDs</span><code>{request.claimIds.join(', ')}</code></div>

      {request.txSignature ? <div className="admin-meta-line"><span>Tx Signature</span><code>{request.txSignature}</code></div> : null}
      {request.adminReason ? <div className="admin-meta-line"><span>Admin Reason</span><p>{request.adminReason}</p></div> : null}

      {request.status === 'requested' ? <div className="admin-settle-box">
        <div className="admin-field">
          <label htmlFor={`tx-${request.id}`}>Payout tx signature</label>
          <input id={`tx-${request.id}`} data-admin-tx={request.id} value={txValues[request.id] || ''} placeholder="Required for claimed" />
        </div>
        <div className="admin-field">
          <label htmlFor={`reason-${request.id}`}>Failure reason</label>
          <input id={`reason-${request.id}`} data-admin-reason={request.id} value={reasonValues[request.id] || ''} placeholder="Optional for failed" />
        </div>
        <div className="admin-toolbar-actions">
          <button className="btn-primary" data-admin-settle={request.id} data-status="claimed">Mark Claimed</button>
          <button className="wheel-secondary-btn" data-admin-settle={request.id} data-status="failed">Mark Failed</button>
        </div>
      </div> : null}
    </div>)}</div>}
  </div>
}

export default function mount() {
  const root = document.getElementById('admin-claims-root')
  if (!root) return

  let token = localStorage.getItem('geeksy-wheel-admin-token') || ''
  let status = 'requested'
  let loading = false
  let error: string | null = null
  let notice: string | null = null
  let requests: AdminClaimRequest[] = []
  let txValues: Record<string, string> = {}
  let reasonValues: Record<string, string> = {}

  const renderAll = () => {
    render(<AdminClaimsApp token={token} status={status} loading={loading} error={error} notice={notice} requests={requests} txValues={txValues} reasonValues={reasonValues} />, root)

    const tokenInput = document.getElementById('admin-token-input') as HTMLInputElement | null
    if (tokenInput) tokenInput.oninput = () => {
      token = tokenInput.value
      localStorage.setItem('geeksy-wheel-admin-token', token)
      renderAll()
    }

    const statusSelect = document.getElementById('admin-status-select') as HTMLSelectElement | null
    if (statusSelect) statusSelect.onchange = () => {
      status = statusSelect.value
      renderAll()
      void loadRequests()
    }

    const loadBtn = document.getElementById('admin-load-btn') as HTMLButtonElement | null
    if (loadBtn) loadBtn.onclick = () => { void loadRequests() }

    const clearBtn = document.getElementById('admin-clear-btn') as HTMLButtonElement | null
    if (clearBtn) clearBtn.onclick = () => {
      token = ''
      localStorage.removeItem('geeksy-wheel-admin-token')
      requests = []
      error = null
      notice = null
      renderAll()
    }

    document.querySelectorAll('[data-admin-tx]').forEach((node) => {
      const input = node as HTMLInputElement
      input.oninput = () => {
        txValues[input.dataset.adminTx!] = input.value
      }
    })

    document.querySelectorAll('[data-admin-reason]').forEach((node) => {
      const input = node as HTMLInputElement
      input.oninput = () => {
        reasonValues[input.dataset.adminReason!] = input.value
      }
    })

    document.querySelectorAll('[data-admin-settle]').forEach((node) => {
      const button = node as HTMLButtonElement
      button.onclick = async () => {
        const requestId = button.dataset.adminSettle || ''
        const nextStatus = button.dataset.status || ''
        await settleRequest(requestId, nextStatus)
      }
    })
  }

  const loadRequests = async () => {
    if (!token.trim()) {
      error = 'Paste the admin token first.'
      notice = null
      renderAll()
      return
    }
    loading = true
    error = null
    notice = null
    renderAll()
    try {
      const res = await fetch(`/api/wheel/admin/claims?status=${encodeURIComponent(status)}&limit=100`, {
        headers: { 'x-wheel-admin-token': token },
      })
      const json = await res.json() as AdminClaimsData
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load claim requests')
      requests = json.requests || []
    } catch (err: any) {
      requests = []
      error = err?.message || 'Failed to load claim requests'
    } finally {
      loading = false
      renderAll()
    }
  }

  const settleRequest = async (requestId: string, nextStatus: string) => {
    if (!token.trim()) {
      error = 'Paste the admin token first.'
      renderAll()
      return
    }
    const txSignature = (txValues[requestId] || '').trim()
    const reason = (reasonValues[requestId] || '').trim()
    if (nextStatus === 'claimed' && !txSignature) {
      error = 'A payout tx signature is required to mark a request claimed.'
      notice = null
      renderAll()
      return
    }
    loading = true
    error = null
    notice = null
    renderAll()
    try {
      const res = await fetch('/api/wheel/admin/claims/settle', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-wheel-admin-token': token },
        body: JSON.stringify({ requestId, status: nextStatus, txSignature, reason }),
      })
      const json = await res.json() as { ok: boolean; error?: string; status?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to settle request')
      notice = `Request ${requestId} marked ${json.status || nextStatus}.`
      delete txValues[requestId]
      delete reasonValues[requestId]
      await loadRequests()
      return
    } catch (err: any) {
      error = err?.message || 'Failed to settle request'
    } finally {
      loading = false
      renderAll()
    }
  }

  renderAll()
  if (token.trim()) void loadRequests()

  return () => render(null, root)
}
