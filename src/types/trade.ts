export interface TradeSignal {
  instrument_key: string;
  trading_symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  strategy: string;             // Name of the generating strategy
  confidence: number;           // 0 to 100
  entry_price: number;
  stop_loss: number;
  target_price: number;
  position_size: number;        // Recommended quantity
  reasoning: string;            // Explanation for decision
  analyst_scores: {
    technical: number;          // -1 (bearish) to +1 (bullish)
    fundamental: number;        // -1 to +1
    sentiment: number;          // -1 to +1
  };
  timestamp: string;
}

export interface Order {
  order_id: string;
  instrument_key: string;
  trading_symbol: string;
  transaction_type: "BUY" | "SELL";
  order_type: "MARKET" | "LIMIT" | "SL" | "SL-M";
  quantity: number;
  price: number;
  trigger_price?: number;
  status: "COMPLETE" | "REJECTED" | "CANCELLED" | "OPEN" | "TRIGGER_PENDING" | "VALIDATING";
  filled_quantity: number;
  average_price: number;
  status_message?: string;
  timestamp: string;
}

export interface Position {
  instrument_key: string;
  trading_symbol: string;
  quantity: number;          // Positive for Long, Negative for Short, 0 for Closed
  average_price: number;
  current_price: number;
  unrealized_pnl: number;
  realized_pnl: number;
  entry_time: string;
  exit_time?: string;
  status: "OPEN" | "CLOSED";
}

export interface AccountSummary {
  balance: number;            // Opening balance
  margin_available: number;   // Current free margin
  margin_used: number;        // Margin blocked in open trades
  total_equity: number;       // Balance + P&L
  unrealized_pnl: number;
  realized_pnl: number;
  daily_drawdown_percent: number;
  timestamp: string;
}

export interface TradeLog {
  id: string;
  timestamp: string;
  signal: TradeSignal;
  rl_evaluation?: {
    approved: boolean;
    score: number;
    q_value_diff: number;
    reasoning: string;
  };
  risk_evaluation?: {
    approved: boolean;
    rules_checked: string[];
    violated_rules: string[];
    adjusted_size?: number;
    reasoning: string;
  };
  order_placement?: {
    success: boolean;
    order_id?: string;
    error_message?: string;
  };
  execution?: {
    avg_price: number;
    quantity: number;
    fill_time: string;
  };
}
