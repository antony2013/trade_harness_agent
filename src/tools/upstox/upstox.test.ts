import { test, expect, describe, mock, beforeAll, afterAll } from "bun:test";
import { getAccessToken, getHeaders, getBaseUrl } from "./auth";
import { fetchMarketQuote, fetchHistoricalCandles } from "./market-data";
import { placeOrder } from "./orders";
import { fetchAccountSummary } from "./portfolio";
import { env } from "../../config/env";

describe("Upstox API Tools Test Suite", () => {
  // Save original fetch
  const originalFetch = global.fetch;

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("Auth Utility Baseline Checks", () => {
    const baseUrl = getBaseUrl();
    expect(baseUrl).toBe("https://api.upstox.com/v2"); // Always live base URL for data

    const headers = getHeaders();
    expect(headers).toHaveProperty("Accept", "application/json");
  });

  test("Market Data - fetchMarketQuote", async () => {
    // Mock fetch for quote endpoint
    global.fetch = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "success",
            data: {
              "NSE_EQ|INE062A01020": {
                last_price: 830.45,
                volume: 124500,
                average_price: 829.1,
                net_change: 4.5,
                last_trade_time: "2026-06-13T11:45:00+05:30",
                depth: {
                  buy: [{ quantity: 50, price: 830.0, orders: 1 }],
                  sell: [{ quantity: 100, price: 830.5, orders: 2 }],
                },
              },
            },
          })
        )
      );
    });

    const quote = await fetchMarketQuote("NSE_EQ|INE062A01020");
    expect(quote.instrument_key).toBe("NSE_EQ|INE062A01020");
    expect(quote.last_price).toBe(830.45);
    expect(quote.volume).toBe(124500);
    expect(quote.total_buy_quantity).toBe(50);
  });

  test("Market Data - fetchHistoricalCandles", async () => {
    // Mock fetch for historical candles endpoint
    global.fetch = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "success",
            data: {
              candles: [
                ["2026-06-12T00:00:00+05:30", 820.0, 835.0, 819.0, 830.0, 450000, 0],
                ["2026-06-11T00:00:00+05:30", 810.0, 825.0, 808.0, 821.0, 320000, 0],
              ],
            },
          })
        )
      );
    });

    const candles = await fetchHistoricalCandles("NSE_EQ|INE062A01020", "day", "2026-06-12", "2026-06-11");
    
    expect(candles).toHaveLength(2);
    // Verified sorting is oldest first (reversed)
    expect(candles[0].time).toBe("2026-06-11T00:00:00+05:30");
    expect(candles[0].close).toBe(821.0);
    expect(candles[1].time).toBe("2026-06-12T00:00:00+05:30");
    expect(candles[1].close).toBe(830.0);
  });

  test("Trading - placeOrder", async () => {
    const originalMode = env.TRADING_MODE;
    env.TRADING_MODE = "live";

    // Mock fetch for place order endpoint
    global.fetch = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "success",
            data: {
              order_id: "2606130005",
            },
          })
        )
      );
    });

    try {
      const order = await placeOrder({
        quantity: 1,
        product: "I",
        validity: "DAY",
        price: 830.0,
        instrument_token: "NSE_EQ|INE062A01020",
        order_type: "LIMIT",
        transaction_type: "BUY",
      });

      expect(order.order_id).toBe("2606130005");
    } finally {
      env.TRADING_MODE = originalMode;
    }
  });

  test("Portfolio - fetchAccountSummary", async () => {
    global.fetch = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "success",
            data: {
              equity: {
                opening_balance: 150000,
                available_margin: 140000,
                used_margin: 10000,
                payin: 0,
                payout: 0,
              },
            },
          })
        )
      );
    });

    const summary = await fetchAccountSummary();
    expect(summary.balance).toBe(150000);
    expect(summary.margin_available).toBe(140000);
    expect(summary.margin_used).toBe(10000);
  });
});
