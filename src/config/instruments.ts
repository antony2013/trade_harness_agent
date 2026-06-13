export interface Instrument {
  instrument_key: string;
  name: string;
  trading_symbol: string;
  exchange: "NSE" | "BSE" | "NFO" | "MCX";
  tick_size: number;
  lot_size: number;
  segment: string;
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

// Helper to look up an instrument by key
export function getInstrument(key: string): Instrument | undefined {
  return WATCHLIST.find((inst) => inst.instrument_key === key);
}

// Helper to look up an instrument by symbol
export function getInstrumentBySymbol(symbol: string): Instrument | undefined {
  return WATCHLIST.find((inst) => inst.trading_symbol === symbol);
}
