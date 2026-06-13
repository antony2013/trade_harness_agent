import * as z from "zod";
import * as vm from "vm";
import { tool } from "@langchain/core/tools";
import { fetchMarketQuote, fetchHistoricalCandles, fetchNews } from "../tools/upstox/market-data";
import { placeOrder, cancelOrder, fetchOrderBook } from "../tools/upstox/orders";
import { fetchPositions, fetchHoldings, fetchAccountSummary, exitAllPositions, triggerKillSwitch } from "../tools/upstox/portfolio";
import { computeRSI, computeEMA, computeATR, computeVWAP } from "../tools/analysis/indicators";
import { detectBreakouts, detectCandlestickPatterns } from "../tools/analysis/patterns";
import { policy } from "../tools/rl/jit-updater";
import { stateToArray } from "../tools/rl/environment";
import { enforceRiskRules } from "../tools/risk/enforcer";

// 1. Upstox Market Data Tools
export const getQuoteTool = tool(
  async ({ instrumentKey }) => {
    try {
      const quote = await fetchMarketQuote(instrumentKey);
      return JSON.stringify(quote, null, 2);
    } catch (err: any) {
      return `Error fetching quote: ${err.message}`;
    }
  },
  {
    name: "get_market_quote",
    description: "Fetch real-time price and volume quote details for an instrument key (e.g. NSE_EQ|INE062A01020)",
    schema: z.object({
      instrumentKey: z.string().describe("The unique Upstox instrument key"),
    }),
  }
);

export const getCandlesTool = tool(
  async ({ instrumentKey, interval, toDate, fromDate }) => {
    try {
      const candles = await fetchHistoricalCandles(
        instrumentKey,
        interval as any,
        toDate,
        fromDate
      );
      return JSON.stringify(candles, null, 2);
    } catch (err: any) {
      return `Error fetching candles: ${err.message}`;
    }
  },
  {
    name: "get_historical_candles",
    description: "Fetch historical OHLCV candles. Date format YYYY-MM-DD.",
    schema: z.object({
      instrumentKey: z.string().describe("Upstox instrument key"),
      interval: z.enum(["1minute", "3minute", "5minute", "15minute", "30minute", "day", "week", "month"]).default("day"),
      toDate: z.string().describe("End date YYYY-MM-DD"),
      fromDate: z.string().describe("Start date YYYY-MM-DD"),
    }),
  }
);

// 2. Upstox Order and Portfolio Tools
export const placeOrderTool = tool(
  async (params) => {
    try {
      const riskCheck = await enforceRiskRules({
        instrumentKey: params.instrumentKey,
        quantity: params.quantity,
        transactionType: params.transactionType as any,
      });

      if (!riskCheck.approved) {
        return JSON.stringify({
          error: "Risk rejection: " + riskCheck.reason,
          approved: false,
        });
      }

      const order = await placeOrder({
        quantity: riskCheck.adjustedQuantity,
        product: params.product as any,
        validity: params.validity as any,
        price: params.price,
        instrument_token: params.instrumentKey,
        order_type: params.orderType as any,
        transaction_type: params.transactionType as any,
        trigger_price: params.triggerPrice,
      });
      return JSON.stringify(order, null, 2);
    } catch (err: any) {
      return `Error placing order: ${err.message}`;
    }
  },
  {
    name: "place_broker_order",
    description: "Place a trade order via Upstox API",
    schema: z.object({
      instrumentKey: z.string().describe("Upstox instrument token"),
      transactionType: z.enum(["BUY", "SELL"]),
      orderType: z.enum(["MARKET", "LIMIT", "SL", "SL-M"]),
      quantity: z.number().describe("Quantity of shares to trade"),
      price: z.number().describe("Limit price (0 for market orders)"),
      triggerPrice: z.number().optional().describe("Trigger price for SL orders"),
      product: z.enum(["I", "D", "CO", "OCO"]).default("I").describe("I=Intraday, D=Delivery"),
      validity: z.enum(["DAY", "IOC"]).default("DAY"),
    }),
  }
);

export const getPositionsTool = tool(
  async () => {
    try {
      const positions = await fetchPositions();
      return JSON.stringify(positions, null, 2);
    } catch (err: any) {
      return `Error fetching positions: ${err.message}`;
    }
  },
  {
    name: "get_open_positions",
    description: "Fetch current active and completed intraday trading positions",
    schema: z.object({}),
  }
);

export const getAccountSummaryTool = tool(
  async () => {
    try {
      const summary = await fetchAccountSummary();
      return JSON.stringify(summary, null, 2);
    } catch (err: any) {
      return `Error fetching account summary: ${err.message}`;
    }
  },
  {
    name: "get_account_summary",
    description: "Fetch available capital balance, free margins, and daily P&L summary",
    schema: z.object({}),
  }
);

