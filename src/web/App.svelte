<script>
  import { onMount } from 'svelte';
  import Pilots from './pages/Pilots.svelte';
  import Governance from './pages/Governance.svelte';
  import Channels from './pages/Channels.svelte';
  import Dashboard from './pages/Dashboard.svelte';

  let currentPage = 'dashboard';
  let systemStatus = null;
  let loading = true;
  let error = null;

  onMount(async () => {
    try {
      const res = await fetch('http://localhost:3000/status');
      systemStatus = await res.json();
      loading = false;
    } catch (err) {
      error = `Connection error: ${err.message}`;
      loading = false;
    }
  });

  const navItems = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'pilots', label: '✈️ Pilots', icon: '✈️' },
    { id: 'governance', label: '🗳️ Voting', icon: '🗳️' },
    { id: 'channels', label: '🎬 Channels', icon: '🎬' },
  ];
</script>

<div class="app">
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <h1>🎬 CryptoCall FM / AgentTV Network</h1>
      <p class="subtitle">Decentralized AI Entertainment Platform</p>
    </div>
    {#if systemStatus}
      <div class="status-indicator">
        <span class="status-dot {systemStatus.running ? 'running' : 'stopped'}"></span>
        <span>{systemStatus.running ? 'Live' : 'Offline'}</span>
      </div>
    {/if}
  </header>

  <!-- Navigation -->
  <nav class="sidebar">
    <div class="nav-items">
      {#each navItems as item}
        <button 
          class="nav-item {currentPage === item.id ? 'active' : ''}"
          on:click={() => currentPage = item.id}
        >
          <span class="icon">{item.icon}</span>
          <span class="label">{item.label}</span>
        </button>
      {/each}
    </div>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    {:else if error}
      <div class="error-container">
        <div class="error-message">
          <h2>⚠️ Connection Error</h2>
          <p>{error}</p>
          <p class="hint">Make sure the server is running: <code>npm start</code></p>
        </div>
      </div>
    {:else}
      <div class="page-container">
        {#if currentPage === 'dashboard'}
          <Dashboard {systemStatus} />
        {:else if currentPage === 'pilots'}
          <Pilots />
        {:else if currentPage === 'governance'}
          <Governance />
        {:else if currentPage === 'channels'}
          <Channels />
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #0f0f0f;
    color: #fff;
  }

  .app {
    display: flex;
    height: 100vh;
    background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
  }

  .header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: rgba(0, 0, 0, 0.8);
    border-bottom: 2px solid #ff006e;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 40px;
    z-index: 100;
    backdrop-filter: blur(10px);
  }

  .header-content h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(135deg, #ff006e, #00d9ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 4px 0 0 0;
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    font-size: 12px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.running {
    background: #00d926;
    box-shadow: 0 0 10px #00d926;
  }

  .status-dot.stopped {
    background: #ff4d4f;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 80px;
    width: 220px;
    height: calc(100vh - 80px);
    background: rgba(15, 15, 15, 0.6);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    padding: 20px 0;
    overflow-y: auto;
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 16px 20px;
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
    font-size: 14px;
    font-weight: 500;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .nav-item.active {
    background: rgba(255, 0, 110, 0.1);
    border-right: 3px solid #ff006e;
    color: #ff006e;
  }

  .icon {
    font-size: 20px;
  }

  .main-content {
    flex: 1;
    margin-left: 220px;
    margin-top: 80px;
    overflow-y: auto;
    padding: 40px;
  }

  .page-container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60vh;
    gap: 20px;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top: 3px solid #ff006e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60vh;
  }

  .error-message {
    background: rgba(255, 77, 79, 0.1);
    border: 1px solid #ff4d4f;
    border-radius: 8px;
    padding: 40px;
    max-width: 500px;
    text-align: center;
  }

  .error-message h2 {
    margin: 0 0 16px 0;
    color: #ff4d4f;
  }

  .error-message p {
    margin: 8px 0;
    color: #aaa;
  }

  .hint {
    background: rgba(255, 255, 255, 0.05);
    padding: 12px;
    border-radius: 4px;
    font-size: 12px;
    margin-top: 16px;
  }

  code {
    background: rgba(255, 0, 110, 0.2);
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Monaco', 'Courier New', monospace;
    color: #ff006e;
  }

  @media (max-width: 768px) {
    .sidebar {
      display: none;
    }

    .main-content {
      margin-left: 0;
    }

    .header {
      padding: 0 20px;
    }

    .header-content h1 {
      font-size: 20px;
    }
  }
</style>
