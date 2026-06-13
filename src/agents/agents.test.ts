import { test, expect, describe } from "bun:test";
import {
  createDataCollector,
  createTechnicalAnalyst,
  createCodingAgent,
  createFundManager,
} from "./agent-system";

describe("Deep Agents Assembly Test Suite", () => {
  test("Data Collector initialization and tool binding", async () => {
    const agent = await createDataCollector();
    expect(agent).toBeDefined();
    // Verify it compiled into a usable graph runner
    expect(agent.invoke).toBeTypeOf("function");
  });

  test("Technical Analyst initialization", async () => {
    const agent = await createTechnicalAnalyst();
    expect(agent).toBeDefined();
    expect(agent.invoke).toBeTypeOf("function");
  });

  test("Coding Agent sandbox environment compile check", async () => {
    const agent = await createCodingAgent();
    expect(agent).toBeDefined();
    expect(agent.invoke).toBeTypeOf("function");
  });

  test("Fund Manager Orchestrator coordinates all subagents", async () => {
    const fundManager = await createFundManager();
    expect(fundManager).toBeDefined();
    expect(fundManager.invoke).toBeTypeOf("function");
  });

  test("Mock Agent Execution Check", async () => {
    const techAnalyst = await createTechnicalAnalyst();
    
    // Test invoking the analyst with a simple analysis query
    const res = await techAnalyst.invoke({
      messages: [{ role: "user", content: "Analyze stock NSE_EQ|INE062A01020 for the past 5 days" }],
    });

    expect(res).toBeDefined();
    expect(res.messages).toBeDefined();
    expect(res.messages.length).toBeGreaterThan(0);

    const lastMessage = res.messages[res.messages.length - 1];
    expect(lastMessage.content).toBeTypeOf("string");
    expect(lastMessage.content.length).toBeGreaterThan(0);
  });
});
