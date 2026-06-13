export interface RiskConfig {
  maxPositionSizePercent: number;     // e.g. 0.05 = Max 5% of portfolio in any single position
  dailyLossLimitPercent: number;      // e.g. 0.02 = Stop trading if daily loss exceeds 2% of capital
  sectorExposureLimitPercent: number; // e.g. 0.25 = Max 25% of portfolio in a single sector
  drawdownGuardLimitPercent: number;  // e.g. 0.10 = Auto-halt trading if portfolio drops 10% from peak
  killSwitchConsecutiveLosses: number;// e.g. 3 = Auto exit all and block trading after 3 consecutive losses
  maxOpenPositions: number;           // e.g. 5 = Maximum concurrent active trades
  atrMultiplierSL: number;            // e.g. 1.5 = Stop loss distance as a multiplier of Average True Range
  defaultStopLossPercent: number;     // e.g. 0.015 = 1.5% default stop loss if ATR is unavailable
  defaultTargetPercent: number;       // e.g. 0.03 = 3% default profit target
}

export const RISK_RULES: RiskConfig = {
  maxPositionSizePercent: 0.05,
  dailyLossLimitPercent: 0.02,
  sectorExposureLimitPercent: 0.25,
  drawdownGuardLimitPercent: 0.10,
  killSwitchConsecutiveLosses: 3,
  maxOpenPositions: 5,
  atrMultiplierSL: 1.5,
  defaultStopLossPercent: 0.015,
  defaultTargetPercent: 0.03,
};

// Sector definitions for tracking exposure
export const INSTRUMENT_SECTORS: Record<string, string> = {
  "NSE_EQ|INE062A01020": "Financial Services", // SBIN
  "NSE_EQ|INE002A01018": "Energy",             // RELIANCE
  "NSE_EQ|INE397D01024": "Telecommunication",  // BHARTIALRT
  "NSE_EQ|INE040A01034": "Financial Services", // HDFCBANK
  "NSE_EQ|INE009A01021": "IT",                 // INFY
  "NSE_EQ|INE467B01029": "IT",                 // TCS
  "NSE_EQ|INE075A01022": "IT",                 // WIPRO
  "NSE_EQ|INE154A01025": "FMCG",               // ITC
};

export function getSectorForInstrument(key: string): string {
  return INSTRUMENT_SECTORS[key] || "Other";
}
