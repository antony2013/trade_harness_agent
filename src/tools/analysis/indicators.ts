import type { Candle } from "../../types/market";

/**
 * Computes Simple Moving Average (SMA)
 */
export function computeSMA(values: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(NaN); // Not enough data
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

/**
 * Computes Exponential Moving Average (EMA)
 */
export function computeEMA(values: number[], period: number): number[] {
  const ema: number[] = [];
  if (values.length === 0) return ema;

  const k = 2 / (period + 1);
  let prevEma = values[0];
  ema.push(prevEma);

  for (let i = 1; i < values.length; i++) {
    // If we don't have enough data to start, use simple value,
    // once we reach period, we smooth it
    const val = values[i];
    const currentEma = val * k + prevEma * (1 - k);
    ema.push(currentEma);
    prevEma = currentEma;
  }

  // Set the initial values as NaN until we reach the period to match standard EMA conventions
  for (let i = 0; i < Math.min(period - 1, ema.length); i++) {
    ema[i] = NaN;
  }

  return ema;
}

/**
 * Computes Relative Strength Index (RSI)
 */
export function computeRSI(candles: Candle[], period: number = 14): number[] {
  const rsi: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return rsi;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // First RSI value calculation (SMA of first 'period' gains and losses)
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  // Subsequent Wilder's smoothing
  for (let i = period + 1; i < candles.length; i++) {
    const currentGain = gains[i - 1];
    const currentLoss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }

  return rsi;
}

/**
 * Computes Moving Average Convergence Divergence (MACD)
 */
export function computeMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const len = candles.length;
  const closes = candles.map((c) => c.close);

  const fastEma = computeEMA(closes, fastPeriod);
  const slowEma = computeEMA(closes, slowPeriod);

  const macd: number[] = [];
  for (let i = 0; i < len; i++) {
    if (isNaN(fastEma[i]) || isNaN(slowEma[i])) {
      macd.push(NaN);
    } else {
      macd.push(fastEma[i] - slowEma[i]);
    }
  }

  // Extract non-NaN portion of MACD to compute Signal EMA
  const signal = computeEMA(macd, signalPeriod);
  const histogram: number[] = [];

  for (let i = 0; i < len; i++) {
    if (isNaN(macd[i]) || isNaN(signal[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macd[i] - signal[i]);
    }
  }

  return { macd, signal, histogram };
}

/**
 * Computes Bollinger Bands
 */
export function computeBollingerBands(
  candles: Candle[],
  period = 20,
  multiplier = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const closes = candles.map((c) => c.close);
  const middle = computeSMA(closes, period);
  const upper: number[] = new Array(candles.length).fill(NaN);
  const lower: number[] = new Array(candles.length).fill(NaN);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    
    // Variance calculation
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper[i] = mean + multiplier * stdDev;
    lower[i] = mean - multiplier * stdDev;
  }

  return { upper, middle, lower };
}

/**
 * Computes Average True Range (ATR)
 */
export function computeATR(candles: Candle[], period = 14): number[] {
  const atr: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return atr;

  const trueRanges: number[] = [candles[0].high - candles[0].low]; // First TR is just high - low

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Initial ATR is SMA of True Ranges
  let currentAtr = trueRanges.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  atr[period - 1] = currentAtr;

  // Wilder's smoothing
  for (let i = period; i < candles.length; i++) {
    currentAtr = (currentAtr * (period - 1) + trueRanges[i]) / period;
    atr[i] = currentAtr;
  }

  return atr;
}

/**
 * Computes Volume Weighted Average Price (VWAP)
 * Resets daily based on date change in candle times
 */
export function computeVWAP(candles: Candle[]): number[] {
  const vwap: number[] = [];
  let cumulativeTypicalPriceVolume = 0;
  let cumulativeVolume = 0;
  let prevDateStr = "";

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    
    // Check if candle time is a string and get the date portion (YYYY-MM-DD)
    const dateStr = typeof candle.time === "string" 
      ? candle.time.split("T")[0] 
      : new Date(candle.time).toISOString().split("T")[0];

    // Reset VWAP cumulatives if a new day starts
    if (dateStr !== prevDateStr) {
      cumulativeTypicalPriceVolume = 0;
      cumulativeVolume = 0;
      prevDateStr = dateStr;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTypicalPriceVolume += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    if (cumulativeVolume === 0) {
      vwap.push(candle.close); // Fallback to close
    } else {
      vwap.push(cumulativeTypicalPriceVolume / cumulativeVolume);
    }
  }

  return vwap;
}
