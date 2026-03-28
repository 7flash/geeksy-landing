import { getRpcUrl, rpc, TOKEN_MINT } from '../lib/gksy'

const wallet = (process.env.TREASURY_WALLET || '').trim()
const tokenMint = (process.env.TREASURY_TOKEN_MINT || '').trim()
const asset = (process.env.TREASURY_ASSET || '').trim().toUpperCase()
const tokenSymbol = (process.env.TREASURY_TOKEN_SYMBOL || '').trim()
const rpcUrl = (process.env.TREASURY_RPC_URL || process.env.HELIUS_RPC_URL || getRpcUrl()).trim()

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function shortWallet(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-6)}`
}

async function readSplTokenBalance() {
  const mint = tokenMint || TOKEN_MINT
  const result = await rpc('getTokenAccountsByOwner', [
    wallet,
    { mint },
    { encoding: 'jsonParsed' },
  ], rpcUrl)

  let amount = 0
  for (const entry of result?.value || []) {
    amount += Number(entry?.account?.data?.parsed?.info?.tokenAmount?.uiAmountString || 0)
  }

  return {
    amount,
    token: tokenSymbol || (mint === TOKEN_MINT ? 'GKSY' : 'SPL'),
    source: `rpc-spl:${shortWallet(wallet)}:${mint}`,
    rpcUrl,
  }
}

async function readSolBalance() {
  const result = await rpc('getBalance', [wallet], rpcUrl)
  const lamports = Number(result?.value || 0)
  return {
    amount: lamports / 1_000_000_000,
    token: tokenSymbol || 'SOL',
    source: `rpc-sol:${shortWallet(wallet)}`,
    rpcUrl,
  }
}

if (!wallet) {
  fail('TREASURY_WALLET is required')
}

let snapshot
if (asset === 'SOL') snapshot = await readSolBalance()
else snapshot = await readSplTokenBalance()

console.log(JSON.stringify(snapshot))
