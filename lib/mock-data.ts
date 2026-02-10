// Mock market data for development when database is not available
export const MOCK_MARKETS = [
  {
    id: 'poly_1',
    source: 'polymarket',
    title: 'Will Donald Trump win the 2024 US Presidential Election?',
    category: 'Politics',
    yes_price: 0.65,
    no_price: 0.35,
    current_price: 0.65,
    volume_24h: 2500000,
    liquidity: 450000,
    volume_7d: 8900000,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kalshi_1',
    source: 'kalshi',
    title: 'Will the S&P 500 close above 5000 by end of Q1 2024?',
    category: 'Finance',
    yes_price: 0.72,
    no_price: 0.28,
    current_price: 0.72,
    volume_24h: 1800000,
    liquidity: 320000,
    volume_7d: 6200000,
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'poly_2',
    source: 'polymarket',
    title: 'Will AI-generated content be regulated by 2025?',
    category: 'Technology',
    yes_price: 0.58,
    no_price: 0.42,
    current_price: 0.58,
    volume_24h: 1200000,
    liquidity: 280000,
    volume_7d: 4100000,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kalshi_2',
    source: 'kalshi',
    title: 'Will Bitcoin close above $50,000 in February 2024?',
    category: 'Crypto',
    yes_price: 0.68,
    no_price: 0.32,
    current_price: 0.68,
    volume_24h: 3200000,
    liquidity: 580000,
    volume_7d: 9800000,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'poly_3',
    source: 'polymarket',
    title: 'Will Taylor Swift perform at the 2024 Super Bowl?',
    category: 'Entertainment',
    yes_price: 0.45,
    no_price: 0.55,
    current_price: 0.45,
    volume_24h: 890000,
    liquidity: 150000,
    volume_7d: 2100000,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kalshi_3',
    source: 'kalshi',
    title: 'Will the US Federal Reserve cut rates in Q2 2024?',
    category: 'Finance',
    yes_price: 0.62,
    no_price: 0.38,
    current_price: 0.62,
    volume_24h: 2100000,
    liquidity: 420000,
    volume_7d: 7300000,
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'poly_4',
    source: 'polymarket',
    title: 'Will SpaceX launch a crewed Mars mission by 2026?',
    category: 'Technology',
    yes_price: 0.38,
    no_price: 0.62,
    current_price: 0.38,
    volume_24h: 1600000,
    liquidity: 290000,
    volume_7d: 5400000,
    created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kalshi_4',
    source: 'kalshi',
    title: 'Will Ethereum reach $3000 by end of 2024?',
    category: 'Crypto',
    yes_price: 0.55,
    no_price: 0.45,
    current_price: 0.55,
    volume_24h: 2800000,
    liquidity: 510000,
    volume_7d: 8600000,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export function filterMockMarkets(
  category?: string,
  search?: string
): (typeof MOCK_MARKETS)[0][] {
  let filtered = [...MOCK_MARKETS]

  if (category) {
    filtered = filtered.filter(
      (m) => m.category.toLowerCase() === category.toLowerCase()
    )
  }

  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    )
  }

  return filtered
}

export function getTopMovers(
  timeframe: '1h' | '24h' = '24h'
): (typeof MOCK_MARKETS)[0][] {
  // Simulate price movement volatility
  return [...MOCK_MARKETS]
    .sort((a, b) => {
      const volatilityA = Math.abs(Math.random() - 0.5) * a.volume_24h
      const volatilityB = Math.abs(Math.random() - 0.5) * b.volume_24h
      return volatilityB - volatilityA
    })
    .slice(0, 5)
}

export function getTrendingMarkets(): (typeof MOCK_MARKETS)[0][] {
  return [...MOCK_MARKETS]
    .sort((a, b) => b.volume_7d - a.volume_7d)
    .slice(0, 5)
}
