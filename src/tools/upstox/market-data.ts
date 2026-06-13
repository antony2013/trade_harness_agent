import { getBaseUrl, getHeaders } from "./auth";
import type { Candle, MarketQuote } from "../../types/market";
import type { UpstoxResponse, UpstoxRawQuote } from "../../types/upstox";

/**
 * Fetches real-time market quote for a given instrument key (or comma-separated list of keys)
 * Endpoint: GET /market-quote/quotes?symbol=NSE_EQ|INE062A01020
 */


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
    }

    return result;
  } catch (err: any) {
    throw new Error(`[MarketData] fetchMarketQuotes failed: ${err.message}`);
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
      headers: getHeaders(),
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
    throw new Error(`[MarketData] fetchHistoricalCandles failed: ${err.message}`);
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
    throw new Error(`[MarketData] fetchNews failed: ${err.message}`);
  }
}
