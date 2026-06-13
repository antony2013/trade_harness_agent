import { getBaseUrl, getHeaders } from "./auth";
import type { Order } from "../../types/trade";
import type { UpstoxOrderParams, UpstoxResponse, UpstoxOrderData } from "../../types/upstox";
import { getInstrument } from "../../config/instruments";
import { env } from "../../config/env";

/**
 * Places an order via the Upstox API
 * Endpoint: POST /order/place
 */
export async function placeOrder(params: UpstoxOrderParams): Promise<Order> {
  if (env.TRADING_MODE === "sandbox") {
    const inst = getInstrument(params.instrument_token);
    const mockOrderId = "MOCK-" + Math.floor(Math.random() * 1000000000);
    const newOrder: Order = {
      order_id: mockOrderId,
      instrument_key: params.instrument_token,
      trading_symbol: inst?.trading_symbol || "UNKNOWN",
      transaction_type: params.transaction_type,
      order_type: params.order_type,
      quantity: params.quantity,
      price: params.price || 100.0,
      trigger_price: params.trigger_price,
      status: "COMPLETE",
      filled_quantity: params.quantity,
      average_price: params.price || 100.0,
      timestamp: new Date().toISOString(),
    };
    console.log(`[Orders] [Mock/Paper] Placed and filled order successfully (Bypassed API). Order ID: ${newOrder.order_id}`);
    return newOrder;
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/order/place`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const json = (await res.json()) as UpstoxResponse<UpstoxOrderData>;

    if (json.status !== "success" || !json.data) {
      throw new Error(`Upstox order placement rejected: ${JSON.stringify(json.errors || json)}`);
    }

    const inst = getInstrument(params.instrument_token);

    // Construct standard Order object
    const newOrder: Order = {
      order_id: json.data.order_id,
      instrument_key: params.instrument_token,
      trading_symbol: inst?.trading_symbol || "UNKNOWN",
      transaction_type: params.transaction_type,
      order_type: params.order_type,
      quantity: params.quantity,
      price: params.price,
      trigger_price: params.trigger_price,
      status: "OPEN",
      filled_quantity: 0,
      average_price: 0,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Orders] Placed order successfully. Order ID: ${newOrder.order_id}`);
    return newOrder;
  } catch (err: any) {
    if (env.TRADING_MODE === "live") {
      console.error("[Orders] CRITICAL: Live order placement failed:", err.message);
      throw new Error(`[Orders] LIVE ORDER FAILED: ${err.message}. No fallback in live mode.`);
    }
    console.warn(`[Orders] placeOrder failed (${err.message}). Falling back to paper-trading mock execution.`);
    const inst = getInstrument(params.instrument_token);
    const mockOrderId = "MOCK-" + Math.floor(Math.random() * 1000000000);
    const newOrder: Order = {
      order_id: mockOrderId,
      instrument_key: params.instrument_token,
      trading_symbol: inst?.trading_symbol || "UNKNOWN",
      transaction_type: params.transaction_type,
      order_type: params.order_type,
      quantity: params.quantity,
      price: params.price || 100.0,
      trigger_price: params.trigger_price,
      status: "COMPLETE",
      filled_quantity: params.quantity,
      average_price: params.price || 100.0,
      timestamp: new Date().toISOString(),
    };
    console.log(`[Orders] [Mock/Paper] Placed and filled order successfully. Order ID: ${newOrder.order_id}`);
    return newOrder;
  }
}

/**
 * Modifies an open order
 * Endpoint: PUT /order/modify
 */
export async function modifyOrder(
  orderId: string,
  quantity: number,
  price: number,
  orderType: "MARKET" | "LIMIT" | "SL" | "SL-M",
  triggerPrice?: number
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/order/modify`;

  const body = {
    order_id: orderId,
    quantity,
    price,
    order_type: orderType,
    trigger_price: triggerPrice || 0,
    validity: "DAY",
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
      throw new Error(`Upstox order modification failed: ${JSON.stringify(json.errors || json)}`);
    }

    console.log(`[Orders] Modified order ${orderId} successfully.`);
    return true;
  } catch (err) {
    console.error(`[Orders] modifyOrder failed for ID ${orderId}:`, err);
    return false;
  }
}

/**
 * Cancels an open order
 * Endpoint: DELETE /order/cancel?order_id={orderId}
 */
export async function cancelOrder(orderId: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/order/cancel?order_id=${encodeURIComponent(orderId)}`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: getHeaders(),
    });

    const json = (await res.json()) as UpstoxResponse<any>;

    if (json.status !== "success") {
      throw new Error(`Upstox order cancellation failed: ${JSON.stringify(json.errors || json)}`);
    }

    console.log(`[Orders] Cancelled order ${orderId} successfully.`);
    return true;
  } catch (err) {
    console.error(`[Orders] cancelOrder failed for ID ${orderId}:`, err);
    return false;
  }
}

/**
 * Fetches the order book
 * Endpoint: GET /order/retrieve-all
 */
export async function fetchOrderBook(): Promise<Order[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/order/retrieve-all`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to retrieve order book: ${res.statusText} (${res.status})`);
    }

    const json = (await res.json()) as UpstoxResponse<any[]>;

    if (json.status !== "success" || !json.data) {
      throw new Error(`Upstox order book retrieve returned error: ${JSON.stringify(json.errors || json)}`);
    }

    return json.data.map((o) => ({
      order_id: o.order_id,
      instrument_key: o.instrument_token,
      trading_symbol: o.trading_symbol,
      transaction_type: o.transaction_type,
      order_type: o.order_type,
      quantity: o.quantity,
      price: o.price,
      trigger_price: o.trigger_price,
      status: o.status, // e.g. "COMPLETE", "REJECTED", "CANCELLED", etc.
      filled_quantity: o.filled_quantity || 0,
      average_price: o.average_price || 0,
      status_message: o.status_message,
      timestamp: o.order_timestamp,
    }));
  } catch (err: any) {
    console.warn(`[Orders] fetchOrderBook failed (${err.message}). Returning empty order list.`);
    return [];
  }
}
