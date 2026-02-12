<script>
  import { onMount } from 'svelte';

  export let systemStatus = null;

  let stats = {
    totalPilots: 0,
    totalProposals: 0,
    totalChannels: 0,
    testPassRate: 100,
  };

  let agents = [];
  let loading = true;

  onMount(async () => {
    try {
      // Fetch pilot stats
      const pilotsRes = await fetch('http://localhost:3000/pilots/stats');
      const pilotsData = await pilotsRes.json();
      stats.totalPilots = pilotsData.total || 0;

      // Fetch proposals
      const propsRes = await fetch('http://localhost:3000/governance/proposals');
      const propsData = await propsRes.json();
      stats.totalProposals = propsData.length || 0;

      // Fetch channels
      const channelsRes = await fetch('http://localhost:3000/channels');
      const channelsData = await channelsRes.json();
      stats.totalChannels = channelsData.length || 0;

      // Fetch orchestrator status
      const orchestratorRes = await fetch('http://localhost:3000/orchestrator/status');
      const orchestratorData = await orchestratorRes.json();
      agents = Object.values(orchestratorData.agents || {});

      loading = false;
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      loading = false;
    }
  });

  const statCards = [
    {
      title: 'Total Pilots',
      value: stats.totalPilots,
      icon: '✈️',
      color: '#00d9ff',
      description: 'Show ideas submitted',
    },
    {
      title: 'Active Proposals',
      value: stats.totalProposals,
      icon: '🗳️',
      color: '#ff006e',
      description: 'Community votes',
    },
    {
      title: 'Deployed Channels',
      value: stats.totalChannels,
      icon: '🎬',
      color: '#00d926',
      description: '24/7 streams',
    },
    {
      title: 'Test Pass Rate',
      value: `${stats.testPassRate}%`,
      icon: '✅',
      color: '#faad14',
      description: 'All systems',
    },
  ];
</script>

