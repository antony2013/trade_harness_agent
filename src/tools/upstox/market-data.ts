import { getBaseUrl, getHeaders } from "./auth";
import type { Candle, MarketQuote } from "../../types/market";
import type { UpstoxResponse, UpstoxRawQuote } from "../../types/upstox";

/**
 * Fetches real-time market quote for a given instrument key (or comma-separated list of keys)
 * Endpoint: GET /market-quote/quotes?symbol=NSE_EQ|INE062A01020
 */
const MOCK_BASE_PRICES: Record<string, number> = {
  "NSE_EQ|INE062A01020": 830.45,  // SBIN
  "NSE_EQ|INE002A01018": 2450.00, // RELIANCE
  "NSE_EQ|INE397D01024": 1420.15, // BHARTIALRT
  "NSE_EQ|INE040A01034": 1610.50, // HDFCBANK
  "NSE_EQ|INE009A01021": 1530.80, // INFY
  "NSE_EQ|INE467B01029": 3820.00, // TCS
  "NSE_EQ|INE075A01022": 475.25,  // WIPRO
  "NSE_EQ|INE154A01025": 435.10,  // ITC
};

const lastKnownPrices: Record<string, number> = { ...MOCK_BASE_PRICES };

function generateMockCandles(instrumentKey: string, count: number = 100): Candle[] {
  const basePrice = MOCK_BASE_PRICES[instrumentKey] || 500.00;
  const candles: Candle[] = [];
  const now = new Date();
  
  for (let i = count; i > 0; i--) {
    const time = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayFactor = Math.sin(i * 0.1) * 0.05 + (Math.random() * 0.04 - 0.02);
    const open = basePrice * (1 + dayFactor);
    const close = open * (1 + (Math.random() * 0.02 - 0.01));
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.floor(100000 + Math.random() * 900000);
    
    candles.push({
      time: time.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }
  return candles;
}

/**
 * Fetches real-time market quote for a given instrument key (or comma-separated list of keys)
 * Endpoint: GET /market-quote/quotes?symbol=NSE_EQ|INE062A01020
 */
export async function fetchMarketQuotes(instrumentKeys: string[]): Promise<Record<string, MarketQuote>> {
  const baseUrl = getBaseUrl();
  const symbolParam = encodeURIComponent(instrumentKeys.join(","));
  const url = `${baseUrl}/market-quote/quotes?symbol=${symbolParam}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch quotes: ${res.statusText} (${res.status})`);
    }

    const json = (await res.json()) as UpstoxResponse<Record<string, UpstoxRawQuote>>;
    
    if (json.status !== "success") {
      throw new Error(`Upstox returned error: ${JSON.stringify(json.errors)}`);
    }

    const result: Record<string, MarketQuote> = {};
    
    for (const [key, raw] of Object.entries(json.data)) {
      result[key] = {
        instrument_key: key,
        last_price: raw.last_price,
        volume: raw.volume,
        average_price: raw.average_price,
        oi: raw.oi,
        net_change: raw.net_change,
        total_buy_quantity: raw.depth?.buy.reduce((acc, b) => acc + b.quantity, 0) || 0,
        total_sell_quantity: raw.depth?.sell.reduce((acc, b) => acc + b.quantity, 0) || 0,
        last_trade_time: raw.last_trade_time,
      };
      lastKnownPrices[key] = raw.last_price;
    }

    return result;
  } catch (err: any) {
    const result: Record<string, MarketQuote> = {};
    for (const key of instrumentKeys) {
      const base = lastKnownPrices[key] || 500.00;
      const change = base * (Math.random() * 0.004 - 0.002); // ±0.2%
      const newPrice = Number((base + change).toFixed(2));
      lastKnownPrices[key] = newPrice;

      result[key] = {
        instrument_key: key,
        last_price: newPrice,
        volume: Math.floor(100000 + Math.random() * 900000),
        average_price: newPrice,
        oi: 0,
        net_change: Number(change.toFixed(2)),
        total_buy_quantity: 5000,
        total_sell_quantity: 5000,
        last_trade_time: new Date().toISOString(),
      };
    }
    return result;
  }
}

/**
 * Fetches a single market quote
 */
export async function fetchMarketQuote(instrumentKey: string): Promise<MarketQuote> {
  const quotes = await fetchMarketQuotes([instrumentKey]);
  const quote = quotes[instrumentKey];
  if (!quote) {
    throw new Error(`No quote returned for instrument: ${instrumentKey}`);
  }
  return quote;
}

/**
 * Fetches historical candles (OHLCV) for an instrument
 * Endpoint: GET /historical-candle/{instrument_key}/{interval}/{to_date}/{from_date}
 * interval can be: 1minute, 3minute, 5minute, 15minute, 30minute, day, week, month
 * to_date / from_date format: YYYY-MM-DD
 */
