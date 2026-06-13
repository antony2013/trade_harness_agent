import * as fs from "fs";
import * as path from "path";

export interface Transition {
  state: number[];
  action: number;
  reward: number;
  nextState: number[] | null;
  terminal: boolean;
  timestamp: string;
}

export class ReplayBuffer {
  private buffer: Transition[] = [];
  private maxSize: number;

  constructor(maxSize = 5000) {
    this.maxSize = maxSize;
  }

  /**
   * Adds a transition to the replay buffer
   */
  public push(
    state: number[],
    action: number,
    reward: number,
    nextState: number[] | null,
    terminal: boolean
  ): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift(); // Remove oldest (FIFO)
    }
    this.buffer.push({
      state,
      action,
      reward,
      nextState,
      terminal,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Samples a batch of transitions from the buffer
   */
  public sample(batchSize: number): Transition[] {
    const sampled: Transition[] = [];
    const len = this.buffer.length;
    if (len === 0) return [];

    const size = Math.min(batchSize, len);
    const indices = new Set<number>();

    while (indices.size < size) {
      indices.add(Math.floor(Math.random() * len));
    }

    for (const idx of indices) {
      sampled.push(this.buffer[idx]);
    }

    return sampled;
  }

  /**
   * Returns current buffer size
   */
  public size(): number {
    return this.buffer.length;
  }

  /**
   * Clears the buffer
   */
  public clear(): void {
    this.buffer = [];
  }

  /**
   * Saves the buffer data to a JSON file
   */
  public save(filePath: string): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(this.buffer, null, 2), "utf-8");
      console.log(`[ReplayBuffer] Replay buffer data saved to ${filePath}`);
    } catch (err) {
      console.error("[ReplayBuffer] Save buffer failed:", err);
    }
  }

  /**
   * Loads buffer data from a JSON file
   */
  public load(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        this.buffer = JSON.parse(raw);
        console.log(`[ReplayBuffer] Replay buffer loaded ${this.buffer.length} items from ${filePath}`);
        return true;
      }
    } catch (err) {
      console.error("[ReplayBuffer] Load buffer failed:", err);
    }
    return false;
  }
}