<div class="dashboard">
  <h2>Dashboard</h2>

  <!-- Stats Grid -->
  <div class="stats-grid">
    {#each statCards as card}
      <div class="stat-card" style="--color: {card.color}">
        <div class="card-header">
          <span class="icon">{card.icon}</span>
          <h3>{card.title}</h3>
        </div>
        <div class="card-value">{card.value}</div>
        <p class="card-description">{card.description}</p>
      </div>
    {/each}
  </div>

  <!-- System Status -->
  <div class="system-section">
    <h3>System Status</h3>
    <div class="status-grid">
      {#if systemStatus}
        <div class="status-item">
          <span class="status-label">Voice Pipeline</span>
          <span class="status-value {systemStatus.running ? 'active' : 'inactive'}">
            {systemStatus.running ? '🟢 Running' : '🔴 Stopped'}
          </span>
        </div>

        <div class="status-item">
          <span class="status-label">Queue Size</span>
          <span class="status-value">{systemStatus.queue?.size || 0} callers</span>
        </div>

        <div class="status-item">
          <span class="status-label">Mode</span>
          <span class="status-value">{systemStatus.config?.voiceMode || 'unknown'}</span>
        </div>

        <div class="status-item">
          <span class="status-label">GPU</span>
          <span class="status-value {systemStatus.config?.gpuRemote ? 'active' : 'inactive'}">
            {systemStatus.config?.gpuRemote ? '🟢 Remote' : '🔵 Local'}
          </span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Agents Status -->
  <div class="agents-section">
    <h3>Agent Status</h3>
    {#if agents.length > 0}
      <div class="agents-list">
        {#each agents as agent}
          <div class="agent-card">
            <div class="agent-header">
              <h4>{agent.name}</h4>
              <span class="agent-state {agent.state}">{agent.state}</span>
            </div>
            <p class="agent-role">Role: {agent.role}</p>
          </div>
        {/each}
      </div>
    {:else}
      <p class="no-data">No agents found</p>
    {/if}
  </div>

  <!-- Quick Actions -->
  <div class="quick-actions">
    <h3>Quick Actions</h3>
    <div class="actions-grid">
      <a href="#/pilots" class="action-btn submit">
        <span>✈️</span>
        <span>Submit Pilot</span>
      </a>
      <a href="#/governance" class="action-btn vote">
        <span>🗳️</span>
        <span>Vote Now</span>
      </a>
      <a href="#/channels" class="action-btn channels">
        <span>🎬</span>
        <span>View Channels</span>
      </a>
      <a href="http://localhost:3000/health" class="action-btn health" target="_blank">
        <span>💚</span>
        <span>API Health</span>
      </a>
    </div>
  </div>
</div>

<style>
  .dashboard {
    animation: fadeIn 0.5s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h2 {
    margin: 0 0 32px 0;
    font-size: 32px;
    font-weight: 700;
    color: #fff;
  }

  h3 {
    margin: 32px 0 16px 0;
    font-size: 20px;
    font-weight: 600;
    color: #fff;
    border-bottom: 2px solid rgba(255, 0, 110, 0.3);
    padding-bottom: 12px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 40px;
  }

  .stat-card {
    background: linear-gradient(135deg, rgba(255, 0, 110, 0.05), rgba(0, 217, 255, 0.05));
    border: 1px solid rgba(var(--color), 0.2);
    border-radius: 12px;
    padding: 24px;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .stat-card:hover {
    transform: translateY(-4px);
    border-color: var(--color);
    box-shadow: 0 8px 24px rgba(var(--color), 0.15);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .icon {
    font-size: 24px;
  }

  .card-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #aaa;
    border: none;
    padding: 0;
  }

  .card-value {
    font-size: 36px;
    font-weight: 700;
    color: var(--color);
    margin-bottom: 8px;
  }

  .card-description {
    margin: 0;
    font-size: 12px;
    color: #666;
  }

  .system-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 32px;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
  }

  .status-label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .status-value {
    font-size: 14px;
    color: #fff;
    font-weight: 600;
  }

  .status-value.active {
    color: #00d926;
  }

  .status-value.inactive {
    color: #ff4d4f;
  }

  .agents-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 32px;
  }

  .agents-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .agent-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 16px;
  }

  .agent-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .agent-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    text-transform: capitalize;
  }

  .agent-state {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .agent-state.idle {
    background: rgba(0, 217, 255, 0.2);
    color: #00d9ff;
  }

  .agent-state.working {
    background: rgba(255, 0, 110, 0.2);
    color: #ff006e;
  }

  .agent-state.ready {
    background: rgba(0, 217, 38, 0.2);
    color: #00d926;
  }

  .agent-role {
    margin: 0;
    font-size: 12px;
    color: #888;
  }

  .no-data {
    color: #666;
    text-align: center;
    padding: 20px;
  }

  .quick-actions {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 24px;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    text-decoration: none;
    text-align: center;
    transition: all 0.3s ease;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
  }

  .action-btn:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.1);
  }

  .action-btn span:first-child {
    font-size: 24px;
  }

  .action-btn.submit {
    border-color: rgba(0, 217, 255, 0.3);
  }

  .action-btn.submit:hover {
    background: rgba(0, 217, 255, 0.1);
  }

  .action-btn.vote {
    border-color: rgba(255, 0, 110, 0.3);
  }

  .action-btn.vote:hover {
    background: rgba(255, 0, 110, 0.1);
  }

  .action-btn.channels {
    border-color: rgba(0, 217, 38, 0.3);
  }

  .action-btn.channels:hover {
    background: rgba(0, 217, 38, 0.1);
  }

  .action-btn.health {
    border-color: rgba(250, 173, 20, 0.3);
  }

  .action-btn.health:hover {
    background: rgba(250, 173, 20, 0.1);
  }

  @media (max-width: 768px) {
    h2 {
      font-size: 24px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
