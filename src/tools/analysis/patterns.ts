import type { Candle } from "../../types/market";
import { computeSMA } from "./indicators";

export interface PatternSignal {
  pattern_name: string;
  type: "BULLISH" | "BEARISH";
  confidence: number; // 0 to 100
  description: string;
}

/**
 * Detects volume-confirmed support/resistance breakouts
 */
export function detectBreakouts(candles: Candle[], lookbackPeriod = 20): PatternSignal[] {
  const signals: PatternSignal[] = [];
  const len = candles.length;
  if (len <= lookbackPeriod) return signals;

  const currentCandle = candles[len - 1];
  const slice = candles.slice(len - lookbackPeriod - 1, len - 1);
  const closes = slice.map((c) => c.close);
  const volumes = slice.map((c) => c.volume);

  const resistance = Math.max(...closes);
  const support = Math.min(...closes);

  // Compute average volume for confirmation
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / lookbackPeriod;
  const isVolumeConfirmed = currentCandle.volume > avgVolume * 1.5;

  if (currentCandle.close > resistance) {
    signals.push({
      pattern_name: "Resistance Breakout",
      type: "BULLISH",
      confidence: isVolumeConfirmed ? 85 : 55,
      description: `Price broke above resistance of ${resistance.toFixed(2)}${
        isVolumeConfirmed ? " with strong volume confirmation." : "."
      }`,
    });
  } else if (currentCandle.close < support) {
    signals.push({
      pattern_name: "Support Breakdown",
      type: "BEARISH",
      confidence: isVolumeConfirmed ? 85 : 55,
      description: `Price broke below support of ${support.toFixed(2)}${
        isVolumeConfirmed ? " with strong volume confirmation." : "."
      }`,
    });
  }

  return signals;
}

/**
 * Detects candlestick patterns on the most recent candles
 */
export function detectCandlestickPatterns(candles: Candle[]): PatternSignal[] {
  const signals: PatternSignal[] = [];
  const len = candles.length;
  if (len < 2) return signals;

  const curr = candles[len - 1];
  const prev = candles[len - 2];

  const currBody = Math.abs(curr.close - curr.open);
  const currRange = curr.high - curr.low;

  const prevBody = Math.abs(prev.close - prev.open);

  const isCurrBullish = curr.close > curr.open;
  const isCurrBearish = curr.close < curr.open;
  const isPrevBullish = prev.close > prev.open;
  const isPrevBearish = prev.close < prev.open;

  // 1. Engulfing Patterns
  if (isPrevBearish && isCurrBullish && curr.close > prev.open && curr.open < prev.close) {
    signals.push({
      pattern_name: "Bullish Engulfing",
      type: "BULLISH",
      confidence: 75,
      description: "Bullish candle body completely engulfs the previous bearish candle body.",
    });
  } else if (isPrevBullish && isCurrBearish && curr.close < prev.open && curr.open > prev.close) {
    signals.push({
      pattern_name: "Bearish Engulfing",
      type: "BEARISH",
      confidence: 75,
      description: "Bearish candle body completely engulfs the previous bullish candle body.",
    });
  }

  // 2. Hammer & Shooting Star
  if (currRange > 0) {
    const lowerShadow = isCurrBullish ? curr.open - curr.low : curr.close - curr.low;
    const upperShadow = isCurrBullish ? curr.high - curr.close : curr.high - curr.open;

    // Hammer: Small body near high, long lower shadow, minimal upper shadow
    if (lowerShadow > currBody * 2 && upperShadow < currBody * 0.5) {
      signals.push({
        pattern_name: "Hammer",
        type: "BULLISH",
        confidence: 65,
        description: "Bullish reversal candle with a long lower shadow and a small body near the high.",
      });
    }

    // Shooting Star: Small body near low, long upper shadow, minimal lower shadow
    if (upperShadow > currBody * 2 && lowerShadow < currBody * 0.5) {
      signals.push({
        pattern_name: "Shooting Star",
        type: "BEARISH",
        confidence: 65,
        description: "Bearish reversal candle with a long upper shadow and a small body near the low.",
      });
    }
  }

  return signals;
}
