import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "../config/env";
import { WATCHLIST } from "../config/instruments";
import { exchangeCodeForToken, getAuthUrl, hasValidToken, clearToken } from "../tools/upstox/auth";
import { fetchMarketQuotes, fetchNews } from "../tools/upstox/market-data";
import { fetchPositions, fetchAccountSummary, exitAllPositions } from "../tools/upstox/portfolio";
import { fetchOrderBook } from "../tools/upstox/orders";
import { createFundManager, agentRegistry } from "../agents/agent-system";
import { enforceRiskRules } from "../tools/risk/enforcer";
import type { AgentRole, AgentChatMessage } from "../types/agent";

// Keep active agents and chat histories in memory
let fundManagerInstance: any = null;
const chatHistories: Record<string, AgentChatMessage[]> = {};
const activeSessions: Record<string, any> = {};

// Initialize chat histories with introductory agent greetings
const AGENT_GREETINGS: Record<AgentRole, string> = {
  fund_manager: "Hello, I am the Fund Manager. I oversee our quantitative strategy, risk limits, and final order approvals. How can I assist you today?",
  data_collector: "Harness Data Collector online. I track live tick data, historical candles, sector groupings, and capital limits. Let me know if you need any data metrics.",
  technical_analyst: "Technical Analyst here. I monitor moving averages, RSIs, Bollinger Bands, ATRs, and pattern breakouts. Ready to run price charts.",
  fundamental_analyst: "Fundamental Analyst reporting. I evaluate financial ratios, sector valuations, margins, and balance sheet health.",
  sentiment_analyst: "Sentiment Analyst active. I monitor news news feeds, earnings headlines, and market sentiment vectors.",
  strategy_builder: "Strategy Builder ready. I compile indicators and sentiments to construct concrete trade signals with targets and stop-losses.",
  rl_evaluator: "RL Evaluator online. I check trade states against our JIT reinforcement learning Q-policy and compute rewards.",
  risk_manager: "Risk Manager active. I enforce capital protections: daily drawdown limits, position sizing, sector exposure, and emergency kill switches.",
  execution_engine: "Execution Engine ready. I handle order placement on the Upstox broker API and verify execution fills.",
  coding_agent: "Coding Agent ready in the VM sandbox. Instruct me to write or test code scripts for indicators or backtests.",
  bull_agent: "Bull Case Agent. Ready to argue why we should buy and take long positions on target stocks.",
  bear_agent: "Bear Case Agent. Ready to defend our capital and highlight risks or bearish indicators for any target stock.",
};

function getHistory(agentRole: AgentRole): AgentChatMessage[] {
  if (!chatHistories[agentRole]) {
    chatHistories[agentRole] = [
      {
        id: crypto.randomUUID(),
        sender: agentRole,
        recipient: "user",
        content: AGENT_GREETINGS[agentRole] || `Hello, I am the ${agentRole} agent.`,
        timestamp: new Date().toISOString(),
      },
    ];
  }
  return chatHistories[agentRole];
}

async function getFundManager() {
  if (!fundManagerInstance) {
    console.log("[Server] Assembling Fund Manager and subagent team...");
    fundManagerInstance = await createFundManager();
  }
  return fundManagerInstance;
}

