# CryptoCall FM – Quick Start Setup (15 minutes)

Get the project running with real LLM in ~15 minutes.

---

## Prerequisites

- Node.js 20+ installed
- npm/pnpm installed
- Internet connection

---

## Step 1: Clone & Install (2 minutes)

```bash
cd /data/data/com.termux/files/home/cryptocall-fm
npm install
```

---

## Step 2: Get Free LLM API Key (5 minutes)

### Option A: Groq (Recommended – Fastest Free Tier)

1. Go to https://console.groq.com
2. Sign up (no credit card needed)
3. Click "API Keys" → "Create API Key"
4. Copy the key

### Option B: OpenAI (Also Free)

1. Go to https://platform.openai.com/account/api-keys
2. Sign up
3. Create API key
4. Copy the key (includes $5 free credits)

---

## Step 3: Create .env File (2 minutes)

Create `/data/data/com.termux/files/home/cryptocall-fm/.env`:

```bash
# Twilio (Required but mocked for testing)
TWILIO_ACCOUNT_SID=test
TWILIO_AUTH_TOKEN=test
TWILIO_PHONE_NUMBER=+1234567890

# LLM - Pick ONE:

# GROQ (Recommended)
GROQ_API_KEY=your_groq_key_here
LLM_ENDPOINT=groq
LLM_MODEL=mixtral-8x7b-32768

# OR OpenAI
# OPENAI_API_KEY=sk-xxx...
# LLM_ENDPOINT=openai
# LLM_MODEL=gpt-4o-mini

# Grok/X trends (usually same as LLM key)
GROK_API_KEY=your_groq_key_here

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Testing
DRY_RUN=false
MOCK_TWILIO=true
```

---

## Step 4: Test LLM Integration (3 minutes)

```bash
npm run test:pilots
```

**Expected output:**
```
✓ Orchestrator initialized (4 agents)
✓ Voting system initialized
✓ Pilot submitted: DeFi Degens Daily
✓ Workflow executed (XXXms total)
  - Research: ✓ (X talking points)
  - Script: ✓ (X-min script)
  - VideoGen: ✓ (placeholder video)
  - Streamer: ✓ (streaming URL generated)
```

---

## Step 5: Start the Server (1 minute)

```bash
npm start
```

**Expected output:**
```
🚀 AgentTV Network live (port 3000)
📺 CryptoCall FM: http://localhost:3000/status
📝 Submit pilots: POST http://localhost:3000/pilots/submit
🗳️  Voting: GET http://localhost:3000/governance/proposals
🎬 Channels: GET http://localhost:3000/channels
⚙️  Orchestrator: GET http://localhost:3000/orchestrator/status
```

---

## Step 6: Test Endpoints (2 minutes)

Open a new terminal:

### Get Status
```bash
curl http://localhost:3000/status
```

### Submit a Pilot
```bash
curl -X POST http://localhost:3000/pilots/submit \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Solana Summer Camps",
    "description": "Deep dive into SOL ecosystem",
    "creator": "user123"
  }'
```

### Get Proposals
```bash
curl http://localhost:3000/governance/proposals
```

### Get Channels
```bash
curl http://localhost:3000/channels
```

---

## All Tests (Optional)

```bash
npm test                  # Phase 1 utilities
npm run test:pilots      # Phase 2 multi-agent workflow
npm run test:full        # All 4 phases
npm run test:deploy      # Deployment simulation
npm run test:oracle      # Wallet oracle
```

---

## Next Steps

Once this works, tackle blockers in this order:

1. ✅ **LLM Integration** (done – you're here)
2. **Database Persistence** – Add PostgreSQL
3. **Avatar Video** – HeyGen API key ($$ but worth it)
4. **Akash Testnet** – Real deployment infrastructure
5. **Solana Program** – On-chain governance
6. **Pipecat GPU** – Real voice pipeline
7. **Frontend UI** – Dashboard

See `BLOCKERS_RESOLUTION.md` for detailed guides on each.

---

## Troubleshooting

### "GROQ_API_KEY not set"
- Check your `.env` file exists in project root
- Verify the key is pasted correctly (no extra spaces)
- Restart the server

### "Module not found"
- Run `npm install` again
- Check node version: `node -v` (needs 20+)

### API returns 404
- Check internet connection
- Try different endpoint:
  ```bash
  LLM_ENDPOINT=openai
  OPENAI_API_KEY=sk-...
  ```

### Still failing?
- Run with debug: `LOG_LEVEL=debug npm start`
- Check `/data/data/com.termux/files/home/cryptocall-fm/src/config.js` for required vars

---

## What's Working Now

✅ Pilot submission workflow (research → script → video → deployment)
✅ Multi-agent orchestration (Researcher, Scriptor, VideoGen, Streamer)
✅ Voting system (token-weighted proposals)
✅ Queue management (Twilio call routing)
✅ Deployment manifests (Akash SDL generation)
✅ Wallet oracle (on-chain analysis)
✅ 7 test suites (all passing)

❌ Still stubbed (next phase):
- Real HeyGen/Synthesia video generation
- Real Akash network deployment
- Real Theta EdgeCloud streaming
- Solana on-chain program
- Frontend UI
- Database persistence
- Pipecat voice pipeline

---

## Questions?

See:
- `COMPREHENSIVE_AUDIT.md` – Full status report
- `BLOCKERS_RESOLUTION.md` – Detailed blocker guides
- `START_HERE.md` – Architecture overview

