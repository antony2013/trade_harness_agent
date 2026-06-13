export type AgentRole =
  | "fund_manager"
  | "data_collector"
  | "technical_analyst"
  | "fundamental_analyst"
  | "sentiment_analyst"
  | "strategy_builder"
  | "rl_evaluator"
  | "risk_manager"
  | "execution_engine"
  | "coding_agent"
  | "bull_agent"
  | "bear_agent";

export interface AgentChatMessage {
  id: string;
  sender: AgentRole | "user" | "system";
  recipient: AgentRole | "user" | "system";
  content: string;
  timestamp: string;
  reasoning?: string; // Chain of thought (e.g. from DeepSeek R1)
}

export interface AgentStatus {
  role: AgentRole;
  name: string;
  status: "IDLE" | "ANALYZING" | "PLANNING" | "CODING" | "TRADING" | "DEBATING" | "ERROR";
  model: string;
  temperature: number;
  current_task?: string;
  last_activity: string;
  logs: string[];
}

export interface AgentDebateMessage {
  speaker: "bull_agent" | "bear_agent";
  argument: string;
  timestamp: string;
}

export interface AgentDebateSession {
  trade_signal_id: string;
  instrument_key: string;
  bull_points: string[];
  bear_points: string[];
  verdict: "APPROVE" | "REJECT";
  verdict_reasoning: string;
  timestamp: string;
}
