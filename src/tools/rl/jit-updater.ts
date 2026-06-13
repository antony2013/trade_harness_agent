import { RLPolicy } from "./policy";
import { ReplayBuffer } from "./replay-buffer";
import type { RLState, RLAction } from "./environment";
import { stateToArray } from "./environment";
import { env } from "../../config/env";
import * as path from "path";

// Model and buffer storage paths
const WEIGHTS_PATH = path.join(env.DATA_DIR, "rl-models", "weights.json");
const BUFFER_PATH = path.join(env.DATA_DIR, "rl-models", "replay_buffer.json");

export const policy = new RLPolicy();
export const replayBuffer = new ReplayBuffer(1000);

let experienceCount = 0;

/**
 * Initializes the RL models, loading any weights/buffers saved on disk
 */
export function initRL(): void {
  console.log("[RL-JIT] Initializing RL model...");
  const weightsLoaded = policy.loadWeights(WEIGHTS_PATH);
  const bufferLoaded = replayBuffer.load(BUFFER_PATH);

  if (!weightsLoaded) {
    console.log("[RL-JIT] No saved model weights found. Starting with initialized default weights.");
  }
  if (!bufferLoaded) {
    console.log("[RL-JIT] No saved experience buffer found. Starting fresh.");
  }
}

/**
 * Registers a new trade experience transition and executes JIT updates
 */
export function registerExperience(
  state: RLState,
  action: RLAction,
  reward: number,
  nextState: RLState | null,
  terminal: boolean
): { tdError: number; batchUpdates: number } {
  const stateArr = stateToArray(state);
  const nextStateArr = nextState ? stateToArray(nextState) : null;

  // 1. Save to replay buffer
  replayBuffer.push(stateArr, action, reward, nextStateArr, terminal);

  // 2. Immediate JIT update
  const tdError = policy.update(stateArr, action, reward, nextStateArr, 0.95, 0.02);
  
  experienceCount++;
  let batchUpdates = 0;

  // 3. Mini-batch experience replay update every 5 experiences
  if (experienceCount % 5 === 0 && replayBuffer.size() >= 10) {
    const batch = replayBuffer.sample(16);
    for (const transition of batch) {
      policy.update(
        transition.state,
        transition.action,
        transition.reward,
        transition.nextState,
        0.95,
        0.01 // Slightly lower learning rate for batch adjustments
      );
      batchUpdates++;
    }
  }

  // 4. Autosave weights and buffer every 10 experiences
  if (experienceCount % 10 === 0) {
    policy.saveWeights(WEIGHTS_PATH);
    replayBuffer.save(BUFFER_PATH);
  }

  return { tdError, batchUpdates };
}

/**
 * Force manual save of current RL states
 */
export function saveRLState(): void {
  policy.saveWeights(WEIGHTS_PATH);
  replayBuffer.save(BUFFER_PATH);
}
