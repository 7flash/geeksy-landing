import fs from 'fs'
import path from 'path'

export const TOKEN_MINT = '9rcxe6nSq9GT56KyGV8QHhBYKgjNaGmW2JyDDfsZBAGS'
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

export const EXCLUDED_GRAVITY_WALLETS = new Set([
  'FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM', // LP
])

export type OwnerBalanceRow = {
  owner: string
  balance: number
  tokenAccounts: string[]
  pctOfSupply: number
}

export function findConfigPath() {
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

export function getRpcUrl() {
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

export async function rpc(method: string, params: any[], rpcUrl = getRpcUrl()) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

  if (!res.ok) throw new Error(`RPC ${method} failed with ${res.status}`)
  const data = await res.json() as any
  if (data.error) throw new Error(data.error.message || `RPC ${method} error`)
  return data.result
}

export async function fetchMarketSnapshot() {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_MINT}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 geeksy-landing' },
  })
  if (!res.ok) throw new Error(`Dexscreener returned ${res.status}`)
  const data = await res.json() as any
  const pairs = (data.pairs || []).filter((p: any) => p.chainId === 'solana')
  const pair = pairs.sort((a: any, b: any) => ((b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)))[0] || null
  if (!pair) throw new Error('No Solana pair found for token')
  return {
    token: {
      address: TOKEN_MINT,
      symbol: pair.baseToken?.symbol || 'GKSY',
      name: pair.baseToken?.name || 'Geeksy',
    },
    pair: {
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      url: pair.url,
      priceUsd: Number(pair.priceUsd || 0),
      priceNative: Number(pair.priceNative || 0),
      fdv: Number(pair.fdv || 0),
      marketCap: Number(pair.marketCap || 0),
      liquidityUsd: Number(pair.liquidity?.usd || 0),
      volume24h: Number(pair.volume?.h24 || 0),
      buys24h: Number(pair.txns?.h24?.buys || 0),
      sells24h: Number(pair.txns?.h24?.sells || 0),
      changeM5: Number(pair.priceChange?.m5 || 0),
      changeH1: Number(pair.priceChange?.h1 || 0),
      changeH6: Number(pair.priceChange?.h6 || 0),
      changeH24: Number(pair.priceChange?.h24 || 0),
    },
  }
}

export async function fetchOwnerBalances() {
  const rpcUrl = getRpcUrl()
  const supplyResult = await rpc('getTokenSupply', [TOKEN_MINT], rpcUrl)
  const totalSupply = Number(supplyResult?.value?.uiAmountString || 0)

  const tokenAccounts = await rpc('getProgramAccounts', [
    TOKEN_PROGRAM,
    {
      encoding: 'jsonParsed',
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: TOKEN_MINT } },
      ],
    },
  ], rpcUrl)

  const balances = new Map<string, { balance: number; tokenAccounts: string[] }>()

  for (const entry of tokenAccounts || []) {
    const pubkey = entry.pubkey as string
    const info = entry.account?.data?.parsed?.info
    const owner = info?.owner as string | undefined
    const amount = Number(info?.tokenAmount?.uiAmountString || 0)
    if (!owner || amount <= 0) continue
    const existing = balances.get(owner) || { balance: 0, tokenAccounts: [] }
    existing.balance += amount
    existing.tokenAccounts.push(pubkey)
    balances.set(owner, existing)
  }

  const holders: OwnerBalanceRow[] = Array.from(balances.entries())
    .filter(([owner]) => !EXCLUDED_GRAVITY_WALLETS.has(owner))
    .map(([owner, value]) => ({
      owner,
      balance: value.balance,
      tokenAccounts: value.tokenAccounts,
      pctOfSupply: totalSupply > 0 ? (value.balance / totalSupply) * 100 : 0,
    }))
    .sort((a, b) => b.balance - a.balance)

  return {
    mint: TOKEN_MINT,
    totalSupply,
    holders,
    rpcHost: (() => {
      try { return new URL(rpcUrl).host } catch { return 'unknown' }
    })(),
  }
}
