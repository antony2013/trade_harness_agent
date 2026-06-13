import { EventEmitter } from "events";
import { fetchMarketQuotes } from "./market-data";
import type { Tick } from "../../types/market";

const previousPrices = new Map<string, number>();

export class UpstoxMarketFeed extends EventEmitter {
  private subscribedKeys: Set<string> = new Set();
  private pollIntervalId: any = null;
  private isConnected: boolean = false;
  private pollIntervalMs: number = 1000; // 1-second polling interval

  constructor() {
    super();
  }

  /**
   * Starts the feed connection (or polling loop)
   */
  public async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    console.log("[MarketFeed] Starting market feed (REST-polling fallback mode)...");
    this.isConnected = true;
    this.startPolling();
    this.emit("connect");
    return true;
  }

  /**
   * Subscribes to a list of instrument keys
   */
  public subscribe(instrumentKeys: string[]): void {
    instrumentKeys.forEach((key) => this.subscribedKeys.add(key));
    console.log(`[MarketFeed] Subscribed to instruments: ${instrumentKeys.join(", ")}`);
    
    // Trigger immediate poll on subscription change
    if (this.isConnected) {
      this.pollOnce();
    }
  }

  /**
   * Unsubscribes from a list of instrument keys
   */
  public unsubscribe(instrumentKeys: string[]): void {
    instrumentKeys.forEach((key) => this.subscribedKeys.delete(key));
    console.log(`[MarketFeed] Unsubscribed from: ${instrumentKeys.join(", ")}`);
  }

  /**
   * Stops the feed and clears all intervals
   */
  public disconnect(): void {
    this.isConnected = false;
    this.stopPolling();
    this.emit("disconnect");
    console.log("[MarketFeed] Market feed disconnected.");
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollIntervalId = setInterval(() => {
      this.pollOnce();
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.subscribedKeys.size === 0) return;

    try {
      const keys = Array.from(this.subscribedKeys);
      const quotes = await fetchMarketQuotes(keys);

      for (const [key, quote] of Object.entries(quotes)) {
        const last_price = quote.last_price;
        const previousPrice = previousPrices.get(key) ?? last_price;

        const tick: Tick = {
          instrument_key: key,
          price: last_price,
          volume: quote.volume,
          timestamp: quote.last_trade_time || new Date().toISOString(),
          open: previousPrice,
          high: Math.max(previousPrice, last_price),
          low: Math.min(previousPrice, last_price),
          close: last_price,
        };

        previousPrices.set(key, last_price);
        
        this.emit("tick", tick);
      }
    } catch (err) {
      this.emit("error", err);
      console.error("[MarketFeed] Polling tick error:", err);
    }
  }
}

// Export a singleton instance
export const marketFeed = new UpstoxMarketFeed();
