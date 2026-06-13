export interface Instrument {
  instrument_key: string;
  name: string;
  trading_symbol: string;
  exchange: "NSE" | "BSE" | "NFO" | "MCX";
  tick_size: number;
  lot_size: number;
  segment: string;
  strike_price?: number;
  expiry?: string;
  option_type?: "CE" | "PE";
  underlying?: string;
}

export const WATCHLIST: Instrument[] = [
  {
    instrument_key: "NSE_EQ|INE062A01020",
    name: "State Bank of India",
    trading_symbol: "SBIN",
    exchange: "NSE",
    tick_size: 0.05,
    lot_size: 1,
    segment: "NSE_EQ"
  },
  {
    instrument_key: "NSE_EQ|INE002A01018",
    name: "Reliance Industries Limited",
    trading_symbol: "RELIANCE",
    exchange: "NSE",
    tick_size: 0.05,
    lot_size: 1,
    segment: "NSE_EQ"
  },
  {
    instrument_key: "NSE_EQ|INE397D01024",
    name: "Bharti Airtel Limited",
    trading_symbol: "BHARTIALRT",
    exchange: "NSE",
    tick_size: 0.05,
    lot_size: 1,
    segment: "NSE_EQ"
  },
  {
    instrument_key: "NSE_EQ|INE040A01034",
    name: "HDFC Bank Limited",
    trading_symbol: "HDFCBANK",
    exchange: "NSE",
    tick_size: 0.05,
    lot_size: 1,
    segment: "NSE_EQ"
  },
  {
    instrument_key: "NSE_EQ|INE009A01021",
    name: "Infosys Limited",
    trading_symbol: "INFY",
    exchange: "NSE",
    tick_size: 0.05,
    lot_size: 1,
    segment: "NSE_EQ"
  },
  {
    instrument_key: "NSE_EQ|INE467B01029",
    name: "Tata Consultancy Services Limited",
    trading_symbol: "TCS",
    exchange: "NSE",
    tick_size: 0.05,
    lot_size: 1,
    segment: "NSE_EQ"
  },
  {
    instrument_key: "NSE_EQ|INE075A01022",
    name: "Wipro Limited",
    trading_symbol: "WIPRO",
    exchange: "NSE",
    tick_size: 0.05,
    lot_size: 1,
    segment: "NSE_EQ"
  },
  {
    instrument_key: "NSE_EQ|INE154A01025",
    name: "ITC Limited",
    trading_symbol: "ITC",
    exchange: "NSE",
    tick_size: 0.05,
    lot_size: 1,
    segment: "NSE_EQ"
  }
];

/**
 * Helper to get or generate an options instrument
 * @param symbol - The underlying symbol (e.g., "NIFTY")
 * @param strike - The strike price (e.g., 23000)
 * @param expiry - The expiry date string (e.g., "2026-06-18")
 * @param type - The option type ("CE" or "PE")
 * @returns The Instrument object
 */
export function getOptionsInstrument(
  symbol: string,
  strike: number,
  expiry: string,
  type: "CE" | "PE"
): Instrument {
  const date = new Date(expiry);
  if (isNaN(date.getTime())) {
    throw new Error("[getOptionsInstrument] Invalid expiry date: " + expiry);
  }
  const yy = date.getFullYear().toString().slice(-2);
  const monthVal = date.getMonth() + 1;
  let m = "";
  if (monthVal === 10) m = "O";
  else if (monthVal === 11) m = "N";
  else if (monthVal === 12) m = "D";
  else m = monthVal.toString();
  const dd = date.getDate().toString().padStart(2, "0");
  const key = `NFO_OPT|${symbol}${yy}${m}${dd}${strike}${type}`;
  return {
    instrument_key: key,
    name: `${symbol} ${expiry} ${strike} ${type}`,
    trading_symbol: `${symbol}${yy}${m}${dd}${strike}${type}`,
    exchange: "NFO",
    tick_size: 0.05,
    lot_size: symbol.toUpperCase() === "NIFTY" ? 75 : 30,
    segment: "NFO_OPT",
    strike_price: strike,
    expiry: expiry,
    option_type: type,
    underlying: symbol
  };
}

export const OPTIONS_WATCHLIST: Instrument[] = [
  getOptionsInstrument("NIFTY", 23000, "2026-06-18", "CE"),
  getOptionsInstrument("NIFTY", 23000, "2026-06-18", "PE"),
  getOptionsInstrument("BANKNIFTY", 50000, "2026-06-17", "CE"),
  getOptionsInstrument("BANKNIFTY", 50000, "2026-06-17", "PE")
];

/**
 * Helper to look up an instrument by key
 * @param key - The instrument key
 * @returns The Instrument object if found
 */
export function getInstrument(key: string): Instrument | undefined {
  const found = WATCHLIST.find((inst) => inst.instrument_key === key);
  if (found) return found;
  return OPTIONS_WATCHLIST.find((inst) => inst.instrument_key === key);
}

/**
 * Helper to look up an instrument by symbol
 * @param symbol - The trading symbol
 * @returns The Instrument object if found
 */
export function getInstrumentBySymbol(symbol: string): Instrument | undefined {
  const found = WATCHLIST.find((inst) => inst.trading_symbol === symbol);
  if (found) return found;
  return OPTIONS_WATCHLIST.find((inst) => inst.trading_symbol === symbol);
}
