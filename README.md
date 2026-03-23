# Prediction Market Terminal

A real-time prediction market analysis and arbitrage detection platform that aggregates data from multiple prediction market exchanges.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/ead8s-projects/v0-prediction-market-platform)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/jgFcdpQY41C)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev)

## Features

### 📊 Market Data Aggregation
- **Multi-Exchange Support**: Real-time market data from Polymarket and Kalshi
- **Unified Dashboard**: View and search markets from both exchanges in one place
- **Live Market Browser**: Real-time market updates with socket.io
- **Advanced Search**: Find markets across all exchanges with category filtering

### 🔄 Arbitrage Detection
- **Cross-Exchange Scanning**: Automatically detect price discrepancies between exchanges
- **Semantic Matching**: Uses fuzzy matching and Jaccard similarity to match equivalent markets
- **Spread Analysis**: Calculate profit margins accounting for trading fees
- **Confidence Scoring**: Rate opportunities by match quality (0-1 scale)
- **Interactive Filters**: Filter by minimum spread and category

### 📈 Analytics & Insights
- **Market Statistics**: Total markets, volumes, and average prices
- **Category Breakdown**: Market distribution across categories
- **Trending Markets**: Top markets by 24h volume
- **Top Movers**: Markets with biggest price changes
- **Price Distribution**: Visualize markets across price ranges

### 🚨 Alerts & Monitoring
- **Real-time Alerts**: Set up alerts for arbitrage opportunities
- **Custom Filtering**: Create alerts by spread, category, and confidence
- **Persistent Storage**: Alerts saved to database for long-term monitoring

## Tech Stack

### Frontend
- **Next.js 16** - React framework with server components
- **React 19** - Modern React with hooks
- **Tailwind CSS v4** - Utility-first CSS
- **shadcn/ui** - High-quality component library (40+ components)
- **Recharts** - Data visualization
- **SWR** - Client-side data fetching and caching
- **Lucide Icons** - Beautiful icon set

### Backend & APIs
- **Next.js API Routes** - Serverless backend
- **Socket.io** - Real-time websocket communication
- **Neon PostgreSQL** - Serverless database for alerts
- **Node.js 18+** - JavaScript runtime

### Market Data Sources
- **Polymarket API** - `https://polymarket.com/api`
- **Kalshi API** - `https://api.elections.kalshi.com/trade-api/v2`

## Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout with metadata
│   ├── page.tsx                # Home page entry point
│   └── api/
│       ├── markets/route.ts    # Markets aggregation (GET)
│       ├── arbitrage/route.ts  # Arbitrage detection (GET)
│       ├── analytics/route.ts  # Analytics & statistics (GET)
│       ├── alerts/route.ts     # Alert management (CRUD)
│       └── sync-markets/route.ts # Manual sync endpoint
├── components/
│   ├── dashboard-content.tsx   # Main dashboard layout & navigation
│   ├── market-browser.tsx      # Market search & display
│   ├── market-browser-live.tsx # Real-time market updates
│   ├── arbitrage-scanner.tsx   # Arbitrage viewer & filters
│   ├── analytics-dashboard.tsx # Charts & statistics
│   ├── alerts-panel.tsx        # Alert configuration UI
│   └── ui/                     # shadcn/ui component library
├── lib/
│   ├── polymarket-client.ts    # Polymarket API client
│   ├── kalshi-client.ts        # Kalshi API client
│   ├── arbitrage-engine.ts     # Core arbitrage matching logic
│   ├── market-aggregator.ts    # Multi-exchange data merging
│   ├── alerts-service.ts       # Alert business logic
│   ├── realtime-server.ts      # Socket.io server setup
│   ├── mock-data.ts            # Fallback data
│   ├── db.ts                   # Neon database client
│   └── utils.ts                # Utility functions
├── hooks/
│   ├── use-realtime.ts         # Real-time data hook
│   └── use-toast.ts            # Toast notifications
└── public/                     # Static assets & icons
```

## Getting Started

### Prerequisites
- Node.js 18 or later
- npm, yarn, pnpm, or bun package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd prediction-market-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional, for database features)
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local`:
   ```env
   DATABASE_URL=your_neon_database_url
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:3000`

## Usage Guide

### Markets Tab
- Browse all markets from Polymarket and Kalshi
- Search by market title or keywords
- Filter by category
- View real-time prices, volumes, and liquidity

### Arbitrage Tab
- View cross-exchange arbitrage opportunities
- Adjust **Minimum Spread** slider to find profitable trades
- Filter by category
- Check spread %, profit margin, and match confidence
- Identify matched market pairs from each exchange

### Analytics Tab
- Review aggregate market statistics
- See category breakdowns with volume and prices
- Identify trending markets
- Track top movers by price change
- Analyze price distribution across all markets

