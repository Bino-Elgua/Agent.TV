# AgentTV Network Setup Guide

**Convert CryptoCall FM into the core of a decentralized AI entertainment network.**

---

## 📋 Prerequisites

- Node.js 20+
- npm or pnpm
- Existing CryptoCall FM installation
- (Optional for Phase 2+) RunPod GPU (RTX 4090), Akash account, Theta account

---

## 🚀 Phase 1: Install & Configure

### 1. Install New Dependencies

```bash
cd /data/data/com.termux/files/home/cryptocall-fm
npm install  # Includes new agents, deployment, governance packages
```

### 2. Update .env

```bash
cp .env.example .env
# Add new vars:
```

Add these to `.env`:

```env
# Phase 1 (existing)
GROK_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Phase 2-4 (new)
# LiveKit (video)
LIVEKIT_URL=ws://localhost:7880  # For local testing; use cloud endpoint in prod
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret

# Avatar Generation (HeyGen)
HEYGEN_API_KEY=...  # Sign up at heygen.com
HEYGEN_AVATAR_ID=default_avatar  # Or custom avatar ID

# Theta EdgeCloud (video streaming)
THETA_API_KEY=...
THETA_WALLET_ADDRESS=your_theta_address

# Akash Network (compute)
AKASH_PROVIDER_URL=http://localhost:3030  # Or public provider
AKASH_ACCOUNT_ADDRESS=your_akash_address
AKASH_KEY_NAME=deployer

# Governance (Solana/Base)
SOLANA_RPC=https://api.mainnet-beta.solana.com
SOLANA_PROGRAM_ID=your_program_id  # Once deployed
BASE_RPC=https://mainnet.base.org
BASE_PROGRAM_ID=your_contract_address

# Token ($TICKER)
TOKEN_MINT_ADDRESS=your_token_mint
MIN_SUBMISSION_BALANCE=100  # Min tokens to submit pilot
```

### 3. Test Phase 1

```bash
npm test  # Existing dry-run (should still pass)
npm start # Start AgentTV Network
```

Output:
```
🚀 AgentTV Network live
📺 CryptoCall FM: http://localhost:3000/status
📝 Submit pilots: POST http://localhost:3000/pilots/submit
🗳️  Voting: GET http://localhost:3000/governance/proposals
🎬 Channels: GET http://localhost:3000/channels
⚙️  Orchestrator: GET http://localhost:3000/orchestrator/status
```

---

## 🎬 Phase 2: Pilot Submission Flow

### 2A: Test Pilot Submission (No GPU needed)

```bash
npm run test:pilots
```

Expected output:
```
✓ Orchestrator ready
✓ Voting system ready
✓ Channel manager ready
Pilot submitted: DeFi Degens Daily
✓ Agents processing...
✓ Submission statistics
✓ Governance simulation
✓ Channel management
✅ Pilot flow test completed!
```

### 2B: Test via API

```bash
# Submit a pilot
curl -X POST http://localhost:3000/pilots/submit \
  -H "Content-Type: application/json" \
  -H "X-User-Address: alice_web3" \
  -d '{
    "title": "AI News Daily",
    "description": "AI-generated news analysis",
    "creator": "alice_web3",
    "duration": 300,
    "tone": "professional",
    "tags": ["news", "ai"],
    "avatarStyle": "anchor",
    "trendScope": "tech"
  }'

# Response:
# {
#   "status": "submitted",
#   "submission": {
#     "id": "sub_1739184234",
#     "title": "AI News Daily",
#     "status": "queued",
#     ...
#   }
# }
```

Check status:
```bash
curl http://localhost:3000/pilots/status/sub_1739184234
curl http://localhost:3000/pilots/my \
  -H "X-User-Address: alice_web3"
curl http://localhost:3000/pilots/stats
```

---

## 🎥 Phase 2.5: LiveKit Video Integration (Optional)

### Setup LiveKit (Local Testing)

```bash
# Option 1: Docker
docker run -d --name livekit \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 7882:7882/udp \
  livekit/livekit-server:latest

# Option 2: Cloud
# Sign up at livekit.io, get API URL + keys
```

### Configure .env

```env
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=<from-setup>
LIVEKIT_API_SECRET=<from-setup>
```

### Update voice-pipeline.js (Future)

```javascript
// src/voice/voice-pipeline.js
import { LivekitConnectivity } from '@livekit-labs/livekit-agents';

async initVideoSupport() {
  // Connect to LiveKit
  // Start avatar composite
  // Stream to Theta
}
```

---

## 🎙️ Phase 3: Governance & Voting

### 3A: Test Voting Flow

```bash
curl http://localhost:3000/governance/proposals
```

### 3B: Setup Solana Program (Future)

```bash
# Generate and deploy Solana program
# src/contracts/voting.so

solana program deploy src/contracts/voting.so \
  --keypair ~/.config/solana/id.json \
  -u mainnet-beta

# Update SOLANA_PROGRAM_ID in .env
```

### 3C: Vote via API

