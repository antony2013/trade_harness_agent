<script lang="ts">
  import { onMount } from 'svelte';

  // Monospace code template for initial editor state
  let sourceCode = $state(`// SMA Crossover Strategy Script
// Exposes indicator math on 'indicators' context object

const candles = [
  { close: 100, volume: 1000 },
  { close: 102, volume: 1500 },
  { close: 104, volume: 1200 },
  { close: 101, volume: 2000 },
  { close: 105, volume: 1800 }
];

console.log("Starting backtest evaluation...");
const closes = candles.map(c => c.close);

// Call exposed mathematical indicator helpers
const rsiValue = indicators.computeRSI(
  candles.map(c => ({ ...c, time: new Date().toISOString(), open: c.close, high: c.close, low: c.close })),
  3
);

console.log("Calculated RSI values series:", JSON.stringify(rsiValue));
console.log("Evaluation complete. Signal: BUY");*/
`);

  let terminalLogs = $state<string[]>([
    "Sandbox VM Terminal ready.",
    "Coding Agent environment initialized at ./sandbox/",
    "Exposed utilities: indicators (RSI, EMA, ATR, VWAP)",
    "Type or edit code on the left and click 'Compile & Run' to execute."
  ]);

  let isExecuting = $state(false);

  async function executeCode() {
    isExecuting = true;
    terminalLogs = [...terminalLogs, "", `> bun run sandbox_script.ts [${new Date().toLocaleTimeString()}]`, "Compiling..."];

    try {
      // Direct instruction to the Coding Agent to run this code in its sandbox
      const res = await fetch('http://localhost:3000/api/chat/coding_agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Please run this JavaScript code in your sandbox VM and report the exact results and console outputs: \n\n\`\`\`javascript\n${sourceCode}\n\`\`\``
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const responseText = data.response?.content || "";
        
        // Try parsing JSON if agent returned tool result, otherwise print reply
        try {
          // Parse out markdown block if returned as string
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.logs) {
              terminalLogs = [...terminalLogs, ...parsed.logs];
            }
            if (parsed.success) {
              terminalLogs = [...terminalLogs, "🟢 Execution Succeeded!"];
            } else if (parsed.error) {
              terminalLogs = [...terminalLogs, `🔴 Runtime Error: ${parsed.error}`];
            }
          } else {
            terminalLogs = [...terminalLogs, responseText];
          }
        } catch {
          // Fallback to raw text
          terminalLogs = [...terminalLogs, responseText];
        }
      } else {
        terminalLogs = [...terminalLogs, "🔴 Execution failed: Backend server error"];
      }
    } catch (e: any) {
      terminalLogs = [...terminalLogs, `🔴 Execution failed: ${e.message}`];
    } finally {
      isExecuting = false;
    }
  }

  function clearTerminal() {
    terminalLogs = ["Terminal logs cleared."];
  }
</script>

<div class="sandbox-container">
  <!-- Code Editor Panel -->
  <section class="glass-card editor-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="file-icon">📄</span>
        <h3>sandbox_script.ts</h3>
      </div>
      <button class="run-btn" onclick={executeCode} disabled={isExecuting}>
        {#if isExecuting}⏳ Running...{:else}▶ Compile & Run{/if}
      </button>
    </div>
    <div class="editor-textarea-wrapper">
      <div class="line-numbers">
        {#each Array(sourceCode.split('\n').length) as _, i}
          <span>{i + 1}</span>
        {/each}
      </div>
      <textarea 
        bind:value={sourceCode} 
        disabled={isExecuting}
        spellcheck="false"
      ></textarea>
    </div>
  </section>

  <!-- Output Terminal Panel -->
  <section class="glass-card terminal-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="terminal-icon">💻</span>
        <h3>Sandbox Output Console</h3>
      </div>
      <button class="clear-btn" onclick={clearTerminal}>
        🧹 Clear
      </button>
    </div>
    <div class="terminal-body">
      {#each terminalLogs as log}
        <div class="terminal-line {log.startsWith('>') ? 'cmd' : log.includes('🔴') ? 'err' : log.includes('🟢') ? 'success' : ''}">
          {log}
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .sandbox-container {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 15px;
    height: calc(100vh - 110px);
    min-height: 0;
  }

  .panel-header {
    height: 50px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 15px;
    border-bottom: 1px solid var(--border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-header h3 {
    font-size: 14px;
    font-weight: 600;
  }

  /* Code editor styles */
  .editor-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .editor-textarea-wrapper {
    display: flex;
    flex: 1;
    min-height: 0;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px;
  }

  .line-numbers {
    width: 45px;
    background: rgba(0, 0, 0, 0.2);
    border-right: 1px solid var(--border);
    padding: 15px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--text-dim);
    user-select: none;
    line-height: 20px;
  }

  .editor-textarea-wrapper textarea {
    flex: 1;
    background: transparent;
    border: none;
    color: hsl(200, 15%, 85%);
    padding: 15px;
    resize: none;
    outline: none;
    font-family: inherit;
    font-size: inherit;
    line-height: 20px;
    white-space: pre;
    overflow-x: auto;
  }

  .run-btn {
    background: var(--primary-gradient);
    border: none;
    padding: 6px 16px;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(59, 130, 246, 0.25);
    transition: all 0.2s;
  }

  .run-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 15px rgba(59, 130, 246, 0.35);
  }

  .run-btn:disabled {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-dim);
    box-shadow: none;
    cursor: not-allowed;
  }

  /* Monospace terminal console styles */
  .terminal-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: black;
  }

  .clear-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text);
  }

  .terminal-body {
    flex: 1;
    padding: 15px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    overflow-y: auto;
    color: hsl(120, 80%, 45%); /* Classic terminal green */
  }

  .terminal-line {
    white-space: pre-wrap;
    margin-bottom: 4px;
  }

  .terminal-line.cmd {
    color: hsl(210, 100%, 60%); /* command blue */
    font-weight: 600;
  }

  .terminal-line.err {
    color: hsl(355, 85%, 55%); /* error red */
  }

  .terminal-line.success {
    color: hsl(145, 80%, 45%); /* success green */
    font-weight: 600;
  }
</style>