// Instantiate server
const app = new Elysia()
  .use(cors())
  
  // Status check route
  .get("/", () => ({ status: "running", timestamp: new Date().toISOString() }))

  // --- AUTHENTICATION ROUTES ---
  .get("/api/auth/login", ({ set }) => {
    set.redirect = getAuthUrl();
  })

  .get("/api/auth/callback", async ({ query, set }) => {
    const code = query.code;
    if (!code) {
      return { error: "No authorization code provided" };
    }
    try {
      await exchangeCodeForToken(code);
      // Redirect back to Svelte dashboard page
      set.redirect = "http://localhost:5173"; 
    } catch (err: any) {
      return { error: "Authentication failed", details: err.message };
    }
  })

  .get("/api/auth/status", () => ({
    authenticated: hasValidToken(),
    mode: env.TRADING_MODE,
  }))

  .post("/api/auth/logout", () => {
    clearToken();
    return { success: true };
  })

  // --- MARKET DATA ROUTES ---
  .get("/api/market/watchlist", () => WATCHLIST)

  .get("/api/market/quotes", async () => {
    try {
      const keys = WATCHLIST.map((w) => w.instrument_key);
      const quotes = await fetchMarketQuotes(keys);
      return quotes;
    } catch (err: any) {
      return { error: "Failed to fetch quotes", details: err.message };
    }
  })

  // --- PORTFOLIO & TRADING ROUTES ---
  .get("/api/portfolio/summary", async () => {
    return await fetchAccountSummary();
  })

  .get("/api/portfolio/positions", async () => {
    try {
      return await fetchPositions();
    } catch (err: any) {
      return [];
    }
  })

  .get("/api/portfolio/orders", async () => {
    try {
      return await fetchOrderBook();
    } catch (err: any) {
      return [];
    }
  })

  .post("/api/portfolio/exit-all", async () => {
    try {
      if (WATCHLIST.length > 0) {
        await enforceRiskRules({
          instrumentKey: WATCHLIST[0].instrument_key,
          quantity: 0,
          transactionType: "SELL",
        });
      }
    } catch (err: any) {
      console.warn("[Server] Risk enforcement check skipped for exit-all:", err.message);
    }
    const success = await exitAllPositions();
    return { success };
  })

  // --- AGENT CHAT PORTAL ROUTES ---
  .get("/api/agents", () => {
    return Object.keys(AGENT_GREETINGS).map((role) => ({
      role: role as AgentRole,
      name: role.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      greeting: AGENT_GREETINGS[role as AgentRole],
    }));
  })

  .get("/api/chat/history/:agent", ({ params }) => {
    const role = params.agent as AgentRole;
    return getHistory(role);
  })

  .post("/api/chat/clear/:agent", ({ params }) => {
    const role = params.agent as AgentRole;
    chatHistories[role] = [];
    return getHistory(role);
  })

  .post(
    "/api/chat/:agent",
    async ({ params, body }) => {
      const role = params.agent as AgentRole;
      const userMessageText = body.message;
      const history = getHistory(role);

      // Append user message
      const userMsg: AgentChatMessage = {
        id: crypto.randomUUID(),
        sender: "user",
        recipient: role,
        content: userMessageText,
        timestamp: new Date().toISOString(),
      };
      history.push(userMsg);

      try {
        const fm = await getFundManager();
        let targetAgent = fm;

        // If chatting with a subagent, retrieve it from the agent registry
        if (role !== "fund_manager") {
          const subagentObj = agentRegistry[role];
          if (subagentObj) {
            targetAgent = subagentObj.runnable || subagentObj;
          } else {
            console.warn(`[Server] Subagent ${role} not found in registry. Invoking orchestrator directly.`);
          }
        }

        // --- PRE-FETCH CONTEXT INJECTION (resilience for small local LLMs like Granite 3B) ---
        let contextText = "";
        const symbolsInMessage = ["SBIN", "RELIANCE", "BHARTIALRT", "HDFCBANK", "INFY", "TCS", "WIPRO", "ITC"];
        let matchedSymbols = symbolsInMessage.filter(s => userMessageText.toUpperCase().includes(s));
        
        if (
          matchedSymbols.length === 0 &&
          (userMessageText.toLowerCase().includes("news") ||
           userMessageText.toLowerCase().includes("headline") ||
           userMessageText.toLowerCase().includes("செய்தி") ||
           userMessageText.toLowerCase().includes("quote") ||
           userMessageText.toLowerCase().includes("price") ||
           role === "sentiment_analyst" ||
           role === "technical_analyst")
        ) {
          matchedSymbols = ["SBIN", "RELIANCE", "HDFCBANK", "TCS"];
        }
        
        if (matchedSymbols.length > 0) {
          const symbolToKey: Record<string, string> = {
            SBIN: "NSE_EQ|INE062A01020",
            RELIANCE: "NSE_EQ|INE002A01018",
            BHARTIALRT: "NSE_EQ|INE397D01024",
            HDFCBANK: "NSE_EQ|INE040A01034",
            INFY: "NSE_EQ|INE009A01021",
            TCS: "NSE_EQ|INE467B01029",
            WIPRO: "NSE_EQ|INE075A01022",
            ITC: "NSE_EQ|INE154A01025",
          };
          
          const keys = matchedSymbols.map(s => symbolToKey[s]);
          
          try {
            const quotes = await fetchMarketQuotes(keys);
            contextText += `\n[Live Market Quotes Context]:\n`;
            for (const [key, q] of Object.entries(quotes)) {
              const sym = matchedSymbols.find(s => symbolToKey[s] === key);
              contextText += `- ${sym}: Current Price ₹${q.last_price}, Volume ${q.volume}, Change ₹${q.net_change}\n`;
            }
            
            if (
              userMessageText.toLowerCase().includes("news") || 
              userMessageText.toLowerCase().includes("headline") || 
              userMessageText.toLowerCase().includes("செய்தி") ||
              role === "sentiment_analyst"
            ) {
              const newsItems = await fetchNews(keys);
              contextText += `\n[Recent News Articles Context]:\n`;
              newsItems.slice(0, 3).forEach((item) => {
                contextText += `- Headline: "${item.headline}"\n  Summary: ${item.summary}\n  Time: ${item.published_at}\n`;
              });
            }
          } catch (e: any) {
            console.error("[Context Injection] Error pre-fetching context:", e.message);
          }
        }

        // Invoke agent with the conversation history formatted as LangChain messages
        const formattedMessages = history.map((m, idx) => {
          if (idx === history.length - 1 && contextText) {
            return {
              role: "user",
              content: `${m.content}\n\n[CONTEXT FOR YOUR RESPONSE (use this data directly to answer the user's query)]:${contextText}`,
            };
          }
          return {
            role: m.sender === "user" ? "user" : "assistant",
            content: m.content,
          };
        });

        const result = await targetAgent.invoke({
          messages: formattedMessages,
        });

        const lastMsg = result.messages[result.messages.length - 1];
        const responseContent = lastMsg.content.toString();

        // Extract reasoning (chain of thought) if present
        const responseReasoning = lastMsg.additional_kwargs?.reasoning || "";

        const agentMsg: AgentChatMessage = {
          id: crypto.randomUUID(),
          sender: role,
          recipient: "user",
          content: responseContent,
          timestamp: new Date().toISOString(),
          reasoning: responseReasoning,
        };

        history.push(agentMsg);
        return { response: agentMsg };
      } catch (err: any) {
        console.error(`[Server] Chat invoke failed for agent ${role}:`, err);
        const errorMsg: AgentChatMessage = {
          id: crypto.randomUUID(),
          sender: role,
          recipient: "user",
          content: `Sorry, I encountered an internal error: ${err.message}`,
          timestamp: new Date().toISOString(),
        };
        history.push(errorMsg);
        return { response: errorMsg };
      }
    },
    {
      body: t.Object({
        message: t.String(),
      }),
    }
  );

// Start the Elysia server
app.listen(env.PORT, () => {
  console.log(`[Server] Harness Trading System Server is running at http://localhost:${env.PORT}`);
});

export { app };
