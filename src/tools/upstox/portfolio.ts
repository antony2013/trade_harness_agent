import { getBaseUrl, getHeaders } from "./auth";
import type { Position, AccountSummary } from "../../types/trade";
import type { UpstoxResponse, UpstoxRawPosition } from "../../types/upstox";

/**
 * Fetches open and completed positions
 * Endpoint: GET /portfolio/open-completed-positions
 */
export async function fetchPositions(): Promise<Position[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/portfolio/open-completed-positions`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch positions: ${res.statusText} (${res.status})`);
    }

    const json = (await res.json()) as UpstoxResponse<UpstoxRawPosition[]>;

    if (json.status !== "success" || !json.data) {
      throw new Error(`Upstox positions fetch returned error: ${JSON.stringify(json.errors || json)}`);
    }

    return json.data.map((p) => {
      const quantity = Number(p.quantity);
      return {
        instrument_key: p.instrument_token,
        trading_symbol: p.trading_symbol,
        quantity,
        average_price: Number(p.average_price),
        current_price: Number(p.last_price),
        unrealized_pnl: Number(p.unrealised_gains_and_losses),
        realized_pnl: Number(p.realised_gains_and_losses),
        entry_time: new Date().toISOString(), // Raw position API doesn't specify entry time, default to now
        status: quantity !== 0 ? "OPEN" : "CLOSED",
      };
    });
  } catch (err: any) {
    console.warn(`[Portfolio] fetchPositions failed (${err.message}). Returning empty active positions.`);
    return [];
  }
}

/**
 * Fetches equity holdings
 * Endpoint: GET /portfolio/long-term-holdings
 */
export async function fetchHoldings(): Promise<any[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/portfolio/long-term-holdings`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch holdings: ${res.statusText} (${res.status})`);
    }

    const json = (await res.json()) as UpstoxResponse<any[]>;

    if (json.status !== "success" || !json.data) {
      throw new Error(`Upstox holdings fetch returned error: ${JSON.stringify(json.errors || json)}`);
    }

    return json.data;
  } catch (err: any) {
    console.warn(`[Portfolio] fetchHoldings failed (${err.message}). Returning empty holdings.`);
    return [];
  }
}

/**
 * Fetches available margins and capital balance
 * Endpoint: GET /user/get-funds-and-margin?segment=SEC
 */
export async function fetchAccountSummary(): Promise<AccountSummary> {
  const baseUrl = getBaseUrl();
  // Fetch SEC (equity) margins by default
  const url = `${baseUrl}/user/get-funds-and-margin?segment=SEC`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch margin: ${res.statusText} (${res.status})`);
    }

    const json = (await res.json()) as UpstoxResponse<any>;

    if (json.status !== "success" || !json.data) {
      throw new Error(`Upstox margin fetch returned error: ${JSON.stringify(json.errors || json)}`);
    }

    const secData = json.data.equity || {};
    const balance = Number(secData.opening_balance || 100000); // Default to mock 100k if empty (e.g. sandbox/paper)
    const marginAvailable = Number(secData.available_margin || 100000);
    const marginUsed = Number(secData.used_margin || 0);
    const totalEquity = balance + Number(secData.payin || 0) - Number(secData.payout || 0);
    const realizedPnl = Number(secData.realised_pnl || 0);
    const unrealizedPnl = Number(secData.unrealised_pnl || 0);

    const drawdownPercent = totalEquity > 0 ? (marginUsed / totalEquity) * 100 : 0; // Simple placeholder indicator

    return {
      balance,
      margin_available: marginAvailable,
      margin_used: marginUsed,
      total_equity: totalEquity,
      unrealized_pnl: unrealizedPnl,
      realized_pnl: realizedPnl,
      daily_drawdown_percent: drawdownPercent,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[Portfolio] fetchAccountSummary failed:", err);
    // Return mock summary for development if token is uninitialized/errored
    return {
      balance: 100000,
      margin_available: 100000,
      margin_used: 0,
      total_equity: 100000,
      unrealized_pnl: 0,
      realized_pnl: 0,
      daily_drawdown_percent: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Exits all open positions in case of risk limit breach or emergency shutdown
 * Endpoint: POST /portfolio/positions/exit
 */
export async function exitAllPositions(): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/portfolio/positions/exit`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
    });

    const json = (await res.json()) as UpstoxResponse<any>;

    if (json.status !== "success") {
      throw new Error(`Upstox position exit failed: ${JSON.stringify(json.errors || json)}`);
    }

    console.warn("[Portfolio] Exit all positions triggered successfully!");
    return true;
  } catch (err) {
    console.error("[Portfolio] exitAllPositions failed:", err);
    return false;
  }
}

/**
 * Disables or enables trading account execution (Kill Switch)
 * Endpoint: PUT /user/kill-switch
 */
export async function triggerKillSwitch(disable: boolean): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/user/kill-switch`;

  const body = {
    status: disable ? "DISABLE" : "ENABLE",
  };

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as UpstoxResponse<any>;

    if (json.status !== "success") {
      throw new Error(`Upstox kill switch setting failed: ${JSON.stringify(json.errors || json)}`);
    }

    console.warn(`[Portfolio] Kill Switch set to ${body.status} successfully.`);
    return true;
  } catch (err) {
    console.error(`[Portfolio] triggerKillSwitch failed for status ${body.status}:`, err);
    return false;
  }
}