export const exitAllPositionsTool = tool(
  async () => {
    const success = await exitAllPositions();
    return success ? "Success: Exited all open positions." : "Error: Failed to exit all positions.";
  },
  {
    name: "exit_all_positions",
    description: "EMERGENCY: Instantly closes all active open positions in the portfolio",
    schema: z.object({}),
  }
);

export const triggerKillSwitchTool = tool(
  async ({ disable }) => {
    const success = await triggerKillSwitch(disable);
    return success
      ? `Success: Trading Kill Switch set to ${disable ? "DISABLE" : "ENABLE"}.`
      : "Error: Failed to set Kill Switch.";
  },
  {
    name: "trigger_kill_switch",
    description: "EMERGENCY: Halts or reactivates all order executions in the account",
    schema: z.object({
      disable: z.boolean().describe("true to disable all trading, false to enable"),
    }),
  }
);

// 3. Technical Indicator calculation tools (so agents can query indicator values programmatically)
export const calculateIndicatorsTool = tool(
  async ({ instrumentKey, toDate, fromDate }) => {
    try {
      const candles = await fetchHistoricalCandles(instrumentKey, "day", toDate, fromDate);
      if (candles.length === 0) return "No candle data found.";

      const closes = candles.map((c) => c.close);
      const rsi = computeRSI(candles, 14);
      const ema = computeEMA(closes, 20);
      const atr = computeATR(candles, 14);

      const lastIdx = candles.length - 1;
      return JSON.stringify({
        instrumentKey,
        lastPrice: closes[lastIdx],
        rsi: rsi[lastIdx],
        ema: ema[lastIdx],
        atr: atr[lastIdx],
        candlesAnalyzed: candles.length,
      }, null, 2);
    } catch (err: any) {
      return `Error calculating indicators: ${err.message}`;
    }
  },
  {
    name: "calculate_technical_indicators",
    description: "Calculates RSI, EMA_20, and ATR metrics for a given instrument and range",
    schema: z.object({
      instrumentKey: z.string().describe("Upstox instrument key"),
      toDate: z.string().describe("End date YYYY-MM-DD"),
      fromDate: z.string().describe("Start date YYYY-MM-DD"),
    }),
  }
);

// 4. Code Execution Sandbox Tool for Coding Agent
export const runSandboxCodeTool = tool(
  async ({ code }) => {
    try {
      const logs: string[] = [];
      const customConsole = {
        log: (...args: any[]) => logs.push(args.join(" ")),
        error: (...args: any[]) => logs.push("[ERROR] " + args.join(" ")),
        warn: (...args: any[]) => logs.push("[WARN] " + args.join(" ")),
      };

      const context = {
        console: customConsole,
        process: { env: { ENV: "development" } },
        indicators: { computeRSI, computeEMA, computeATR, computeVWAP },
      };

      vm.createContext(context);
      vm.runInContext(code, context, { timeout: 2000 });

      return JSON.stringify({
        success: true,
        logs,
      }, null, 2);
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: err.message,
      }, null, 2);
    }
  },
  {
    name: "run_sandbox_code",
    description: "Executes JavaScript code inside a sandboxed VM and returns console logs. Maximum execution timeout is 2 seconds.",
    schema: z.object({
      code: z.string().describe("The JavaScript code to execute"),
    }),
  }
);

export const getNewsTool = tool(
  async ({ instrumentKeys }) => {
    try {
      const news = await fetchNews(instrumentKeys);
      return JSON.stringify(news, null, 2);
    } catch (err: any) {
      return `Error fetching news: ${err.message}`;
    }
  },
  {
    name: "get_market_news",
    description: "Fetch recent news articles and updates for a list of Upstox instrument keys (e.g. ['NSE_EQ|INE062A01020', 'NSE_EQ|INE002A01018'])",
    schema: z.object({
      instrumentKeys: z.array(z.string()).describe("List of Upstox instrument tokens"),
    }),
  }
);

// 5. Pattern Detection Tool for Technical Analyst
export const detectPatternsTool = tool(
  async ({ instrumentKey, toDate, fromDate }) => {
    try {
      const candles = await fetchHistoricalCandles(instrumentKey, "day", toDate, fromDate);
      if (candles.length === 0) return "No candle data found.";

      const patterns = detectCandlestickPatterns(candles);
      const breakouts = detectBreakouts(candles);

      return JSON.stringify({
        instrumentKey,
        patternsDetected: patterns,
        breakoutStatus: breakouts,
      }, null, 2);
    } catch (err: any) {
      return `Error detecting patterns: ${err.message}`;
    }
  },
  {
    name: "detect_chart_patterns",
    description: "Detect chart breakouts, support/resistance levels, and candlestick patterns (engulfing, doji) for a stock over a range of candles",
    schema: z.object({
      instrumentKey: z.string().describe("Upstox instrument key"),
      toDate: z.string().describe("End date YYYY-MM-DD"),
      fromDate: z.string().describe("Start date YYYY-MM-DD"),
    }),
  }
);

