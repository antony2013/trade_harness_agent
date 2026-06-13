import type { Candle } from "../../types/market";

export interface BacktestTrade {
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  action: "BUY" | "SELL"; // BUY = Long entry, SELL = Long exit (shorting not implemented for simple equity)
  quantity: number;
  pnl: number;
  pnl_percent: number;
  result: "WIN" | "LOSS";
  exit_reason: "TARGET" | "STOP_LOSS" | "STRATEGY_EXIT" | "END_OF_DATA";
}

export interface BacktestReport {
  initial_balance: number;
  final_balance: number;
  total_pnl: number;
  pnl_percent: number;
  trades_count: number;
  win_rate: number;
  max_drawdown_percent: number;
  sharpe_ratio: number;
  trades: BacktestTrade[];
}

type StrategyFunction = (candles: Candle[], currentIndex: number) => "BUY" | "SELL" | "HOLD";

/**
 * Backtests a trading strategy over historical candles
 */
export function runBacktest(
  candles: Candle[],
  strategy: StrategyFunction,
  initialBalance = 100000,
  riskFraction = 0.05 // Risk 5% of balance per trade
): BacktestReport {
  if (candles.length < 5) {
    return {
      initial_balance: initialBalance,
      final_balance: initialBalance,
      total_pnl: 0,
      pnl_percent: 0,
      trades_count: 0,
      win_rate: 0,
      max_drawdown_percent: 0,
      sharpe_ratio: 0,
      trades: [],
    };
  }

  let balance = initialBalance;
  let equity = initialBalance;
  const equityCurve: number[] = [initialBalance];
  const trades: BacktestTrade[] = [];

  interface ActivePosition {
    entry_index: number;
    entry_price: number;
    entry_time: string;
    quantity: number;
    stop_loss: number;
    target_price: number;
  }

  let activePosition: ActivePosition | null = null;
  let peakEquity = initialBalance;
  let maxDrawdown = 0;

  for (let i = 20; i < candles.length; i++) {
    const currentCandle = candles[i];
    const prevCandle = candles[i - 1];

    // Track equity
    if (activePosition) {
      equity = balance + (currentCandle.close - activePosition.entry_price) * activePosition.quantity;
    } else {
      equity = balance;
    }
    equityCurve.push(equity);
    
    // Update drawdown
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    // Check stop loss / target hits for active position
    if (activePosition) {
      let closed = false;
      let exitPrice = 0;
      let reason: "TARGET" | "STOP_LOSS" | "STRATEGY_EXIT" | "END_OF_DATA" = "TARGET";

      if (currentCandle.low <= activePosition.stop_loss) {
        // Hit Stop Loss
        closed = true;
        exitPrice = activePosition.stop_loss;
        reason = "STOP_LOSS";
      } else if (currentCandle.high >= activePosition.target_price) {
        // Hit Take Profit Target
        closed = true;
        exitPrice = activePosition.target_price;
        reason = "TARGET";
      } else {
        // Check if strategy emits exit signal
        const signal = strategy(candles.slice(0, i + 1), i);
        if (signal === "SELL") {
          closed = true;
          exitPrice = currentCandle.close;
          reason = "STRATEGY_EXIT";
        }
      }

      // If last candle and position still open, force close it
      if (!closed && i === candles.length - 1) {
        closed = true;
        exitPrice = currentCandle.close;
        reason = "END_OF_DATA";
      }

      if (closed) {
        const pnl = (exitPrice - activePosition.entry_price) * activePosition.quantity;
        balance += pnl;
        equity = balance;
        
        const pnlPercent = ((exitPrice - activePosition.entry_price) / activePosition.entry_price) * 100;

        trades.push({
          entry_time: activePosition.entry_time,
          exit_time: currentCandle.time,
          entry_price: activePosition.entry_price,
          exit_price: exitPrice,
          action: "BUY",
          quantity: activePosition.quantity,
          pnl,
          pnl_percent: pnlPercent,
          result: pnl > 0 ? "WIN" : "LOSS",
          exit_reason: reason,
        });

        activePosition = null;
      }
    } else {
      // Evaluate entry signal
      const signal = strategy(candles.slice(0, i + 1), i);
      if (signal === "BUY" && i < candles.length - 1) {
        // We will buy at the close of current candle, setting target/stop loss
        const entryPrice = currentCandle.close;
        
        // Simple stop loss (1.5% below) and target (3% above)
        const stopLoss = entryPrice * 0.985;
        const targetPrice = entryPrice * 1.03;

        // Position sizing based on balance
        const allocation = balance * riskFraction;
        const quantity = Math.floor(allocation / entryPrice);

        if (quantity > 0) {
          activePosition = {
            entry_index: i,
            entry_price: entryPrice,
            entry_time: currentCandle.time,
            quantity,
            stop_loss: stopLoss,
            target_price: targetPrice,
          };
        }
      }
    }
  }

  // Calculate Sharpe Ratio (simplified daily returns proxy)
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }

  const averageReturn = returns.reduce((sum, r) => sum + r, 0) / (returns.length || 1);
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - averageReturn, 2), 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance);
  
  // Annualized Sharpe proxy (assuming daily candles, 252 trading days)
  const riskFreeRate = 0.0002; // ~5% annualized daily risk-free rate proxy
  const sharpeRatio = stdDev > 0 ? (averageReturn - riskFreeRate) / stdDev * Math.sqrt(252) : 0;

  const totalPnl = balance - initialBalance;
  const winRate = trades.length > 0 ? (trades.filter((t) => t.result === "WIN").length / trades.length) * 100 : 0;

  return {
    initial_balance: initialBalance,
    final_balance: balance,
    total_pnl: totalPnl,
    pnl_percent: (totalPnl / initialBalance) * 100,
    trades_count: trades.length,
    win_rate: winRate,
    max_drawdown_percent: maxDrawdown,
    sharpe_ratio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
    trades,
  };
}
