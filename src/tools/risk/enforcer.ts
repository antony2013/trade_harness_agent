import { RISK_RULES, getSectorForInstrument } from "../../config/risk-rules";
import { fetchAccountSummary, fetchPositions } from "../upstox/portfolio";
import { fetchMarketQuote } from "../upstox/market-data";

/**
 * Programmatically enforces risk rules on a proposed trade signal.
 * @param signal - The trade signal to evaluate
 * @param signal.instrumentKey - The instrument key of the proposed trade
 * @param signal.quantity - The quantity of shares/lots to trade
 * @param signal.transactionType - The type of transaction ("BUY" or "SELL")
 * @returns An object indicating approval status, reasoning, and adjusted quantity
 */
export async function enforceRiskRules(signal: {
  instrumentKey: string;
  quantity: number;
  transactionType: "BUY" | "SELL";
}): Promise<{ approved: boolean; reason: string; adjustedQuantity: number }> {
  try {
    const summary = await fetchAccountSummary();
    const positions = await fetchPositions();

    const openPositions = positions.filter((p) => p.quantity !== 0);

    // Check 1: Open positions count
    const hasExistingPosition = openPositions.some((p) => p.instrument_key === signal.instrumentKey);
    if (!hasExistingPosition && openPositions.length >= RISK_RULES.maxOpenPositions) {
      return {
        approved: false,
        reason: `Max open positions limit (${RISK_RULES.maxOpenPositions}) reached.`,
        adjustedQuantity: 0,
      };
    }

    // Fetch current price of the instrument
    const quote = await fetchMarketQuote(signal.instrumentKey);
    const currentPrice = quote.last_price;
    const totalEquity = summary.total_equity;

    // Check 2: Position size limit
    const proposedValue = signal.quantity * currentPrice;
    const maxAllowedValue = RISK_RULES.maxPositionSizePercent * totalEquity;

    let qty = signal.quantity;
    if (proposedValue > maxAllowedValue) {
      qty = Math.floor(maxAllowedValue / currentPrice);
      if (qty <= 0) {
        return {
          approved: false,
          reason: `Proposed size is larger than max allowed position size (${RISK_RULES.maxPositionSizePercent * 100}%) and adjusted quantity is 0.`,
          adjustedQuantity: 0,
        };
      }
    }

    // Check 3: Daily drawdown limit
    if (summary.daily_drawdown_percent >= RISK_RULES.dailyLossLimitPercent * 100) {
      return {
        approved: false,
        reason: `Daily drawdown limit exceeded: ${summary.daily_drawdown_percent.toFixed(2)}% >= ${RISK_RULES.dailyLossLimitPercent * 100}%.`,
        adjustedQuantity: 0,
      };
    }

    // Check 4: Sector exposure limit
    const sector = getSectorForInstrument(signal.instrumentKey);
    let existingSectorValue = 0;
    for (const pos of openPositions) {
      if (pos.instrument_key !== signal.instrumentKey && getSectorForInstrument(pos.instrument_key) === sector) {
        existingSectorValue += Math.abs(pos.quantity) * pos.current_price;
      }
    }

    const proposedSectorValue = existingSectorValue + (qty * currentPrice);
    if (proposedSectorValue > RISK_RULES.sectorExposureLimitPercent * totalEquity) {
      return {
        approved: false,
        reason: `Sector exposure limit exceeded for ${sector}. Sector limit is ${RISK_RULES.sectorExposureLimitPercent * 100}%.`,
        adjustedQuantity: 0,
      };
    }

    const approved = qty > 0;
    const isAdjusted = qty !== signal.quantity;
    return {
      approved,
      reason: isAdjusted ? "Quantity adjusted to comply with risk limits." : "Trade signal complies with all risk rules.",
      adjustedQuantity: qty,
    };
  } catch (err: any) {
    throw new Error(`[Enforcer] enforceRiskRules failed: ${err.message}`);
  }
}
