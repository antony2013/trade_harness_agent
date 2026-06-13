import { env, validateConfig } from "./config/env";
import { WATCHLIST } from "./config/instruments";
import { initRL } from "./tools/rl/jit-updater";
import { marketFeed } from "./tools/upstox/websocket";
import { fetchMarketQuotes } from "./tools/upstox/market-data";
import { createFundManager } from "./agents/agent-system";
import { isMarketOpen } from "./utils/market-hours";
import { fetchPositions, checkAndRegisterClosedTrades } from "./tools/upstox/portfolio";
import type { Position } from "./types/trade";

// Import server to start ElysiaJS on startup
import "./server/index";

async function runIntegratedPipeline() {
  if (!isMarketOpen()) {
    console.log("[Pipeline] Market closed. Skipping pipeline run.");
    return;
  }

  console.log("\n[Pipeline] Starting periodic multi-agent trading evaluation...");
  
  let prevPositions: Position[] = [];
  try {
    prevPositions = await fetchPositions();
  } catch (err: any) {
    console.error("[Pipeline] Failed to fetch previous positions for RL feedback:", err.message);
  }
  
  try {
    const keys = WATCHLIST.slice(0, 2).map((w) => w.instrument_key); // Limit to first two for testing speed
    console.log(`[Pipeline] Fetching market context for: ${keys.join(", ")}`);
    const quotes = await fetchMarketQuotes(keys);

    const fm = await createFundManager();

    for (const key of keys) {
      const quote = quotes[key];
      if (!quote) continue;

      console.log(`\n[Pipeline] [${quote.instrument_key}] Last price: ₹${quote.last_price}`);
      
      // Invoke Fund Manager to evaluate this instrument
      console.log(`[Pipeline] Dispatching Fund Manager to coordinate analysis for ${key}...`);
      const response = await fm.invoke({
        messages: [
          {
            role: "user",
            content: `Evaluate stock ${key} (Last price: ₹${quote.last_price}, Vol: ${quote.volume}) for a potential trade. Run your 8-step approval pipeline and output your decision.`,
          },
        ],
      });

      const lastMsg = response.messages[response.messages.length - 1];
      console.log(`[Pipeline] Fund Manager Decision:\n${lastMsg.content}`);
    }
  } catch (err: any) {
    console.error("[Pipeline] Integrated pipeline encountered error:", err.message);
  }

  try {
    const currentPositions = await fetchPositions();
    checkAndRegisterClosedTrades(prevPositions, currentPositions);
  } catch (err: any) {
    console.error("[Pipeline] RL feedback loop checkAndRegisterClosedTrades failed:", err.message);
  }
}

async function main() {
  console.log("=================================================");
  console.log("🏢 HARNESS TRADING SYSTEM - STARTUP SEQUENCE");
  console.log("=================================================");

  // 1. Validate environment
  validateConfig();

  // 2. Initialize reinforcement learning models
  initRL();

  // 3. Connect to live market data feed
  console.log("[Startup] Connecting market data stream feed...");
  await marketFeed.connect();
  const keys = WATCHLIST.map((w) => w.instrument_key);
  marketFeed.subscribe(keys);

  // 4. Attach tick listeners for real-time monitoring
  marketFeed.on("tick", (tick) => {
    // Ticks can feed directly into active strategy monitors
    // console.log(`[Tick] ${tick.instrument_key}: ₹${tick.price}`);
  });

  marketFeed.on("error", (err) => {
    console.error("[MarketFeed] Live stream error:", err);
  });

  // 5. Trigger a dry-run of the multi-agent pipeline after 5 seconds to verify e2e connectivity
  console.log("[Startup] Scheduling initial multi-agent dry-run in 5 seconds...");
  setTimeout(runIntegratedPipeline, 5000);

  // 6. Schedule recurring pipeline evaluations every 5 minutes
  setInterval(runIntegratedPipeline, 5 * 60 * 1000);
}

main().catch((err) => {
  console.error("[FATAL] Startup sequence crashed:", err);
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception in trading daemon:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Rejection in trading daemon at:", promise, "reason:", reason);
});