### Alerts Tab
- Create custom alerts for specific opportunities
- Set spread thresholds and category preferences
- Receive notifications when conditions are met

## API Reference

### GET /api/markets
Fetch and search markets from both exchanges.

**Query Parameters:**
- `type`: `all` | `trending` | `movers` | `search`
- `q`: Search query (for search type)
- `category`: Filter by category
- `limit`: Number of results (default: 100)

**Response:**
```json
{
  "success": true,
  "count": 200,
  "markets": [
    {
      "id": "polymarket_0x123...",
      "title": "Will Bitcoin reach $100k by 2025?",
      "category": "Crypto",
      "source": "polymarket",
      "price": 0.65,
      "bestBid": 0.64,
      "bestAsk": 0.66,
      "liquidity": 50000,
      "volume24h": 125000
    }
  ]
}
```

### GET /api/arbitrage
Detect cross-exchange arbitrage opportunities.

**Query Parameters:**
- `minSpread`: Minimum spread % (default: 2)
- `category`: Filter by category

**Response:**
```json
{
  "success": true,
  "opportunities": [
    {
      "id": "arb_poly_kalshi_yes_0x123",
      "title": "Will Bitcoin reach $100k by 2025? (YES)",
      "buyExchange": "polymarket",
      "sellExchange": "kalshi",
      "buyPrice": 0.62,
      "sellPrice": 0.68,
      "spreadPercentage": 9.67,
      "profitMargin": 8.67,
      "confidence": "high",
      "matchScore": 0.89
    }
  ],
  "stats": {
    "polymarket_count": 200,
    "kalshi_count": 200,
    "opportunities_count": 45
  }
}
```

### GET /api/analytics
Get market statistics and analytics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_markets": 400,
    "polymarket_count": 200,
    "kalshi_count": 200,
    "avg_price": 0.52,
    "total_volume_24h": 5000000
  },
  "trending": [...],
  "movers": [...],
  "categories": [...],
  "distribution": [...]
}
```

### Alert Endpoints
- `GET /api/alerts` - Get all alerts
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

## How Arbitrage Detection Works

1. **Market Fetching**: Simultaneously fetch 200 markets from each exchange
2. **Market Matching**: 
   - First attempt exact title match (case-insensitive)
   - Fall back to fuzzy matching using Jaccard similarity and character overlap
3. **Price Normalization**: Convert prices to standard 0-1 decimal range
4. **Spread Calculation**: Compare YES/NO prices across exchanges
5. **Confidence Scoring**: Rate match quality (0-1) based on title similarity
6. **Filtering**: Exclude low-confidence (<0.25) and small spreads (<2%)
7. **Profit Analysis**: Calculate profit margin after ~1% trading fee

## Performance

- **Parallel Requests**: Both exchanges queried simultaneously (~2-5s load)
- **Response Caching**: SWR provides automatic cache + revalidation
- **Graceful Degradation**: Falls back to mock data if APIs unavailable
- **Database Optional**: Alert persistence is optional, app works without DB
- **Real-time Updates**: Socket.io for live market data (when running server)

## Troubleshooting

### No Markets Showing
- Check browser network tab for API errors
- Verify API endpoints are accessible
- Try refreshing the page
- Check if running behind a proxy with CORS restrictions

### Zero Arbitrage Opportunities
- Most markets don't have exact matches across exchanges
- Spread must be >2% to be detected
- Adjust the minimum spread filter lower to see more matches
- Some markets are unique to one exchange

### Slow Initial Load
- First load fetches 400+ markets total (5-10 seconds expected)
- Subsequent updates are faster due to caching
- Check network tab for slow API responses
- Clear browser cache if experiencing slowness

### Database Errors
- Alerts require Neon database setup
- If DB unavailable, alerts simply won't persist
- App works fine without database for market viewing

## Deployment

The app is deployed on Vercel and syncs automatically from this repository.

**Live at:** https://vercel.com/ead8s-projects/v0-prediction-market-platform

To deploy your own version:
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically or manually

## Contributing

Improvements welcome! Potential areas:
- Additional exchanges (Manifold, Gnosis, PredictIt)
- Machine learning for market matching
- Advanced charting and technical analysis
- Portfolio tracking and P&L
- Custom alert conditions
- Market sentiment analysis

## Disclaimer

⚠️ **For informational purposes only.** This tool is not financial advice. Prediction markets involve significant risk. Always conduct your own research before trading. The authors are not liable for losses incurred through use of this platform.

## License

MIT

## Support

For help:
1. Check the Troubleshooting section above
2. Review browser console logs (F12)
3. Check API response in Network tab
4. Open an issue with error details