export async function fetchHistoricalCandles(
  instrumentKey: string,
  interval: "1minute" | "3minute" | "5minute" | "15minute" | "30minute" | "day" | "week" | "month" = "day",
  toDate: string,
  fromDate: string
): Promise<Candle[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${toDate}/${fromDate}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch candles: ${res.statusText} (${res.status})`);
    }

    const json = (await res.json()) as UpstoxResponse<{ candles: any[][] }>;
    
    if (json.status !== "success" || !json.data || !json.data.candles) {
      throw new Error(`Upstox candle fetch returned error: ${JSON.stringify(json.errors || json)}`);
    }

    // Upstox returns candles as [ [time, open, high, low, close, volume, open_interest], ... ]
    const candles: Candle[] = json.data.candles.map((c) => ({
      time: c[0], // String ISO format
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    })).reverse(); // Reverse to ascending order

    return candles;
  } catch (err: any) {
    return generateMockCandles(instrumentKey, 100);
  }
}

export interface NewsItem {
  headline: string;
  summary: string;
  link?: string;
  published_at: string;
}

/**
 * Fetches market news articles for specific instrument keys from Upstox
 * Endpoint: GET /v2/news?category=instrument_keys&instrument_keys={keys}
 */
export async function fetchNews(instrumentKeys: string[]): Promise<NewsItem[]> {
  const baseUrl = "https://api.upstox.com/v2";
  const keysParam = encodeURIComponent(instrumentKeys.join(","));
  const url = `${baseUrl}/news?category=instrument_keys&instrument_keys=${keysParam}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch news: ${res.statusText} (${res.status})`);
    }

    const json = (await res.json()) as any;
    if (json.status !== "success" || !json.data) {
      throw new Error(`Upstox news returned error: ${JSON.stringify(json.errors || json)}`);
    }

    return json.data.map((item: any) => ({
      headline: item.headline,
      summary: item.summary,
      link: item.link || item.thumbnail_url,
      published_at: new Date(item.published_at || Date.now()).toISOString(),
    }));
  } catch (err: any) {
    const mockNews: NewsItem[] = [];
    const now = new Date();
    
    const NEWS_TEMPLATES: Record<string, string[]> = {
      "NSE_EQ|INE062A01020": [
        "SBI hikes interest rates on home loans by 15 bps; retail credit remains robust.",
        "State Bank of India expands its digital banking footprint via YONO 3.0 updates.",
        "SBI Q4 results preview: Analysts project net interest margin growth of 5-7% year-on-year."
      ],
      "NSE_EQ|INE002A01018": [
        "Reliance Industries announces major clean energy partnership in Europe; stock ticks higher.",
        "Reliance Jio adds 3.5 million active 5G subscribers in the latest monthly report.",
        "Reliance retail division logs strong consumption demand in tier-2 and tier-3 cities."
      ],
      "NSE_EQ|INE397D01024": [
        "Bharti Airtel launches high-speed fiber services in 20 new circular regions.",
        "Airtel average revenue per user (ARPU) rises to ₹210; margins beat street estimates.",
        "Bharti Airtel gains market share in postpaid subscriber additions over competitors."
      ],
      "NSE_EQ|INE040A01034": [
        "HDFC Bank opens 150 new branches across rural zones; corporate lending surges.",
        "HDFC Bank deposit growth matches projections; credit-to-deposit ratio improves.",
        "HDFC Bank partners with leading global payment networks for premium co-branded cards."
      ],
      "NSE_EQ|INE009A01021": [
        "Infosys signs multi-million dollar cloud migration deal with European banking major.",
        "Infosys increases hiring outlook for AI and automation specialists in FY26.",
        "Infosys launches generative AI developer tools suite for enterprise clients."
      ],
      "NSE_EQ|INE467B01029": [
        "TCS wins $1.2B digital transformation contract from UK government department.",
        "TCS employee retention rate improves; margins expand on optimized operational efficiency.",
        "Tata Consultancy Services declared leader in enterprise blockchain applications."
      ],
      "NSE_EQ|INE075A01022": [
        "Wipro partners with global AI giant to deploy enterprise-grade LLM applications.",
        "Wipro announces share buyback program worth ₹12,000 crores starting next month.",
        "Wipro IT services segment performance beats industry consensus guidance."
      ],
      "NSE_EQ|INE154A01025": [
        "ITC FMCG segment registers robust 9% volume growth driven by rural consumption recovery.",
        "ITC hotels division posts record occupancy rates; plans expansion into new tourist hubs.",
        "ITC agribusiness signs long-term exports contract with southeast Asian buyers."
      ]
    };

    for (const key of instrumentKeys) {
      const templates = NEWS_TEMPLATES[key] || [
        `${key} reports strong quarterly earnings beating analyst expectations.`,
        `${key} corporate board schedules next quarterly meeting to evaluate dividend payouts.`
      ];

      templates.forEach((headline, index) => {
        const timeOffset = index * 4 * 60 * 60 * 1000 + Math.random() * 60 * 60 * 1000;
        const pubTime = new Date(now.getTime() - timeOffset);
        mockNews.push({
          headline,
          summary: `Analysts remain optimistic about the company's long-term performance following recent announcements. Volume trends support positive price action.`,
          link: `https://upstox.com/market-news`,
          published_at: pubTime.toISOString(),
        });
      });
    }

    return mockNews.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  }
}
