// Comprehensive category system for prediction markets
// Maps market titles and keywords to standardized categories

export type MarketCategory = 
  | 'Politics'
  | 'Sports'
  | 'Crypto'
  | 'Economics'
  | 'Science'
  | 'Entertainment'
  | 'Technology'
  | 'Weather'
  | 'Sports Betting'
  | 'General'

export const CATEGORY_COLORS: Record<MarketCategory, string> = {
  'Politics': '#EF4444',
  'Sports': '#3B82F6',
  'Crypto': '#F59E0B',
  'Economics': '#10B981',
  'Science': '#8B5CF6',
  'Entertainment': '#EC4899',
  'Technology': '#06B6D4',
  'Weather': '#6366F1',
  'Sports Betting': '#1E40AF',
  'General': '#6B7280',
}

export const CATEGORY_KEYWORDS: Record<MarketCategory, string[]> = {
  'Politics': [
    'president', 'election', 'congress', 'senator', 'governor', 'mayor',
    'trump', 'biden', 'democrat', 'republican', 'vote', 'candidate',
    'parliament', 'parliament member', 'prime minister', 'political', 'party',
    'congress seat', 'senate', 'house', 'representative', 'legislation', 'law'
  ],
  'Sports': [
    'super bowl', 'nfl', 'nba', 'nhl', 'mlb', 'world series', 'championship',
    'playoffs', 'finals', 'conference', 'division', 'soccer', 'football',
    'basketball', 'hockey', 'baseball', 'tennis', 'wimbledon', 'olympic',
    'world cup', 'league', 'match', 'game', 'tournament', 'winner',
    'team', 'score', 'points', 'win', 'defeat', 'coach', 'player'
  ],
  'Crypto': [
    'bitcoin', 'ethereum', 'crypto', 'blockchain', 'btc', 'eth', 'token',
    'nft', 'defi', 'web3', 'dapp', 'smart contract', 'mining', 'halving',
    'altcoin', 'xrp', 'cardano', 'solana', 'dogecoin', 'shiba', 'doge',
    'coin', 'coinbase', 'kraken', 'exchange', 'trading', 'price',
    'cryptocurrency', 'digital currency', 'metaverse'
  ],
  'Economics': [
    'inflation', 'gdp', 'unemployment', 'interest rate', 'fed', 'federal reserve',
    'stock market', 'nasdaq', 'dow jones', 'sp500', 'recession', 'economy',
    'earnings', 'revenue', 'profit', 'loss', 'buyback', 'dividend',
    'trade', 'tariff', 'deal', 'merger', 'acquisition', 'ipo', 'bankruptcy',
    'bankruptcy', 'debt', 'credit', 'bonds', 'yield'
  ],
  'Science': [
    'nobel prize', 'physics', 'chemistry', 'biology', 'medicine', 'breakthrough',
    'discovery', 'research', 'experiment', 'virus', 'vaccine', 'drug',
    'fda', 'approval', 'clinical trial', 'pandemic', 'covid', 'health',
    'climate', 'global warming', 'carbon', 'emissions', 'asteroid', 'space',
    'nasa', 'space exploration', 'mars', 'moon', 'mission'
  ],
  'Entertainment': [
    'movie', 'film', 'actor', 'actress', 'oscar', 'award', 'grammy',
    'music', 'album', 'song', 'artist', 'band', 'concert', 'tour',
    'release', 'premiere', 'streaming', 'netflix', 'disney', 'marvel',
    'tv show', 'series', 'episode', 'season', 'cast', 'director',
    'box office', 'ratings', 'views', 'success', 'flop', 'hit'
  ],
  'Technology': [
    'ai', 'artificial intelligence', 'machine learning', 'nlp', 'chatgpt',
    'apple', 'microsoft', 'google', 'meta', 'tesla', 'amazon',
    'iphone', 'ios', 'android', 'app', 'software', 'hardware',
    'product launch', 'release', 'update', 'feature', 'innovation',
    'startup', 'unicorn', 'funding', 'valuation', 'ipo'
  ],
  'Weather': [
    'hurricane', 'tornado', 'earthquake', 'flood', 'drought', 'storm',
    'snowfall', 'rainfall', 'temperature', 'weather', 'forecast',
    'climate', 'wind', 'thunder', 'lightning', 'winter', 'summer',
    'spring', 'fall', 'season', 'natural disaster'
  ],
  'Sports Betting': [
    'over', 'under', 'spread', 'moneyline', 'odds', 'betting',
    'score', 'total points', 'winning', 'losing', 'run', 'goal',
    'touchdown', 'field goal', 'home run', 'strikeout'
  ],
  'General': [
    'market', 'prediction', 'forecast', 'event', 'outcome', 'results'
  ]
}

export function detectCategory(title: string): MarketCategory {
  const lowerTitle = title.toLowerCase()
  
  // Check each category in order of specificity
  const categories: MarketCategory[] = [
    'Politics', 'Crypto', 'Sports', 'Science', 'Entertainment', 
    'Technology', 'Economics', 'Weather', 'Sports Betting'
  ]

  for (const category of categories) {
    const keywords = CATEGORY_KEYWORDS[category]
    const matches = keywords.filter(keyword => lowerTitle.includes(keyword))
    if (matches.length >= 1) {
      return category
    }
  }

  return 'General'
}

export function getTopCategories(markets: any[], limit: number = 8): Array<{ category: MarketCategory; count: number }> {
  const counts: Record<MarketCategory, number> = {
    'Politics': 0,
    'Sports': 0,
    'Crypto': 0,
    'Economics': 0,
    'Science': 0,
    'Entertainment': 0,
    'Technology': 0,
    'Weather': 0,
    'Sports Betting': 0,
    'General': 0,
  }

  markets.forEach(market => {
    const category = detectCategory(market.title || '')
    counts[category]++
  })

  return Object.entries(counts)
    .map(([category, count]) => ({ category: category as MarketCategory, count }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
