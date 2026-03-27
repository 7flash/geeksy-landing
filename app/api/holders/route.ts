import fs from 'fs'
import path from 'path'

const TOKEN_MINT = '9rcxe6nSq9GT56KyGV8QHhBYKgjNaGmW2JyDDfsZBAGS'
const CACHE_TTL_MS = 60_000

type HolderRow = {
  rank: number
  owner: string
  tokenAccount: string
  amount: number
  pctOfSupply: number
}

let cache: { fetchedAt: number; payload: any } | null = null

function findConfigPath() {
  const cwd = process.cwd()
  const candidates = [
    process.env.GKSY_HOLDERS_CONFIG_PATH,
    process.env.GEEKSY_PUMPFUN_CONFIG_PATH,
    path.resolve(cwd, '.config.toml'),
    path.resolve(cwd, '../geeksy-pumpfun-plugin/.config.toml'),
    path.resolve(cwd, '../geeksy/.config.toml'),
    '/opt/geeksy/.config.toml',
    '/root/geeksy/.config.toml',
  ].filter(Boolean) as string[]

  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function getRpcUrl() {
  if (process.env.HELIUS_RPC_URL) return process.env.HELIUS_RPC_URL

  const configPath = findConfigPath()
  if (!configPath) return 'https://api.mainnet-beta.solana.com'

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const rpcSection = raw.match(/\[rpc\][\s\S]*?endpoint\s*=\s*"([^"]+)"/)
    if (rpcSection?.[1]) return rpcSection[1]
    const generic = raw.match(/endpoint\s*=\s*"([^"]+)"/)
    if (generic?.[1]) return generic[1]
  } catch {}

  return 'https://api.mainnet-beta.solana.com'
}

async function rpc(method: string, params: any[], rpcUrl: string) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

  if (!res.ok) {
    throw new Error(`RPC ${method} failed with ${res.status}`)
  }

  const data = await res.json() as any
  if (data.error) {
    throw new Error(data.error.message || `RPC ${method} error`)
  }

  return data.result
}

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return Response.json({ ...cache.payload, cached: true })
  }

  try {
    const rpcUrl = getRpcUrl()
    const largest = await rpc('getTokenLargestAccounts', [TOKEN_MINT], rpcUrl)
    const supplyResult = await rpc('getTokenSupply', [TOKEN_MINT], rpcUrl)

    const accounts = largest?.value || []
    const tokenAccounts = accounts.map((row: any) => row.address)
    const accountInfos = tokenAccounts.length
      ? await rpc('getMultipleAccounts', [tokenAccounts, { encoding: 'jsonParsed' }], rpcUrl)
      : { value: [] }

    const totalSupply = Number(supplyResult?.value?.uiAmountString || 0)
    const holders: HolderRow[] = accounts.map((row: any, index: number) => {
      const parsed = accountInfos?.value?.[index]?.data?.parsed?.info
      const owner = parsed?.owner || row.address
      const amount = Number(row.uiAmountString || 0)
      return {
        rank: index + 1,
        owner,
        tokenAccount: row.address,
        amount,
        pctOfSupply: totalSupply > 0 ? (amount / totalSupply) * 100 : 0,
      }
    })

    const payload = {
      ok: true,
      mint: TOKEN_MINT,
      totalSupply,
      holders,
      rpcHost: (() => {
        try { return new URL(rpcUrl).host } catch { return 'unknown' }
      })(),
      fetchedAt: new Date().toISOString(),
    }

    cache = { fetchedAt: Date.now(), payload }
    return Response.json({ ...payload, cached: false })
  } catch (error: any) {
    return Response.json({
      ok: false,
      error: error?.message || 'Failed to fetch holders',
      mint: TOKEN_MINT,
    }, { status: 500 })
  }
}
