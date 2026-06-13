/**
 * Checks if the market is currently open (9:15 AM - 3:30 PM IST, Monday - Friday)
 * @returns true if market is open, false otherwise
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  // IST = UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 9:15 AM = 555 min, 3:30 PM = 930 min
  return totalMinutes >= 555 && totalMinutes <= 930;
}

/**
 * Gets the next date and time when the market opens in local system time
 * @returns The Date object for the next market open
 */
export function getNextMarketOpen(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  let candidate = new Date(now.getTime() + istOffset);
  
  // Set candidate to 9:15 AM IST
  candidate.setUTCHours(9, 15, 0, 0);
  
  // If the candidate time has already passed today, or if it is weekend, roll forward
  while (true) {
    const day = candidate.getUTCDay();
    if (day !== 0 && day !== 6 && candidate.getTime() > now.getTime() + istOffset) {
      break;
    }
    // Roll to next day
    candidate.setUTCDate(candidate.getUTCDate() + 1);
    candidate.setUTCHours(9, 15, 0, 0);
  }
  
  // Convert back from IST candidate to system local time
  return new Date(candidate.getTime() - istOffset);
}
