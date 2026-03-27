const TOKEN_ADDRESS = '9rcxe6nSq9GT56KyGV8QHhBYKgjNaGmW2JyDDfsZBAGS'

export async function GET() {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 geeksy-landing' },
  })

  if (!res.ok) {
    return Response.json({ ok: false, error: `Dexscreener returned ${res.status}` }, { status: 502 })
  }

  const data = await res.json() as any
  const pairs = (data.pairs || []).filter((p: any) => p.chainId === 'solana')
  const pair = pairs.sort((a: any, b: any) => ((b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)))[0] || null

  if (!pair) {
    return Response.json({ ok: false, error: 'No Solana pair found for token' }, { status: 404 })
  }

  return Response.json({
    ok: true,
    token: {
      address: TOKEN_ADDRESS,
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
    }
  })
}
