-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Markets table - stores unified market data from both Polymarket and Kalshi
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT NOT NULL,
  exchange TEXT NOT NULL, -- 'polymarket' or 'kalshi'
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image_url TEXT,
  base_token TEXT,
  quote_token TEXT,
  
  -- Market state
  status TEXT DEFAULT 'active', -- active, expired, resolved, cancelled
  probability DECIMAL(5, 2), -- Yes probability 0-100
  liquidity DECIMAL(20, 2),
  volume_24h DECIMAL(20, 2) DEFAULT 0,
  volume_7d DECIMAL(20, 2) DEFAULT 0,
  
  -- Pricing
  best_bid DECIMAL(8, 6),
  best_ask DECIMAL(8, 6),
  last_price DECIMAL(8, 6),
  
  -- Time data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Unique constraint per exchange
  UNIQUE(external_id, exchange)
);

-- Price history table - stores snapshots for analytics
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  yes_price DECIMAL(8, 6),
  no_price DECIMAL(8, 6),
  probability DECIMAL(5, 2),
  liquidity DECIMAL(20, 2),
  volume_24h DECIMAL(20, 2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Market aggregation metadata
CREATE TABLE IF NOT EXISTS market_aggregation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  is_trending BOOLEAN DEFAULT FALSE,
  price_change_24h DECIMAL(8, 2), -- percentage
  price_change_7d DECIMAL(8, 2),
  volume_rank_24h INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User watchlists for future portfolio tracking
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_session TEXT NOT NULL, -- anonymous session ID
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_markets_exchange ON markets(exchange);
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_category ON markets(category);
CREATE INDEX idx_markets_updated_at ON markets(updated_at DESC);
CREATE INDEX idx_price_history_market_id ON price_history(market_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX idx_market_aggregation_market_id ON market_aggregation(market_id);
CREATE INDEX idx_market_aggregation_is_trending ON market_aggregation(is_trending);
CREATE INDEX idx_watchlists_user_session ON watchlists(user_session);
