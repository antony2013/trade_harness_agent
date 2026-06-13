---
name: upstox
description: >-
  Upstox Developer API reference guide. Covers authentication, account,
  funds, trading, orders, GTT, portfolio, market data, webhooks, and
  WebSockets.
---

# Upstox Developer API Reference Guide

This skill provides a complete API reference, endpoints, schemas, and usage patterns for interacting with the Upstox Developer API suite.

---

## Base URLs
- **Production REST API**: `https://api.upstox.com/v2`
- **Sandbox REST API**: `https://sandbox.upstox.com/v2`
- **WebSocket (Market Data)**: `wss://api.upstox.com/v2/feed/market-data-feed`
- **WebSocket (Order Updates)**: `wss://api.upstox.com/v2/feed/portfolio-stream-feed`

---

## Authentication

### 1. Daily OAuth Access Token
Required for placing orders and general write operations. Regenerated daily.
- **Header**: `Authorization: Bearer {access_token}`
- **Header**: `Accept: application/json`

### 2. Analytics Token
Generated once, does not expire daily. Powers read-only endpoints (Market Data, Portfolio, Account & Funds) from registered static IPs.
- **Header**: `Authorization: Bearer {analytics_token}`

---

## Endpoints Reference

### 1. Account & Funds

#### Get Profile
- **Method**: `GET`
- **Path**: `/user/profile`
- **Description**: Returns user profile details.

#### Get User Fund Limits
- **Method**: `GET`
- **Path**: `/user/get-funds-and-margin`
- **Query Params**: `segment` (e.g., `SEC` or `FO`)
- **Description**: Returns details about margins and funds available.

#### Kill Switch
- **Method**: `PUT`
- **Path**: `/user/kill-switch`
- **Request Body**:
  ```json
  {
    "status": "DISABLE"
  }
  ```

---

### 2. Orders & Trading

#### Place Order (Production & Sandbox)
- **Method**: `POST`
- **Path**: `/order/place`
- **Request Body**:
  ```json
  {
    "quantity": 10,
    "product": "I", 
    "validity": "DAY",
    "price": 0,
    "instrument_token": "NSE_EQ|INE062A01020",
    "order_type": "MARKET",
    "transaction_type": "BUY",
    "disclosed_quantity": 0,
    "trigger_price": 0,
    "is_amo": false
  }
  ```
  *(Note: Product types: `I` = Intraday, `D` = Delivery, `CO` = Cover Order, `OCO` = Bracket Order)*

#### Modify Order
- **Method**: `PUT`
- **Path**: `/order/modify`
- **Request Body**:
  ```json
  {
    "order_id": "2606130001",
    "quantity": 15,
    "price": 820.5,
    "order_type": "LIMIT",
    "trigger_price": 0,
    "validity": "DAY"
  }
  ```

#### Cancel Order
- **Method**: `DELETE`
- **Path**: `/order/cancel`
- **Query Params**: `order_id`

#### Exit Positions
- **Method**: `POST`
- **Path**: `/portfolio/positions/exit`
- **Description**: Exits all open positions.

---

### 3. GTT Orders (Good-Till-Triggered)

#### Place GTT Order
- **Method**: `POST`
- **Path**: `/gtt/place`
- **Request Body**:
  ```json
  {
    "type": "SINGLE",
    "instrument_token": "NSE_EQ|INE062A01020",
    "transaction_type": "BUY",
    "product": "D",
    "rules": [
      {
        "action": "ENTRY",
        "trigger_price": 800.0,
        "price": 800.0
      }
    ]
  }
  ```

---

### 4. Portfolio

#### Get Positions
- **Method**: `GET`
- **Path**: `/portfolio/open-completed-positions`

#### Get Holdings
- **Method**: `GET`
- **Path**: `/portfolio/long-term-holdings`

#### Trade P&L (Profit and Loss)
- **Method**: `GET`
- **Path**: `/trade/profit-loss`
- **Query Params**: `from_date`, `to_date`, `page_number`, `page_size`

---

### 5. Market Data

#### Get Market Quote
- **Method**: `GET`
- **Path**: `/market-quote/quotes`
- **Query Params**: `symbol` (e.g., `NSE_EQ|INE062A01020`)

#### Get Historical Candles (OHLCV)
- **Method**: `GET`
- **Path**: `/historical-candle/{instrument_key}/{interval}/{to_date}/{from_date}`
- **Intervals**: `1minute`, `3minute`, `5minute`, `15minute`, `30minute`, `day`, `week`, `month`

---

## Realtime & Streaming

### WebSockets Implementation (Node.js Example)

```javascript
import WebSocket from 'ws';

const wsUrl = "wss://api.upstox.com/v2/feed/market-data-feed";
const ws = new WebSocket(wsUrl, {
  headers: {
    "Authorization": "Bearer {access_token}"
  }
});

ws.on('open', () => {
  console.log("Connected to Market Data Feed");
  // Send subscription payload
  const subscribePayload = {
    guid: "some-unique-guid",
    method: "sub",
    data: {
      mode: "full",
      instrumentKeys: ["NSE_EQ|INE062A01020"]
    }
  };
  ws.send(JSON.stringify(subscribePayload));
});

ws.on('message', (data) => {
  // Messages are Protobuf encoded. Decode prior to consumption.
  console.log("Received raw packet:", data);
});
```

---

## Common Mistakes & Guardrails

1. **Missing Daily Token Renewal**: Access tokens must be renewed daily. Utilize the OAuth authentication redirect flow.
2. **Order Price Type Guardrail**: Always place orders using `LIMIT` type with explicit price constraints rather than placing `MARKET` orders during high volatility periods to avoid execution slippages.
3. **Lot Size Multiples**: For Derivatives (`F&O`), ensure that the transaction `quantity` is a multiple of the exchange-defined lot size.
