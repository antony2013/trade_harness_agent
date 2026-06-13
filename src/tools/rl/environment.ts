import type { Candle, FundamentalMetrics } from "../../types/market";
import type { Position } from "../../types/trade";
import { computeRSI, computeEMA, computeATR, computeVWAP } from "../analysis/indicators";

export interface RLState {
  rsi: number;
  emaRatio: number;      // Close / EMA_20
  vwapRatio: number;     // Close / VWAP
  atrNormalized: number; // ATR_14 / Close
  positionStatus: number;// 0 = Flat, 1 = Long
  positionAge: number;   // Number of candles held
  consensusScore: number;// Aggregate analyst sentiments (-1 to +1)
}

export type RLAction = 0 | 1 | 2; // 0 = HOLD / NO_ACTION, 1 = BUY, 2 = SELL/EXIT

/**
 * Extracts the state vector for reinforcement learning from raw data
 */
export function getEnvironmentState(
  candles: Candle[],
  position: Position | null,
  analystScores: { technical: number; fundamental: number; sentiment: number }
): RLState {
  const len = candles.length;
  if (len < 20) {
    return {
      rsi: 50,
      emaRatio: 1.0,
      vwapRatio: 1.0,
      atrNormalized: 0.01,
      positionStatus: 0,
      positionAge: 0,
      consensusScore: 0,
    };
  }

  const currentClose = candles[len - 1].close;
  
  // Calculate indicators for current window
  const rsis = computeRSI(candles, 14);
  const rsi = isNaN(rsis[len - 1]) ? 50 : rsis[len - 1];

  const emas = computeEMA(candles.map((c) => c.close), 20);
  const ema = isNaN(emas[len - 1]) ? currentClose : emas[len - 1];
  const emaRatio = ema > 0 ? currentClose / ema : 1.0;

  const vwaps = computeVWAP(candles);
  const vwap = vwaps[len - 1] || currentClose;
  const vwapRatio = vwap > 0 ? currentClose / vwap : 1.0;

  const atrs = computeATR(candles, 14);
  const atr = isNaN(atrs[len - 1]) ? currentClose * 0.01 : atrs[len - 1];
  const atrNormalized = currentClose > 0 ? atr / currentClose : 0.01;

  // Aggregate analyst consensus (weighted: 50% tech, 20% fundamental, 30% sentiment)
  const consensusScore =
    analystScores.technical * 0.5 +
    analystScores.fundamental * 0.2 +
    analystScores.sentiment * 0.3;

  return {
    rsi,
    emaRatio,
    vwapRatio,
    atrNormalized,
    positionStatus: position && position.quantity > 0 ? 1 : 0,
    positionAge: position ? 1 : 0, // Simplified for state
    consensusScore,
  };
}

/**
 * Converts the state object into a flat float array for input into policy networks
 */
export function stateToArray(state: RLState): number[] {
  return [
    state.rsi / 100, // Normalize to 0-1
    state.emaRatio,
    state.vwapRatio,
    state.atrNormalized * 100, // Scale up slightly
    state.positionStatus,
    state.positionAge / 100,
    state.consensusScore,
  ];
}

/**
 * Calculates the reward for a given action and trade outcome
 */
export function calculateReward(
  action: RLAction,
  pnlAmount: number,
  pnlPercent: number,
  drawdownPercent: number,
  isPositionClosed: boolean
): number {
  let reward = 0;

  if (isPositionClosed) {
    // Large reward/penalty on position close based on P&L
    reward += pnlPercent * 10; // e.g. +3% pnl -> +30 reward, -2% pnl -> -20 reward
    
    // Penalize large drawdowns
    if (drawdownPercent > 2) {
      reward -= drawdownPercent * 5;
    }
  } else {
    // Small step rewards/penalties to guide the policy while holding or flat
    if (action === 0) {
      // Small penalty for holding cash to encourage active but safe trading
      reward -= 0.01;
    } else if (action === 1) {
      // Penalty for unnecessary trading cost/friction (slippage check)
      reward -= 0.1;
    }
  }

  return reward;
}
