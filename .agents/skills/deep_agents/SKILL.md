---
name: deep-agents
description: >-
  Build and customize agents using the LangChain Deep Agents SDK. Includes
  knowledge on planning, pluggable backends, permissions, subagents,
  interpreters, memory, and custom middleware.
---

# LangChain Deep Agents SDK

## Overview
This skill provides comprehensive instructions on designing, implementing, and deploying deep agents using the **LangChain Deep Agents SDK** (`deepagents`). It covers the entire lifecycle from basic instantiation to advanced patterns like pluggable file systems, access permissions, subagent coordination, sandboxes, and custom middleware.

---

## Dependencies
- `@langchain/core`
- `langchain`
- `deepagents`
- `zod`

---

## Quick Start

Initialize a basic Deep Agent with tool calling:

```typescript
import * as z from "zod";
import { createDeepAgent } from "deepagents";
import { tool } from "@langchain/core/tools";

// Define a tool
const fetchStockPrice = tool(
  async ({ ticker }) => {
    // API logic goes here
    return `The price of ${ticker} is $150.00`;
  },
  {
    name: "fetch_stock_price",
    description: "Get the current stock price for a given ticker symbol",
    schema: z.object({
      ticker: z.string().describe("Stock ticker symbol (e.g. AAPL, MSFT)"),
    }),
  }
);

// Create the Deep Agent
const agent = await createDeepAgent({
  model: "anthropic:claude-3-5-sonnet",
  systemPrompt: "You are a specialized financial analysis assistant.",
  tools: [fetchStockPrice],
});

// Run the agent
const result = await agent.invoke({
  messages: [{ role: "user", content: "Should I buy AAPL? What is its current price?" }],
});
console.log(result.messages[result.messages.length - 1].content);
```

---

## Core Capabilities & Parameters

### 1. Pluggable Backends & Sandboxes
Deep Agents use virtual filesystem backends to manage context and allow agents to execute code or read/write files safely.

- **StateBackend** (Default): In-memory filesystem.
- **LocalShellBackend**: Allows agents to run shell commands on the host machine.
- **SandboxBackend**: Runs shell commands and code in isolated environments (e.g., Docker, E2B).

```typescript
import { LocalShellBackend } from "deepagents/backends";

const agent = await createDeepAgent({
  model: "openai:gpt-4o",
  backend: new LocalShellBackend({
    workingDirectory: "./sandbox",
  }),
});
```

### 2. Fine-grained Access Permissions
You can enforce strict path-level permissions to control what the agent can read or write.

```typescript
const agent = await createDeepAgent({
  model: "openai:gpt-4o",
  permissions: {
    allowRead: ["./src", "./package.json"],
    allowWrite: ["./dist", "./tmp"],
    denyRead: ["./.env", "./private/*"],
  },
});
```

### 3. Hierarchical Subagents
Deep Agents can delegate work to specialized subagents, keeping context windows clean.

```typescript
const codeWriter = await createDeepAgent({
  model: "anthropic:claude-3-5-sonnet",
  systemPrompt: "You write clean TypeScript code based on specifications.",
});

const projectManager = await createDeepAgent({
  model: "openai:gpt-4o",
  systemPrompt: "You coordinate the software build process.",
  subagents: {
    coder: codeWriter,
  },
});
```

### 4. Code Interpreters
Add an in-memory execution environment (JavaScript/Python) to allow the agent to perform data manipulation or run untrusted code safely.

```typescript
import { NodeVMInterpreter } from "deepagents/interpreters";

const agent = await createDeepAgent({
  model: "openai:gpt-4o",
  middleware: [
    new NodeVMInterpreter({
      allowConsole: true,
      sandboxVariables: { ENV: "production" },
    }),
  ],
});
```

### 5. Memory & On-Demand Skills
Bootstrap your agent with long-term memory or direct them to folders of Markdown guides for specific APIs.

```typescript
const agent = await createDeepAgent({
  model: "anthropic:claude-3-5-sonnet",
  memory: ["./memories/user_profile.md"],
  skills: ["./skills/trading_strategies/"],
});
```

### 6. Human-in-the-Loop (HITL)
Configure the agent to interrupt execution and wait for human confirmation before running destructive actions.

```typescript
const agent = await createDeepAgent({
  model: "openai:gpt-4o",
  interruptOn: ["execute_shell_command", "write_file"],
});
```

---

## Common Mistakes

1. **Incorrect Model String Format**: Always specify the model parameter as `provider:model` (e.g., `openai:gpt-4o` or `anthropic:claude-3-5-sonnet`). Passing raw strings like `gpt-4o` without a provider prefix will fail.
2. **Missing Async/Await**: `createDeepAgent` is an asynchronous factory function. Make sure to `await` it.
3. **No Workspace Constraints**: When using `LocalShellBackend`, failing to restrict working directories can lead to agents editing code outside the intended workspace.
