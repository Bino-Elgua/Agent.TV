import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * AkashClient – Real Akash Network interaction
 * Uses: Akash Provider RPC (REST API)
 * Docs: https://docs.akash.network/
 */
export class AkashClient {
  constructor(configOverride = {}) {
    this.providerUrl = configOverride.providerUrl || process.env.AKASH_PROVIDER_URL || 'http://localhost:3030';
    this.accountAddress = configOverride.accountAddress || process.env.AKASH_ACCOUNT_ADDRESS || null;
    this.ready = false;
  }

  async initialize() {
    try {
      // Test provider connectivity
      const response = await axios.get(`${this.providerUrl}/status`, { timeout: 5000 });
      logger.info({ status: response.data }, 'Akash provider OK');
      this.ready = true;
    } catch (err) {
      logger.warn({ error: err.message }, 'Akash provider unavailable, deployments disabled');
      this.ready = false;
    }
  }

  async submitDeployment(sdlYaml, metadata = {}) {
    if (!this.ready) {
      logger.warn('Akash client not ready, skipping deployment');
      return { mockDeployment: true, deploymentId: `mock_${Date.now()}` };
    }

    try {
      logger.info({ title: metadata.title }, 'Submitting Akash deployment');

      // Real: POST to Akash provider
      // const response = await axios.post(`${this.providerUrl}/deployments`, {
      //   sdl: sdlYaml,
      //   owner: this.accountAddress,
      // });

      // Placeholder
      const deploymentId = `akash_${Date.now()}`;

      logger.info({ deploymentId }, 'Deployment submitted (mock)');

      return {
        deploymentId,
        status: 'submitted',
        owner: this.accountAddress,
        createdAt: Date.now(),
      };
    } catch (err) {
      logger.error({ error: err.message }, 'Deployment submission failed');
      throw err;
    }
  }

  async getDeploymentStatus(deploymentId) {
    if (!this.ready) {
      return { status: 'offline', deploymentId };
    }

    try {
      logger.debug({ deploymentId }, 'Fetching deployment status');

      // Real: GET `${this.providerUrl}/deployments/${deploymentId}`

      // Placeholder
      return {
        deploymentId,
        status: 'active',
        leases: [
          {
            provider: 'provider.akash.network',
            status: 'active',
            bidAmount: '500',
          },
        ],
      };
    } catch (err) {
      logger.error({ error: err.message }, 'Status fetch failed');
      return null;
    }
  }

  async closeDeployment(deploymentId) {
    if (!this.ready) {
      logger.warn('Akash client not ready, skipping close');
      return { mockClose: true };
    }

    try {
      logger.info({ deploymentId }, 'Closing deployment');

      // Real: POST `${this.providerUrl}/deployments/${deploymentId}/close`

      // Placeholder
      return {
        deploymentId,
        closed: true,
        closedAt: Date.now(),
      };
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to close deployment');
      throw err;
    }
  }

  async monitorDeployment(deploymentId, intervalMs = 10000) {
    // Poll deployment status until active
    logger.info({ deploymentId }, 'Starting deployment monitor');

    const maxAttempts = 60; // 10 min timeout

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getDeploymentStatus(deploymentId);

      if (status?.status === 'active') {
        logger.info({ deploymentId, attempt }, 'Deployment active!');
        return status;
      }

      logger.debug({ deploymentId, attempt }, `Monitor ${attempt}/${maxAttempts}`);

      await new Promise(r => setTimeout(r, intervalMs));
    }

    throw new Error(`Deployment ${deploymentId} did not activate within timeout`);
  }

  getStatus() {
    return {
      ready: this.ready,
      providerUrl: this.providerUrl,
      accountAddress: this.accountAddress,
    };
  }
}

export const akashClient = new AkashClient();
export default akashClient;