```bash
curl -X POST http://localhost:3000/governance/vote \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "prop_1234",
    "voter": "alice_web3",
    "voterTokenBalance": 500,
    "voteChoice": "yes"
  }'
```

---

## 🚀 Phase 4: Akash Deployment

### 4A: Setup Akash Account

```bash
# Install Akash CLI
wget https://github.com/akashnetwork/akash/releases/download/v0.32.1/akash_v0.32.1_linux_amd64.zip
unzip akash_*.zip
sudo mv akash /usr/local/bin/

# Create wallet
akash keys add my-key

# Fund wallet (from faucet or transfer)
akash query bank balances $(akash keys show my-key -a)
```

### 4B: Test Akash Deployment

```bash
npm run test:deploy
```

Expected output:
```
Akash deployment: submitted
Theta streaming: Active
EdgeNode relayers: 3
Estimated cost: 30 AKT/month
✅ Deployment dry-run completed!
```

### 4C: Deploy Pilot (Production)

Once voting passes:
1. System calls `akashDeployer.deployPilot(pilotMetadata, videoUrl)`
2. SDL manifest generated
3. Submitted to Akash provider
4. Deployment assigned to provider
5. Channel goes live + Theta stream started
6. Leaderboard updated

---

## 🛡️ Phase 5: Security & Token Gating

### Implement Token Balance Check

```javascript
// src/frontend-api/pilot-submission.js
async _checkTokenBalance(userAddress) {
  // Real: Query on-chain token balance
  // import { Connection, PublicKey } from '@solana/web3.js';
  // const balance = await connection.getTokenAccountBalance(
  //   new PublicKey(tokenAccount)
  // );
  // return balance.value.uiAmount >= this.minTokenBalance;

  // Placeholder: Implement real check
  return true;
}
```

### Rate Limiting (Express Middleware)

```javascript
// src/utils/rate-limiter.js
import rateLimit from 'express-rate-limit';

export const pilotSubmitLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24h
  max: 5, // Max 5 submissions per user per day
  keyGenerator: (req) => req.headers['x-user-address'],
  message: 'Too many pilot submissions. Try again tomorrow.',
});

// In index.js:
// app.post('/pilots/submit', pilotSubmitLimiter, async (req, res) => { ... })
```

---

## 📊 Testing Checklist

- [ ] `npm test` – Original CryptoCall FM tests pass
- [ ] `npm run test:pilots` – Pilot workflow completes
- [ ] `npm run test:deploy` – Akash/Theta integration works
- [ ] API endpoints respond (pilots, governance, channels)
- [ ] Orchestrator initializes all 4 agents
- [ ] Voting system creates proposals
- [ ] Channel manager tracks deployments

---

## 🔗 Integration Points

### To Enable Phase 2 (Live now in scaffolding):
1. Implement token balance check
2. Wire LLM endpoint for agent processing
3. Test orchestrator workflow end-to-end

### To Enable Phase 3 (Voting):
1. Deploy Solana/Base program
2. Wire on-chain vote events
3. Implement deployment trigger

### To Enable Phase 4 (Live streaming):
1. Setup Akash provider account
2. Deploy Theta uploader
3. Wire LiveKit for video compositing

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| `orchestrator.initialize() fails` | Check all agent imports in `orchestrator.js` |
| `Token balance check hangs` | Implement mock for now (return true) |
| `Akash deployment fails` | Akash provider URL unreachable – use local/testnet |
| `Theta upload times out` | API key invalid or network issue – test with curl |
| `Pilot status stuck in "processing"` | Agents not completing – check LLM endpoint |

---

## 📚 Documentation

- **AGENTTV_ROADMAP.md** – Phase overview + architecture
- **README.md** – Original CryptoCall FM guide (still valid Phase 1)
- **src/agents/orchestrator.js** – Agent workflow docs
- **src/deployment/** – Akash/Theta integration examples

---

## 🎯 Success Criteria

**Phase 1 (Now):**
- ✓ CryptoCall FM runs with new API structure
- ✓ 0 crashes on startup

**Phase 2 (1-2 weeks):**
- [ ] Submit pilot via API
- [ ] Agents process end-to-end
- [ ] Video generated + Theta upload works

**Phase 3 (1-2 weeks):**
- [ ] Proposal created on-chain
- [ ] 3+ votes cast via API
- [ ] Proposal passes (test event)

**Phase 4 (1-2 weeks):**
- [ ] Akash deployment auto-triggered
- [ ] Channel shows as "live"
- [ ] Viewers can access stream URL

---

## 🚀 Next Steps

1. **Now:** Run `npm start`, verify all endpoints respond
2. **Week 1:** Implement token balance check + test pilots
3. **Week 2:** Deploy Solana program + wire voting
4. **Week 3:** Setup Akash + test deployment
5. **Week 4:** Launch beta (1-2 pilot channels live)

---

**Status:** 🟢 Phase 1-2 Built | Phase 3-4 Scaffolded  
**Timeline:** 4-6 weeks to fully live

Good luck building AgentTV! 🎬
