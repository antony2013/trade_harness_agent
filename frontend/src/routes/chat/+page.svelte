<script lang="ts">
  import { onMount } from 'svelte';

  interface Agent {
    role: string;
    name: string;
    greeting: string;
    icon: string;
    description: string;
  }

  interface Message {
    id: string;
    sender: string;
    recipient: string;
    content: string;
    timestamp: string;
    reasoning?: string;
  }

  // Pre-configured list of agents with premium icons and descriptions
  const agents: Agent[] = [
    { role: "fund_manager", name: "Fund Manager", icon: "🎯", greeting: "", description: "CEO & orchestrator of trading deployments" },
    { role: "data_collector", name: "Data Collector", icon: "📊", greeting: "", description: "Gathers raw tick data and historical candles" },
    { role: "technical_analyst", name: "Technical Analyst", icon: "📈", greeting: "", description: "Calculates price averages, RSI, ATR, and breakouts" },
    { role: "fundamental_analyst", name: "Fundamental Analyst", icon: "🔬", greeting: "", description: "Evaluates company metrics, P/E, and balance sheets" },
    { role: "sentiment_analyst", name: "Sentiment Analyst", icon: "📰", greeting: "", description: "Parses financial news headlines and article feeds" },
    { role: "strategy_builder", name: "Strategy Builder", icon: "💡", greeting: "", description: "Formulates target entries, targets, and stop-losses" },
    { role: "rl_evaluator", name: "RL Evaluator", icon: "🧪", greeting: "", description: "Applies reinforcement learning Q-value checks" },
    { role: "risk_manager", name: "Risk Manager", icon: "🛡️", greeting: "", description: "Enforces capital protection and drawdown limits" },
    { role: "execution_engine", name: "Execution Engine", icon: "⚡", greeting: "", description: "Routes trade orders to Upstox broker accounts" },
    { role: "coding_agent", name: "Coding Agent", icon: "💻", greeting: "", description: "Writes and tests scripts in the VM sandbox" },
    { role: "bull_agent", name: "Bull Agent", icon: "🐂", greeting: "", description: "Arguing the bullish long entry thesis" },
    { role: "bear_agent", name: "Bear Agent", icon: "🐻", greeting: "", description: "Arguing capital protection and downside risks" },
  ];

  // Quick Action Buttons based on agent role
  const quickActions: Record<string, string[]> = {
    fund_manager: ["Verify overall portfolio exposure", "Initiate trade debate for SBIN", "Trigger system audit log checks"],
    data_collector: ["Get available capital margin", "List tracked equity instruments"],
    technical_analyst: ["Analyze support breakout on RELIANCE", "Calculate indicators for TCS"],
    fundamental_analyst: ["Analyze HDFCBANK multiples", "Compare sectors valuations"],
    sentiment_analyst: ["Fetch recent news headlines", "Check market sentiment consensus"],
    strategy_builder: ["Build momentum signal for SBIN", "Generate breakout trading plan"],
    rl_evaluator: ["Score BUY signal state values", "Update Q-learning weights history"],
    risk_manager: ["Verify current open trades count", "Check daily loss limit status"],
    execution_engine: ["Exit all intraday positions", "Show broker account order book"],
    coding_agent: ["Write simple moving average script", "Test custom strategy in VM sandbox"],
    bull_agent: ["Formulate buy argument for SBIN"],
    bear_agent: ["Highlight downside risk for RELIANCE"],
  };

  // Reactive Svelte 5 states
  let selectedRole = $state("fund_manager");
  let messages = $state<Message[]>([]);
  let userInput = $state("");
  let isSending = $state(false);
  let chatScrollContainer = $state<HTMLElement | null>(null);

  // Computed selected agent details
  const currentAgent = $derived(agents.find(a => a.role === selectedRole)!);

  async function loadHistory(role: string) {
    try {
      const res = await fetch(`http://localhost:3000/api/chat/history/${role}`);
      if (res.ok) {
        messages = await res.json();
        scrollToBottom();
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isSending) return;
    
    userInput = "";
    isSending = true;

    // Instantly append user message optimistically
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      recipient: selectedRole,
      content: text,
      timestamp: new Date().toISOString(),
    };
    messages = [...messages, tempUserMsg];
    scrollToBottom();

    try {
      const res = await fetch(`http://localhost:3000/api/chat/${selectedRole}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          // Re-load to get the actual database message + reasoning details
          await loadHistory(selectedRole);
        }
      }
    } catch (e) {
      console.error('Send message failed:', e);
    } finally {
      isSending = false;
      scrollToBottom();
    }
  }

  async function clearHistory() {
    try {
      const res = await fetch(`http://localhost:3000/api/chat/clear/${selectedRole}`, { method: 'POST' });
      if (res.ok) {
        messages = await res.json();
      }
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  }

  function handleQuickAction(action: string) {
    sendMessage(action);
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatScrollContainer) {
        chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
      }
    }, 50);
  }

  onMount(() => {
    loadHistory(selectedRole);
  });

  // Load history whenever the selected agent changes
  $effect(() => {
    loadHistory(selectedRole);
  });
</script>

