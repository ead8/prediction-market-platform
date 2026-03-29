// Semantic market matching - identifies same events across exchanges
// Uses keyword extraction and entity matching instead of just string similarity

interface MarketMetadata {
  id: string
  title: string
  keywords: Set<string>
  entities: Set<string>
  source: 'polymarket' | 'kalshi'
}

// Extract key terms and entities from market title
function extractKeywords(title: string): Set<string> {
  const cleaned = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !isCommonWord(word))
  
  return new Set(cleaned)
}

function isCommonWord(word: string): boolean {
  const common = new Set([
    'the', 'and', 'or', 'if', 'in', 'on', 'at', 'to', 'for', 'of', 'by',
    'will', 'by', 'before', 'after', 'year', 'month', 'week', 'day',
    'yes', 'no', 'market', 'prediction', 'forecast', 'event', 'outcome',
    'what', 'when', 'where', 'who', 'which', 'how', 'than', 'that', 'this',
    'can', 'may', 'could', 'would', 'should', 'must', 'have', 'has', 'is',
    'are', 'be', 'been', 'being', 'do', 'does', 'did', 'a', 'an'
  ])
  return common.has(word)
}

// Extract named entities (names of people, places, events)
function extractEntities(title: string): Set<string> {
  const entities = new Set<string>()
  
  // Common entity patterns
  const patterns = {
    person: /(?:win|win|beat|defeat|announce|elect|choose)[\s]*([A-Z][a-z]+[\s]*[A-Z][a-z]+)/g,
    election: /(?:election|vote|elect)[\s]*(?:for|in)[\s]*([a-z]+)/gi,
    number: /[\s]*(\d{4}|20\d{2}|19\d{2})/g,
  }

  // Extract years
  const yearMatches = title.match(/\b(20\d{2}|19\d{2})\b/g)
  if (yearMatches) yearMatches.forEach(year => entities.add(year))

  // Extract capitalized phrases (likely proper nouns)
  const properNouns = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
  properNouns.forEach(noun => {
    if (noun.length > 3 && !['The', 'Will', 'In', 'By', 'For', 'At', 'To', 'On'].includes(noun)) {
      entities.add(noun.toLowerCase())
    }
  })

  return entities
}

function createMarketMetadata(market: any, source: 'polymarket' | 'kalshi'): MarketMetadata {
  const title = market.title || market.question || ''
  return {
    id: market.id,
    title,
    keywords: extractKeywords(title),
    entities: extractEntities(title),
    source,
  }
}

// Calculate semantic similarity between two markets
function calculateSemanticSimilarity(m1: MarketMetadata, m2: MarketMetadata): number {
  // Check for exact title match (high confidence)
  if (m1.title.toLowerCase() === m2.title.toLowerCase()) {
    return 0.95
  }

  // Keyword overlap
  const commonKeywords = new Set([...m1.keywords].filter(k => m2.keywords.has(k)))
  const keywordRatio = commonKeywords.size / Math.max(m1.keywords.size, m2.keywords.size, 1)

  // Entity overlap (very important - same entities = same event)
  const commonEntities = new Set([...m1.entities].filter(e => m2.entities.has(e)))
  const entityRatio = commonEntities.size / Math.max(m1.entities.size, m2.entities.size, 1)

  // Combined score: entities weighted more heavily since they identify the actual event
  const score = (keywordRatio * 0.4) + (entityRatio * 0.6)

  return score
}

export interface MarketMatch {
  polymarket: any
  kalshi: any
  similarity: number
  commonKeywords: string[]
  commonEntities: string[]
}

export function findSemanticMatches(
  polymarkets: any[],
  kalshiMarkets: any[],
  minSimilarity: number = 0.3
): MarketMatch[] {
  const matches: MarketMatch[] = []
  
  const polyMetadata = polymarkets.map(m => createMarketMetadata(m, 'polymarket'))
  const kalshiMetadata = kalshiMarkets.map(m => createMarketMetadata(m, 'kalshi'))

  // Find best match for each Polymarket
  const matchedKalshi = new Set<string>()

  for (const polyMeta of polyMetadata) {
    let bestMatch = null
    let bestScore = minSimilarity

    for (const kalshiMeta of kalshiMetadata) {
      if (matchedKalshi.has(kalshiMeta.id)) continue // Skip already matched

      const similarity = calculateSemanticSimilarity(polyMeta, kalshiMeta)
      
      if (similarity > bestScore) {
        bestScore = similarity
        bestMatch = kalshiMeta
      }
    }

    if (bestMatch) {
      matchedKalshi.add(bestMatch.id)
      
      const polyMarket = polymarkets.find(m => m.id === polyMeta.id)
      const kalshiMarket = kalshiMarkets.find(m => m.id === bestMatch!.id)

      const commonKeywords = [...polyMeta.keywords]
        .filter(k => bestMatch!.keywords.has(k))
        .slice(0, 5)
      
      const commonEntities = [...polyMeta.entities]
        .filter(e => bestMatch!.entities.has(e))
        .slice(0, 5)

      matches.push({
        polymarket: polyMarket,
        kalshi: kalshiMarket,
        similarity: bestScore,
        commonKeywords,
        commonEntities,
      })
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity)
}
