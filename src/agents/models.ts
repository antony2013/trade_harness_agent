import { ChatOllama } from "@langchain/ollama";
import { SimpleChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage } from "@langchain/core/messages";
import { env } from "../config/env";

// A resilient Mock Chat Model for test suites or when local Ollama is offline
class MockChatModel extends SimpleChatModel {
  private static responseIndex = 0;
  
  constructor() {
    super({});
  }

  _llmType() {
    return "mock";
  }

  bindTools(tools: any[]) {
    return this;
  }

  async _call(messages: BaseMessage[]): Promise<string> {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content.toString().toLowerCase();

    // Context-sensitive mock responses for trading debate/sandbox
    if (content.includes("bull")) {
      return "Bull Argument: The momentum is clearly upward. RSI is at 45 (neutral-bullish), and price is above VWAP. It is an optimal buying zone.";
    }
    if (content.includes("bear")) {
      return "Bear Argument: The volume is slightly below average, and there is minor resistance just 1% above the entry price. Risk is elevated.";
    }
    if (content.includes("debate") || content.includes("debate verdict")) {
      return "Verdict: The bull case outweighs the bear case. Recommend BUY with a tight stop loss at 1.5% below entry.";
    }
    if (content.includes("risk") || content.includes("exposure")) {
      return "Risk Assessment: Position size is adjusted to 1.2% of total capital. Exposure checks passed. No violations detected.";
    }
    if (content.includes("code") || content.includes("strategy script")) {
      return `// Generated strategy script
export function customStrategy(candles) {
  const close = candles[candles.length - 1].close;
  const open = candles[candles.length - 1].open;
  return close > open ? "BUY" : "HOLD";
}`;
    }

    return "Decision: Trade approved. The indicators are consistent with our momentum parameters.";
  }
}

let availableModels: string[] = [];
let isOllamaOnline = false;

// Quick check for Ollama availability and pulled models list
async function checkOllamaModels() {
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(1000), // 1s timeout
    });
    if (res.ok) {
      const data = await res.json();
      isOllamaOnline = true;
      if (data && Array.isArray(data.models)) {
        availableModels = data.models.map((m: any) => m.name);
        console.log(`[Ollama] Online. Found local models: ${availableModels.join(", ")}`);
      }
    }
  } catch (e) {
    isOllamaOnline = false;
    availableModels = [];
  }
}

// Check status immediately
checkOllamaModels();

/**
 * Factory to build or retrieve the Chat Model based on Ollama online status and model availability
 */
export function getChatModel(
  modelName: string,
  temperature = 0.3,
  numPredict = 2048
): any {
  if (process.env.NODE_ENV === "test" || process.env.BUN_TEST) {
    return new MockChatModel();
  }
  // Check if the specific model (or its base tag) is pulled
  const isModelAvailable = availableModels.some(
    (name) => name === modelName || name.split(":")[0] === modelName.split(":")[0]
  );

  if (isOllamaOnline) {
    let finalModel = modelName;
    if (!isModelAvailable) {
      if (availableModels.length > 0) {
        finalModel = availableModels[0];
        console.warn(
          `[ModelFactory] Model '${modelName}' is not pulled in Ollama. Falling back to available model: '${finalModel}'.`
        );
      } else {
        console.warn(
          `[ModelFactory] Model '${modelName}' is not pulled and no other models were found in Ollama. Falling back to Mock Model.`
        );
        return new MockChatModel();
      }
    }
    console.log(`[ModelFactory] Initializing ChatOllama with model: ${finalModel}`);
    return new ChatOllama({
      baseUrl: env.OLLAMA_BASE_URL,
      model: finalModel,
      temperature,
      numPredict,
    });
  } else {
    console.log(`[ModelFactory] Ollama server offline. Falling back to Mock Model.`);
    return new MockChatModel();
  }
}

// Define model instances for each tier
export const models = {
  get reasoning() {
    return getChatModel(env.OLLAMA_MODEL_REASONING, 0.3, 4096);
  },
  get coding() {
    return getChatModel(env.OLLAMA_MODEL_CODING, 0.2, 8192);
  },
  get analysis() {
    return getChatModel(env.OLLAMA_MODEL_ANALYSIS, 0.4, 2048);
  },
  get lightweight() {
    return getChatModel(env.OLLAMA_MODEL_LIGHTWEIGHT, 0.5, 1024);
  },
};
