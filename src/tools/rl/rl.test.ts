import { test, expect, describe } from "bun:test";
import { getEnvironmentState, stateToArray, calculateReward } from "./environment";
import { RLPolicy } from "./policy";
import { ReplayBuffer } from "./replay-buffer";
import { registerExperience, policy, replayBuffer } from "./jit-updater";
import type { Candle } from "../../types/market";

describe("Reinforcement Learning Engine Test Suite", () => {
  const mockCandles: Candle[] = Array.from({ length: 30 }, (_, idx) => ({
    time: `2026-06-${idx + 1}T10:00:00Z`,
    open: 100 + idx,
    high: 102 + idx,
    low: 99 + idx,
    close: 101 + idx,
    volume: 1000,
  }));

  test("Environment state extraction and normalization", () => {
    const analystScores = { technical: 0.5, fundamental: -0.2, sentiment: 0.8 };
    const state = getEnvironmentState(mockCandles, null, analystScores);

    expect(state.rsi).toBeGreaterThanOrEqual(0);
    expect(state.rsi).toBeLessThanOrEqual(100);
    expect(state.positionStatus).toBe(0);
    
    // Consensus weighted score check: 0.5 * 0.5 + -0.2 * 0.2 + 0.8 * 0.3 = 0.25 - 0.04 + 0.24 = 0.45
    expect(state.consensusScore).toBeCloseTo(0.45, 2);

    const arr = stateToArray(state);
    expect(arr).toHaveLength(7);
    expect(arr[0]).toBe(state.rsi / 100);
    expect(arr[6]).toBe(state.consensusScore);
  });

  test("Reward math verification", () => {
    // BUY action penalty check
    const r1 = calculateReward(1, 0, 0, 0, false);
    expect(r1).toBe(-0.1);

    // Large profit reward
    const r2 = calculateReward(0, 500, 3.5, 0.5, true);
    expect(r2).toBe(35); // 3.5 * 10

    // Drawdown penalty
    const r3 = calculateReward(0, -300, -2.0, 3.0, true);
    expect(r3).toBe(-2.0 * 10 - 3.0 * 5); // -20 - 15 = -35
  });

  test("Policy Q-value generation and training updates", () => {
    const localPolicy = new RLPolicy();
    const stateArr = [0.5, 1.0, 1.0, 0.02, 0, 0, 0.5];

    const q1 = localPolicy.getQValues(stateArr);
    expect(q1).toHaveLength(3);

    // Train the policy: repeatedly give a positive reward of +10 for Action 1 (BUY)
    const initialQ = q1[1];
    for (let i = 0; i < 50; i++) {
      localPolicy.update(stateArr, 1, 10, null, 0.95, 0.05);
    }
    const finalQValues = localPolicy.getQValues(stateArr);
    const finalQ = finalQValues[1];

    // Q-value for action 1 must have increased significantly
    expect(finalQ).toBeGreaterThan(initialQ);
  });

  test("Replay buffer capacity and sampling behavior", () => {
    const buffer = new ReplayBuffer(5);
    expect(buffer.size()).toBe(0);

    for (let i = 0; i < 7; i++) {
      buffer.push([i, 0, 0, 0, 0, 0, 0], 1, i, null, false);
    }

    // Capacity is capped at 5
    expect(buffer.size()).toBe(5);

    const sample = buffer.sample(3);
    expect(sample).toHaveLength(3);

    // Oldest values (0, 1) should have been shifted out
    const rewards = sample.map((t) => t.reward);
    expect(rewards.includes(0)).toBe(false);
    expect(rewards.includes(1)).toBe(false);
  });

  test("JIT Updater pipeline validation", () => {
    replayBuffer.clear();
    const analystScores = { technical: 0.1, fundamental: 0.1, sentiment: 0.1 };
    const state = getEnvironmentState(mockCandles, null, analystScores);

    // Register 1 experience
    const res1 = registerExperience(state, 1, 1.5, null, false);
    expect(Number.isNaN(res1.tdError)).toBe(false);
    expect(res1.batchUpdates).toBe(0);
    expect(replayBuffer.size()).toBe(1);

    // Register more to trigger batch updates (every 5 experiences)
    for (let i = 0; i < 9; i++) {
      registerExperience(state, 1, 1.0, state, false);
    }
    
    expect(replayBuffer.size()).toBe(10);
  });
});
