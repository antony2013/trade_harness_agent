export const env = {
  // Upstox API Configuration
  UPSTOX_API_KEY: process.env.UPSTOX_API_KEY || "",
  UPSTOX_API_SECRET: process.env.UPSTOX_API_SECRET || "",
  UPSTOX_REDIRECT_URI: process.env.UPSTOX_REDIRECT_URI || "http://localhost:3000/api/auth/callback",
  UPSTOX_ACCESS_TOKEN: process.env.UPSTOX_ACCESS_TOKEN || "", // Loaded dynamically at runtime

  // Ollama Model Configuration
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  OLLAMA_MODEL_REASONING: process.env.OLLAMA_MODEL_REASONING || "deepseek-r1:32b",
  OLLAMA_MODEL_CODING: process.env.OLLAMA_MODEL_CODING || "qwen3-coder:30b",
  OLLAMA_MODEL_ANALYSIS: process.env.OLLAMA_MODEL_ANALYSIS || "qwen3.5:27b",
  OLLAMA_MODEL_LIGHTWEIGHT: process.env.OLLAMA_MODEL_LIGHTWEIGHT || "qwen3.5:9b",

  // Application Settings
  PORT: parseInt(process.env.PORT || "3000", 10),
  TRADING_MODE: (process.env.TRADING_MODE || "sandbox") as "sandbox" | "live",
  
  // Storage Paths
  DATA_DIR: process.env.DATA_DIR || "./data",
  SANDBOX_DIR: process.env.SANDBOX_DIR || "./sandbox",
};

// Validate critical configurations
export function validateConfig() {
  const missing: string[] = [];
  if (!env.UPSTOX_API_KEY) missing.push("UPSTOX_API_KEY");
  if (!env.UPSTOX_API_SECRET) missing.push("UPSTOX_API_SECRET");
  
  if (missing.length > 0) {
    console.warn(`[WARNING] Missing environment variables: ${missing.join(", ")}`);
    console.warn("[WARNING] Upstox integrations will not work until auth is configured.");
  }
}
