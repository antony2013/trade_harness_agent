import * as fs from "fs";
import * as path from "path";
import type { RLState } from "./environment";
import { stateToArray } from "./environment";

export class RLPolicy {
  private numFeatures = 7; // Matching stateToArray output length
  private numActions = 3;  // HOLD, BUY, SELL
  
  // Q-network weights: actions x features
  private weights: number[][];
  private biases: number[];

  constructor() {
    this.weights = Array.from({ length: this.numActions }, () =>
      Array.from({ length: this.numFeatures }, () => (Math.random() - 0.5) * 0.1)
    );
    this.biases = Array(this.numActions).fill(0);
  }

  /**
   * Predicts Q-values for a given state array
   */
  public getQValues(stateArray: number[]): number[] {
    const qValues: number[] = [];
    for (let action = 0; action < this.numActions; action++) {
      let q = this.biases[action];
      for (let feature = 0; feature < this.numFeatures; feature++) {
        q += stateArray[feature] * this.weights[action][feature];
      }
      qValues.push(q);
    }
    return qValues;
  }

  /**
   * Selects an action using Epsilon-Greedy strategy
   */
  public chooseAction(state: RLState, epsilon = 0.1): { action: number; qValues: number[] } {
    const stateArray = stateToArray(state);
    const qValues = this.getQValues(stateArray);

    // Exploration: pick random action
    if (Math.random() < epsilon) {
      const randomAction = Math.floor(Math.random() * this.numActions);
      return { action: randomAction, qValues };
    }

    // Exploitation: pick action with highest Q-value
    let maxQ = -Infinity;
    let bestAction = 0;
    for (let action = 0; action < this.numActions; action++) {
      if (qValues[action] > maxQ) {
        maxQ = qValues[action];
        bestAction = action;
      }
    }

    return { action: bestAction, qValues };
  }

  /**
   * Updates weights using Q-learning SGD step
   */
  public update(
    stateArray: number[],
    action: number,
    reward: number,
    nextStateArray: number[] | null,
    discountFactor = 0.95,
    learningRate = 0.01
  ): number {
    const qValues = this.getQValues(stateArray);
    const currentQ = qValues[action];

    // Compute target Q-value
    let targetQ = reward;
    if (nextStateArray) {
      const nextQValues = this.getQValues(nextStateArray);
      const maxNextQ = Math.max(...nextQValues);
      targetQ += discountFactor * maxNextQ;
    }

    const tdError = targetQ - currentQ;

    // Gradient descent step
    for (let feature = 0; feature < this.numFeatures; feature++) {
      this.weights[action][feature] += learningRate * tdError * stateArray[feature];
    }
    this.biases[action] += learningRate * tdError;

    return tdError; // Return TD error for logging
  }

  /**
   * Saves model weights to a JSON file
   */
  public saveWeights(filePath: string): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        weights: this.weights,
        biases: this.biases,
        updatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      console.log(`[RLPolicy] Model weights saved to ${filePath}`);
    } catch (err) {
      console.error("[RLPolicy] Save weights failed:", err);
    }
  }

  /**
   * Loads model weights from a JSON file
   */
  public loadWeights(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw);
        if (data.weights && data.biases) {
          this.weights = data.weights;
          this.biases = data.biases;
          console.log(`[RLPolicy] Model weights loaded from ${filePath}`);
          return true;
        }
      }
    } catch (err) {
      console.error("[RLPolicy] Load weights failed:", err);
    }
    return false;
  }
}