<div class="chat-container">
  <!-- Sidebar with agents list -->
  <aside class="glass-card agents-sidebar">
    <div class="sidebar-title">
      <h2>🤖 Specialist Directory</h2>
    </div>
    <div class="agents-list">
      {#each agents as agent}
        <button 
          class="agent-card {selectedRole === agent.role ? 'selected' : ''}" 
          onclick={() => selectedRole = agent.role}
        >
          <span class="agent-icon">{agent.icon}</span>
          <div class="agent-info">
            <span class="agent-name">{agent.name}</span>
            <span class="agent-desc">{agent.description}</span>
          </div>
        </button>
      {/each}
    </div>
  </aside>

  <!-- Chat Viewport -->
  <section class="glass-card chat-viewport">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-agent-info">
        <span class="header-icon">{currentAgent.icon}</span>
        <div class="header-text">
          <h2>{currentAgent.name}</h2>
          <span class="header-desc">{currentAgent.description}</span>
        </div>
      </div>
      <button class="clear-chat-btn" onclick={clearHistory}>
        🗑️ Clear Memory
      </button>
    </div>

    <!-- Message Logs -->
    <div class="chat-messages" bind:this={chatScrollContainer}>
      {#each messages as msg}
        <div class="message-wrapper {msg.sender === 'user' ? 'user' : 'agent'}">
          {#if msg.sender !== 'user'}
            <div class="avatar-tag">{currentAgent.icon}</div>
          {/if}
          <div class="message-bubble">
            {#if msg.reasoning}
              <details class="reasoning-details" open={false}>
                <summary>💡 Chain of Thought (Thinking)</summary>
                <div class="reasoning-content">{msg.reasoning}</div>
              </details>
            {/if}
            <div class="message-content">{msg.content}</div>
            <span class="message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      {/each}
      {#if isSending}
        <div class="message-wrapper agent typing">
          <div class="avatar-tag">{currentAgent.icon}</div>
          <div class="message-bubble">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Quick actions bar -->
    {#if quickActions[selectedRole]}
      <div class="quick-actions-bar">
        {#each quickActions[selectedRole] as action}
          <button class="quick-action-btn" onclick={() => handleQuickAction(action)}>
            ⚡ {action}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Input text box -->
    <form class="chat-input-form" onsubmit={(e) => { e.preventDefault(); sendMessage(userInput); }}>
      <input 
        type="text" 
        bind:value={userInput} 
        placeholder="Type a message to {currentAgent.name}..." 
        disabled={isSending}
      />
      <button type="submit" class="send-btn" disabled={!userInput.trim() || isSending}>
        ✈️ Send
      </button>
    </form>
  </section>
</div>

<style>
  .chat-container {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 15px;
    height: calc(100vh - 110px);
    min-height: 0;
  }

  /* Agents sidebar list */
  .agents-sidebar {
    display: flex;
    flex-direction: column;
    padding: 15px;
    height: 100%;
    min-height: 0;
  }

  .sidebar-title {
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
  }

  .sidebar-title h2 {
    font-size: 16px;
    font-weight: 600;
  }

  .agents-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    flex: 1;
  }

  .agent-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    width: 100%;
  }

  .agent-card:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: var(--border);
  }

  .agent-card.selected {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .agent-icon {
    font-size: 24px;
    background: rgba(255, 255, 255, 0.04);
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .agent-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .agent-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .agent-desc {
    font-size: 11px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Chat viewport container */
  .chat-viewport {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .chat-header {
    height: 60px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    border-bottom: 1px solid var(--border);
  }

  .header-agent-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    font-size: 24px;
  }

  .header-text h2 {
    font-size: 16px;
    font-weight: 600;
  }

  .header-desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .clear-chat-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-chat-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: hsl(0, 84%, 65%);
    border-color: rgba(239, 68, 68, 0.2);
  }

  /* Chat message window */
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .message-wrapper {
    display: flex;
    gap: 12px;
    max-width: 80%;
  }

  .message-wrapper.user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-wrapper.agent {
    align-self: flex-start;
  }

  .avatar-tag {
    font-size: 20px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border);
  }

  .message-bubble {
    padding: 12px 16px;
    border-radius: 12px;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .message-wrapper.user .message-bubble {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-top-right-radius: 2px;
  }

  .message-wrapper.agent .message-bubble {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border);
    border-top-left-radius: 2px;
  }

  .message-content {
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .message-time {
    font-size: 10px;
    color: var(--text-dim);
    align-self: flex-end;
  }

  /* Reasoning details box style */
  .reasoning-details {
    background: rgba(0, 0, 0, 0.25);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .reasoning-details summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--text-muted);
    outline: none;
  }

  .reasoning-content {
    margin-top: 8px;
    color: var(--text-dim);
    font-style: italic;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  /* Typing indicators */
  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }

  .typing-indicator span {
    width: 6px;
    height: 6px;
    background: var(--text-muted);
    border-radius: 50%;
    animation: typingBounce 1.4s infinite ease-in-out both;
  }

  .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
  .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

  @keyframes typingBounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  /* Quick Actions Bar */
  .quick-actions-bar {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 10px 20px;
    border-top: 1px solid var(--border);
    white-space: nowrap;
  }

  .quick-action-btn {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-action-btn:hover {
    color: var(--text);
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  /* Bottom chat inputs */
  .chat-input-form {
    display: flex;
    padding: 15px 20px;
    gap: 10px;
    border-top: 1px solid var(--border);
  }

  .chat-input-form input {
    flex: 1;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .chat-input-form input:focus {
    border-color: var(--primary);
  }

  .send-btn {
    background: var(--primary-gradient);
    border: none;
    padding: 0 20px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
    transition: all 0.2s;
  }

  .send-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 15px rgba(59, 130, 246, 0.35);
  }

  .send-btn:disabled {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-dim);
    box-shadow: none;
    cursor: not-allowed;
  }
</style>
