<script lang="ts">
  import { onMount } from 'svelte';

  // Svelte 5 reactive states
  let portfolioSummary = $state({
    balance: 100000,
    margin_available: 100000,
    margin_used: 0,
    total_equity: 100000,
    unrealized_pnl: 0,
    realized_pnl: 0,
    daily_drawdown_percent: 0,
  });

  let watchlistQuotes = $state<Record<string, any>>({});
  let activePositions = $state<any[]>([]);
  let exitStatus = $state('');

  const watchlist = [
    { key: "NSE_EQ|INE062A01020", name: "SBI", symbol: "SBIN" },
    { key: "NSE_EQ|INE002A01018", name: "Reliance", symbol: "RELIANCE" },
    { key: "NSE_EQ|INE040A01034", name: "HDFC Bank", symbol: "HDFCBANK" },
    { key: "NSE_EQ|INE009A01021", name: "Infosys", symbol: "INFY" },
    { key: "NSE_EQ|INE467B01029", name: "TCS", symbol: "TCS" },
    { key: "NSE_EQ|INE154A01025", name: "ITC", symbol: "ITC" },
  ];

  async function updateDashboardData() {
    try {
      // 1. Fetch summary
      const sumRes = await fetch('http://localhost:3000/api/portfolio/summary');
      if (sumRes.ok) portfolioSummary = await sumRes.json();

      // 2. Fetch watchlist quotes
      const quoteRes = await fetch('http://localhost:3000/api/market/quotes');
      if (quoteRes.ok) watchlistQuotes = await quoteRes.json();

      // 3. Fetch active positions
      const posRes = await fetch('http://localhost:3000/api/portfolio/positions');
      if (posRes.ok) activePositions = await posRes.json();
    } catch (e) {
      console.error('Error fetching dashboard updates:', e);
    }
  }

  async function triggerEmergencyExit() {
    exitStatus = 'Sending exit orders...';
    try {
      const res = await fetch('http://localhost:3000/api/portfolio/exit-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        exitStatus = 'Exit complete! All positions closed.';
        updateDashboardData();
      } else {
        exitStatus = 'Failed to exit: check broker connection.';
      }
    } catch (e: any) {
      exitStatus = `Error: ${e.message}`;
    }
    setTimeout(() => exitStatus = '', 4000);
  }

  onMount(() => {
    updateDashboardData();
    const interval = setInterval(updateDashboardData, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  });
</script>

<div class="dashboard-grid">
  <!-- Key Metrics Row -->
  <section class="metrics-row">
    <div class="glass-card metric-card">
      <span class="metric-label">Capital Balance</span>
      <span class="metric-value">₹{portfolioSummary.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    </div>

    <div class="glass-card metric-card">
      <span class="metric-label">Available Margin</span>
      <span class="metric-value">₹{portfolioSummary.margin_available.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    </div>

    <div class="glass-card metric-card">
      <span class="metric-label">Used Margin</span>
      <span class="metric-value">₹{portfolioSummary.margin_used.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    </div>

    <div class="glass-card metric-card pnl {portfolioSummary.unrealized_pnl + portfolioSummary.realized_pnl >= 0 ? 'bull' : 'bear'}">
      <span class="metric-label">Net Daily P&L</span>
      <span class="metric-value">
        {portfolioSummary.unrealized_pnl + portfolioSummary.realized_pnl >= 0 ? '+' : ''}
        ₹{(portfolioSummary.unrealized_pnl + portfolioSummary.realized_pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </span>
    </div>
  </section>

  <!-- Left/Right Split Layout -->
  <div class="dashboard-columns">
    <!-- Active Watchlist -->
    <section class="glass-card watchlist-section">
      <div class="section-header">
        <h2>📊 Watchlist (NSE Live Feed)</h2>
      </div>
      <div class="watchlist-list">
        {#each watchlist as item}
          {@const quote = watchlistQuotes[item.key]}
          <div class="watchlist-row">
            <div class="symbol-info">
              <span class="symbol-tag">{item.symbol}</span>
              <span class="company-desc">{item.name}</span>
            </div>
            <div class="symbol-price">
              {#if quote}
                <span class="price-val">₹{quote.last_price.toFixed(2)}</span>
                <span class="change-tag {quote.net_change >= 0 ? 'bull' : 'bear'}">
                  {quote.net_change >= 0 ? '▲' : '▼'} {Math.abs(quote.net_change).toFixed(2)}
                </span>
              {:else}
                <span class="loading-tag">Offline</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Active Positions / Controls -->
    <section class="right-column">
      <!-- Active Positions -->
      <div class="glass-card positions-section">
        <h2>💼 Open Positions ({activePositions.filter(p => p.status === 'OPEN').length})</h2>
        <div class="positions-list">
          {#if activePositions.filter(p => p.status === 'OPEN').length === 0}
            <div class="empty-state">No open positions at this time.</div>
          {:else}
            {#each activePositions.filter(p => p.status === 'OPEN') as pos}
              <div class="position-row">
                <div class="pos-symbol">
                  <span class="symbol-tag">{pos.trading_symbol}</span>
                  <span class="pos-qty">{pos.quantity} Qty</span>
                </div>
                <div class="pos-pnl {pos.unrealized_pnl >= 0 ? 'bull' : 'bear'}">
                  <span class="pnl-val">₹{pos.unrealized_pnl.toFixed(2)}</span>
                  <span class="avg-price">Avg ₹{pos.average_price.toFixed(2)}</span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Risk Controls -->
      <div class="glass-card risk-controls">
        <h2>🛡️ Emergency Operations</h2>
        <p class="risk-info-text">
          Warning: Closing all positions will exit all open market trades immediately. This overrides AI agent state commands.
        </p>
        <button class="emergency-exit-btn" onclick={triggerEmergencyExit}>
          🚨 EXIT ALL POSITIONS
        </button>
        {#if exitStatus}
          <div class="exit-status-alert">{exitStatus}</div>
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  .dashboard-grid {
    display: flex;
    flex-direction: column;
    gap: 15px;
    height: 100%;
  }

  /* Key metrics row */
  .metrics-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
  }

  .metric-card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 12px;
  }

  .metric-label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .metric-value {
    font-size: 22px;
    font-weight: 600;
  }

  .metric-card.pnl.bull {
    border-left: 4px solid var(--color-bull);
  }

  .metric-card.pnl.bear {
    border-left: 4px solid var(--color-bear);
  }

  /* Column layouts */
  .dashboard-columns {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 15px;
    flex: 1;
  }

  .watchlist-section {
    padding: 20px;
    display: flex;
    flex-direction: column;
  }

  .section-header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 12px;
    margin-bottom: 12px;
  }

  .watchlist-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    flex: 1;
  }

  .watchlist-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border);
  }

  .symbol-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .symbol-tag {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .company-desc {
    font-size: 11px;
    color: var(--text-dim);
  }

  .symbol-price {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .price-val {
    font-size: 16px;
    font-weight: 600;
  }

  .change-tag {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .change-tag.bull {
    background: rgba(34, 197, 94, 0.12);
    color: var(--color-bull);
  }

  .change-tag.bear {
    background: rgba(239, 68, 68, 0.12);
    color: var(--color-bear);
  }

  .loading-tag {
    font-size: 12px;
    color: var(--text-dim);
  }

  /* Right column panels */
  .right-column {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .positions-section {
    padding: 20px;
    flex: 1.2;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .positions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    flex: 1;
  }

  .empty-state {
    text-align: center;
    padding: 30px 0;
    color: var(--text-dim);
    font-size: 14px;
  }

  .position-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border);
  }

  .pos-symbol {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pos-qty {
    font-size: 12px;
    color: var(--text-muted);
  }

  .pos-pnl {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .pnl-val {
    font-size: 15px;
    font-weight: 600;
  }

  .pos-pnl.bull .pnl-val {
    color: var(--color-bull);
  }

  .pos-pnl.bear .pnl-val {
    color: var(--color-bear);
  }

  .avg-price {
    font-size: 11px;
    color: var(--text-dim);
  }

  .risk-controls {
    padding: 20px;
    flex: 0.8;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .risk-info-text {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .emergency-exit-btn {
    background: linear-gradient(135deg, hsl(350, 89%, 45%), hsl(350, 89%, 60%));
    border: none;
    padding: 12px;
    border-radius: 8px;
    color: white;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.25);
    transition: all 0.2s;
  }

  .emergency-exit-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.35);
  }

  .exit-status-alert {
    padding: 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border);
    font-size: 12px;
    text-align: center;
    color: var(--color-warning);
  }
</style>
