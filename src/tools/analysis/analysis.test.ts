import { test, expect, describe } from "bun:test";
import {
  computeSMA,
  computeEMA,
  computeRSI,
  computeMACD,
  computeBollingerBands,
  computeATR,
  computeVWAP,
} from "./indicators";
import { detectBreakouts, detectCandlestickPatterns } from "./patterns";
import { runBacktest } from "./backtester";
import type { Candle } from "../../types/market";

describe("Quantitative Analysis Tools Test Suite", () => {
  // Mock candle data
  const testCandles: Candle[] = [
    { time: "2026-06-01T09:15:00Z", open: 100, high: 105, low: 99, close: 102, volume: 1000 },
    { time: "2026-06-01T09:30:00Z", open: 102, high: 104, low: 101, close: 103, volume: 1500 },
    { time: "2026-06-01T09:45:00Z", open: 103, high: 106, low: 102, close: 105, volume: 2000 },
    { time: "2026-06-01T10:00:00Z", open: 105, high: 108, low: 104, close: 107, volume: 1200 },
    { time: "2026-06-01T10:15:00Z", open: 107, high: 107, low: 102, close: 103, volume: 2500 }, // Bearish Drop
    { time: "2026-06-01T10:30:00Z", open: 103, high: 104, low: 98, close: 99, volume: 3000 },   // Massive drop
  ];

  test("Moving Averages", () => {
    const closes = testCandles.map((c) => c.close);
    const sma = computeSMA(closes, 3);
    
    // SMA calculations:
    // First 2 elements should be NaN
    expect(sma[0]).toBeNaN();
    expect(sma[1]).toBeNaN();
    // Index 2: (102 + 103 + 105) / 3 = 310 / 3 = 103.33333333333333
    expect(sma[2]).toBeCloseTo(103.33, 2);
    // Index 3: (103 + 105 + 107) / 3 = 105
    expect(sma[3]).toBe(105);

    const ema = computeEMA(closes, 3);
    expect(ema[0]).toBeNaN();
    expect(ema[1]).toBeNaN();
    // EMA smooths properly
    expect(ema[2]).toBeGreaterThan(100);
  });

  test("VWAP calculations", () => {
    const vwap = computeVWAP(testCandles);
    // Checked cumulative typical price * volume math
    expect(vwap).toHaveLength(testCandles.length);
    expect(vwap[0]).toBeCloseTo((105 + 99 + 102) / 3, 2);
  });

  test("ATR calculations", () => {
    const atr = computeATR(testCandles, 3);
    expect(atr).toHaveLength(testCandles.length);
    // ATR values are smoothed true ranges
    expect(atr[0]).toBeNaN();
    expect(Number.isNaN(atr[3])).toBe(false);
  });

  test("RSI calculations", () => {
    // Generate a long list of candles to satisfy 14-period RSI
    const longCandles: Candle[] = [];
    let price = 100;
    for (let i = 0; i < 30; i++) {
      // Alternating up and down candles
      price += i % 2 === 0 ? 2 : -1;
      longCandles.push({
        time: `2026-06-${i + 1}T09:15:00Z`,
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000,
      });
    }
    const rsi = computeRSI(longCandles, 14);
    expect(rsi[13]).toBeNaN();
    expect(Number.isNaN(rsi[14])).toBe(false);
    expect(rsi[14]).toBeGreaterThan(0);
    expect(rsi[14]).toBeLessThan(100);
  });

  test("Breakout and Candlestick Pattern Detections", () => {
    // Engulfing pattern test
    const engulfingCandles: Candle[] = [
      { time: "2026-06-01T09:00:00Z", open: 102, high: 103, low: 99, close: 100, volume: 100 }, // Bearish
      { time: "2026-06-01T09:15:00Z", open: 99.5, high: 103, low: 99, close: 102.5, volume: 100 }, // Bullish Engulfing
    ];
    const patterns = detectCandlestickPatterns(engulfingCandles);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].pattern_name).toBe("Bullish Engulfing");
    expect(patterns[0].type).toBe("BULLISH");

    const breakoutSignals = detectBreakouts(testCandles, 3);
    // Last candle is 99 (close) which breaks below support of 102 (from preceding candles 103, 105, 107)
    expect(breakoutSignals.length).toBeGreaterThan(0);
    expect(breakoutSignals[0].pattern_name).toBe("Support Breakdown");
    expect(breakoutSignals[0].type).toBe("BEARISH");
  });

  test("Strategy Backtesting", () => {
    // Strategy: BUY if RSI < 40, SELL if RSI > 70
    const backtestCandles: Candle[] = [];
    let price = 100;
    for (let i = 0; i < 50; i++) {
      // Simulate cyclic wave
      const wave = Math.sin(i * 0.5) * 5;
      price = 100 + wave;
      backtestCandles.push({
        time: `2026-06-${i + 1}T09:15:00Z`,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000 + Math.floor(Math.random() * 500),
      });
    }

    const simpleStrategy = (candles: Candle[], index: number) => {
      // Generate BUY on low prices, SELL on high prices
      const close = candles[index].close;
      if (close < 97) return "BUY";
      if (close > 103) return "SELL";
      return "HOLD";
    };

    const report = runBacktest(backtestCandles, simpleStrategy, 100000, 0.1);
    expect(report.initial_balance).toBe(100000);
    expect(report.trades_count).toBeGreaterThan(0);
    expect(report.max_drawdown_percent).toBeGreaterThanOrEqual(0);
  });
});
