export interface Tick {
  instrument_key: string;
  price: number;
  volume: number;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Candle {
  time: string; // ISO String or epoch milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketQuote {
  instrument_key: string;
  last_price: number;
  volume: number;
  average_price: number;
  oi?: number;
  net_change: number;
  total_buy_quantity: number;
  total_sell_quantity: number;
  last_trade_time: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  score?: number; // -1 to +1
}

export interface FundamentalMetrics {
  instrument_key: string;
  symbol: string;
  market_cap: number;      // In INR
  pe_ratio: number;
  pb_ratio: number;
  dividend_yield: number;
  debt_to_equity: number;
  roe: number;             // Return on Equity (%)
  eps: number;             // Earnings Per Share
  revenue_growth: number;  // Year-over-Year (%)
  net_profit_margin: number;
}
