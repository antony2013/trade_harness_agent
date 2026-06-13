<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  
  let { children } = $props();

  // Reactive state management using Svelte 5 runes
  let authStatus = $state({ authenticated: false, mode: 'sandbox' });
  let isNavCollapsed = $state(false);
  let activeTab = $state('dashboard');

  async function checkAuthStatus() {
    try {
      const res = await fetch('http://localhost:3000/api/auth/status');
      if (res.ok) {
        authStatus = await res.json();
      }
    } catch (e) {
      console.error('Failed to contact ElysiaJS backend auth status:', e);
    }
  }

  function handleLogout() {
    fetch('http://localhost:3000/api/auth/logout', { method: 'POST' })
      .then(() => checkAuthStatus())
      .catch(console.error);
  }

  onMount(() => {
    checkAuthStatus();
    // Periodically update auth status
    const interval = setInterval(checkAuthStatus, 5000);
    
    // Set active tab based on path
    const path = window.location.pathname;
    if (path.includes('/chat')) activeTab = 'chat';
    else if (path.includes('/sandbox')) activeTab = 'sandbox';
    else activeTab = 'dashboard';

    return () => clearInterval(interval);
  });
</script>

<div class="app-layout">
  <!-- Premium Sidebar -->
  <aside class="sidebar {isNavCollapsed ? 'collapsed' : ''}">
    <div class="sidebar-header">
      <div class="logo-icon">🏢</div>
      <span class="company-name">Harness Trading</span>
    </div>

    <nav class="nav-links">
      <a 
        href="/" 
        class="nav-item {activeTab === 'dashboard' ? 'active' : ''}" 
        onclick={() => activeTab = 'dashboard'}
      >
        <span class="icon">📊</span>
        <span class="label">Dashboard</span>
      </a>
      <a 
        href="/chat" 
        class="nav-item {activeTab === 'chat' ? 'active' : ''}" 
        onclick={() => activeTab = 'chat'}
      >
        <span class="icon">💬</span>
        <span class="label">Agent Harness</span>
      </a>
      <a 
        href="/sandbox" 
        class="nav-item {activeTab === 'sandbox' ? 'active' : ''}" 
        onclick={() => activeTab = 'sandbox'}
      >
        <span class="icon">🧪</span>
        <span class="label">Sandbox VM</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      {#if authStatus.authenticated}
        <button class="logout-btn" onclick={handleLogout}>
          <span class="icon">🚪</span>
          <span class="label">Disconnect Broker</span>
        </button>
      {/if}
      <div class="version">v1.0.0 (Ollama Local)</div>
    </div>
  </aside>

  <!-- Main Viewport -->
  <div class="main-container">
    <!-- Header -->
    <header class="navbar glass-card">
      <div class="header-left">
        <button class="collapse-btn" onclick={() => isNavCollapsed = !isNavCollapsed}>
          ☰
        </button>
        <h1 class="page-title glow-text">
          {#if activeTab === 'dashboard'}📊 Trading Desk{:else if activeTab === 'chat'}💬 Agent Harness Portal{:else}🧪 Sandbox Code Sandbox{/if}
        </h1>
      </div>

      <div class="header-right">
        <!-- Live vs Sandbox status -->
        <span class="status-badge {authStatus.mode === 'live' ? 'live' : 'sandbox'}">
          {authStatus.mode.toUpperCase()} MODE
        </span>

        <!-- Upstox Broker authorization status -->
        {#if authStatus.authenticated}
          <div class="broker-status connected">
            <span class="indicator">🟢</span>
            <span class="text">Upstox Connected</span>
          </div>
        {:else}
          <a href="http://localhost:3000/api/auth/login" class="broker-status disconnected pulse-glow">
            <span class="indicator">🔑</span>
            <span class="text">Authorize Upstox</span>
          </a>
        {/if}
      </div>
    </header>

    <!-- Page Content Container -->
    <main class="page-content fade-in">
      {@render children()}
    </main>
  </div>
</div>

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
    background-color: var(--bg-dark);
  }

  /* Sidebar styling */
  .sidebar {
    width: var(--sidebar-width);
    background-color: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 100;
  }

  .sidebar.collapsed {
    width: 68px;
  }

  .sidebar-header {
    height: 70px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 12px;
    border-bottom: 1px solid var(--border);
  }

  .logo-icon {
    font-size: 24px;
  }

  .company-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    transition: opacity 0.2s;
  }

  .sidebar.collapsed .company-name {
    opacity: 0;
    pointer-events: none;
  }

  .nav-links {
    padding: 20px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
    border-radius: 8px;
    color: var(--text-muted);
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s;
  }

  .nav-item:hover {
    color: var(--text);
    background-color: rgba(255, 255, 255, 0.04);
  }

  .nav-item.active {
    color: var(--text);
    background: var(--primary-gradient);
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.25);
  }

  .sidebar.collapsed .nav-item {
    padding: 12px 0;
    justify-content: center;
  }

  .sidebar.collapsed .nav-item .label {
    display: none;
  }

  .sidebar-footer {
    padding: 15px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sidebar.collapsed .sidebar-footer {
    align-items: center;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: hsl(0, 84%, 65%);
    cursor: pointer;
    font-size: 13px;
    width: 100%;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .sidebar.collapsed .logout-btn {
    padding: 8px 0;
    justify-content: center;
  }

  .sidebar.collapsed .logout-btn .label {
    display: none;
  }

  .version {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    width: 100%;
  }

  .sidebar.collapsed .version {
    display: none;
  }

  /* Main container and navbar */
  .main-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .navbar {
    height: 70px;
    margin: 15px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 12px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .collapse-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
  }

  .page-title {
    font-size: 20px;
    font-weight: 600;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
  }

  .status-badge.sandbox {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  .status-badge.live {
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-bear);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .broker-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
  }

  .broker-status.connected {
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.15);
    color: var(--color-bull);
  }

  .broker-status.disconnected {
    background: rgba(59, 130, 246, 0.08);
    border: 1px solid rgba(59, 130, 246, 0.25);
    color: var(--primary);
    cursor: pointer;
  }

  .page-content {
    flex: 1;
    padding: 0 15px 15px 15px;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
