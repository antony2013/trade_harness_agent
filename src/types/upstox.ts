export interface UpstoxTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: string;
  user_name: string;
}

export interface UpstoxOrderParams {
  quantity: number;
  product: "I" | "D" | "CO" | "OCO" | "MTF"; // I = Intraday, D = Delivery, etc.
  validity: "DAY" | "IOC";
  price: number;
  tag?: string;
  instrument_token: string;
  order_type: "MARKET" | "LIMIT" | "SL" | "SL-M";
  transaction_type: "BUY" | "SELL";
  disclosed_quantity?: number;
  trigger_price?: number;
  is_amo?: boolean;
}

export interface UpstoxOrderData {
  order_id: string;
  status: string;
}

export interface UpstoxResponse<T> {
  status: "success" | "error";
  data: T;
  errors?: Array<{
    errorCode: string;
    message: string;
    propertyPath: string;
    invalidValue: any;
  }>;
}

export interface UpstoxRawQuote {
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  depth?: {
    buy: Array<{ quantity: number; price: number; orders: number }>;
    sell: Array<{ quantity: number; price: number; orders: number }>;
  };
  last_price: number;
  volume: number;
  average_price: number;
  oi?: number;
  net_change: number;
  last_trade_time: string;
}

export interface UpstoxRawPosition {
  exchange: string;
  symbol: string;
  trading_symbol: string;
  instrument_token: string;
  quantity: number;
  buy_quantity: number;
  sell_quantity: number;
  buy_amount: number;
  sell_amount: number;
  average_price: number;
  buy_price: number;
  sell_price: number;
  unrealised_gains_and_losses: number;
  realised_gains_and_losses: number;
  last_price: number;
  close_price: number;
}