// 6. Fundamental Metrics Tool for Fundamental Analyst
const MOCK_FUNDAMENTALS: Record<string, any> = {
  "NSE_EQ|INE062A01020": {
    pe_ratio: 9.4,
    pb_ratio: 1.6,
    roe: 17.5,
    debt_to_equity: 1.2,
    eps: 88.2,
    market_cap_cr: 742000,
    dividend_yield: 1.5,
  },
  "NSE_EQ|INE002A01018": {
    pe_ratio: 26.5,
    pb_ratio: 2.1,
    roe: 9.8,
    debt_to_equity: 0.4,
    eps: 92.5,
    market_cap_cr: 1650000,
    dividend_yield: 0.4,
  },
  "NSE_EQ|INE397D01024": {
    pe_ratio: 54.2,
    pb_ratio: 8.5,
    roe: 14.2,
    debt_to_equity: 1.8,
    eps: 26.1,
    market_cap_cr: 830000,
    dividend_yield: 0.3,
  },
  "NSE_EQ|INE040A01034": {
    pe_ratio: 16.8,
    pb_ratio: 2.3,
    roe: 16.1,
    debt_to_equity: 0.8,
    eps: 95.8,
    market_cap_cr: 1220000,
    dividend_yield: 1.1,
  },
  "NSE_EQ|INE009A01021": {
    pe_ratio: 24.1,
    pb_ratio: 7.2,
    roe: 31.4,
    debt_to_equity: 0.05,
    eps: 63.5,
    market_cap_cr: 635000,
    dividend_yield: 2.4,
  },
  "NSE_EQ|INE467B01029": {
    pe_ratio: 29.8,
    pb_ratio: 12.4,
    roe: 38.6,
    debt_to_equity: 0.02,
    eps: 128.2,
    market_cap_cr: 1390000,
    dividend_yield: 2.1,
  },
  "NSE_EQ|INE075A01022": {
    pe_ratio: 22.4,
    pb_ratio: 3.1,
    roe: 14.8,
    debt_to_equity: 0.15,
    eps: 21.2,
    market_cap_cr: 248000,
    dividend_yield: 0.2,
  },
  "NSE_EQ|INE154A01025": {
    pe_ratio: 27.2,
    pb_ratio: 8.1,
    roe: 29.2,
    debt_to_equity: 0.0,
    eps: 16.0,
    market_cap_cr: 540000,
    dividend_yield: 2.8,
  }
};

export const getFundamentalsTool = tool(
  async ({ instrumentKey }) => {
    const data = MOCK_FUNDAMENTALS[instrumentKey];
    if (!data) {
      return JSON.stringify({ error: "Fundamentals not available for instrument: " + instrumentKey });
    }
    return JSON.stringify(data, null, 2);
  },
  {
    name: "get_company_fundamentals",
    description: "Fetch company fundamental financials like P/E ratio, P/B ratio, ROE, debt-to-equity, and EPS for a given instrument key",
    schema: z.object({
      instrumentKey: z.string().describe("Upstox instrument key"),
    }),
  }
);

// 7. RL Q-Value Evaluation Tool for RL Evaluator Agent
export const getRLPolicyQValuesTool = tool(
  async ({ rsi, emaRatio, vwapRatio, atrNormalized, positionStatus, positionAge, consensusScore }) => {
    try {
      const state = {
        rsi,
        emaRatio,
        vwapRatio,
        atrNormalized,
        positionStatus,
        positionAge,
        consensusScore,
      };
      const stateArr = stateToArray(state);
      const qValues = policy.getQValues(stateArr);
      const actionNames = ["HOLD", "BUY", "SELL/EXIT"];
      const bestActionIdx = qValues.indexOf(Math.max(...qValues));
      
      return JSON.stringify({
        qValues: {
          HOLD: qValues[0],
          BUY: qValues[1],
          SELL: qValues[2],
        },
        recommendedAction: actionNames[bestActionIdx],
        stateArray: stateArr,
      }, null, 2);
    } catch (err: any) {
      return `Error evaluating RL policy: ${err.message}`;
    }
  },
  {
    name: "get_rl_policy_q_values",
    description: "Evaluates the reinforcement learning Q-network for a specific environmental state, returning expected action rewards and recommendations",
    schema: z.object({
      rsi: z.number().describe("The RSI index (0-100)"),
      emaRatio: z.number().describe("The ratio of close price to EMA_20 (Close / EMA_20)"),
      vwapRatio: z.number().describe("The ratio of close price to VWAP (Close / VWAP)"),
      atrNormalized: z.number().describe("The Average True Range normalized by the close price (ATR / Close)"),
      positionStatus: z.number().describe("0 if flat, 1 if long position is currently held"),
      positionAge: z.number().describe("Number of candles position has been held"),
      consensusScore: z.number().describe("Aggregate analyst consensus sentiment (-1 to +1)"),
    }),
  }
);

