# CryptoCall FM – Blockers Resolution Plan

**Status:** In Progress  
**Last Updated:** Feb 11, 2026  
**Priority:** Complete integration blockers to reach production-ready state

---

## Blocker Priority Order

### ✅ BLOCKER 1: LLM Integration (EASIEST – START HERE)
**Status:** 🟡 Partially Complete  
**Effort:** 1-2 hours  

**What's Stubbed:**
- `LLMProvider` supports Groq, OpenAI, Claude, local LLMs
- Falls back to mock responses if API key missing
- Used by ResearcherAgent and ScriptorAgent

**To Complete:**
1. Get free API key from [Groq Console](https://console.groq.com)
   - Free tier: 30 requests/minute, unlimited monthly
   - No credit card required
2. Add to `.env`:
   ```bash
   GROQ_API_KEY=your_key_here
   LLM_ENDPOINT=groq
   LLM_MODEL=mixtral-8x7b-32768
   ```
3. Test: `npm run test:pilots`
4. Verify: Look for "Groq API success" in logs

**Alternative:** OpenAI ($20 free credits)
```bash
OPENAI_API_KEY=sk-...
LLM_ENDPOINT=openai
LLM_MODEL=gpt-4o-mini
```

**Time to Deploy:** 10 minutes

---

### ✅ BLOCKER 2: Grok API (X Trends)
**Status:** 🟡 Partially Complete  
**Effort:** 1 hour  

**What's Stubbed:**
- `x-fetcher.js` calls Grok API to get trending topics
- Falls back to mock trends if API key missing
- Used by ResearcherAgent

**To Complete:**
1. Get X API key from [x.ai/api](https://x.ai/api)
   - Free tier available (check current limits)
   - Same as LLM_API_KEY (usually)
2. Update `.env`:
   ```bash
   GROK_API_KEY=your_key_here
   GROK_POLL_INTERVAL=45000  # 45 seconds
   ```
3. Test: `npm run fetch-x`
4. Verify: Should fetch real X trends instead of mocks

**Time to Deploy:** 15 minutes

---

### ✅ BLOCKER 3: Database Persistence
**Status:** 🔴 Not Started  
**Effort:** 4-6 hours  
**Dependencies:** Requires PostgreSQL

**What's Stubbed:**
- All state stored in-memory (RAM)
- Proposals, votes, submissions lost on restart
- No persistence layer

**To Complete:**
1. Install PostgreSQL (if not already installed)
   ```bash
   apt-get install postgresql postgresql-contrib
   pg_ctl -D /usr/local/var/postgres start
   ```

2. Create database:
   ```bash
   createdb cryptocall_fm
   ```

3. Add migration scripts to `src/migrations/`:
   - `001_create_proposals.sql` – voting proposals
   - `002_create_votes.sql` – vote records
   - `003_create_submissions.sql` – pilot submissions
   - `004_create_channels.sql` – deployed channels

4. Update config with PostgreSQL connection:
   ```bash
   DATABASE_URL=postgresql://user:password@localhost:5432/cryptocall_fm
   ```

5. Implement `src/db/index.js`:
   - `createProposal(data)` – insert proposal
   - `getProposal(id)` – fetch proposal
   - `recordVote(proposalId, voter, choice, weight)`
   - `createSubmission(data)`
   - `getChannels()`

6. Replace in-memory stores with DB queries:
   - `voting.js` → database-backed
   - `pilot-submission.js` → database-backed
   - `channels.js` → database-backed

**Test:** `npm run test:full` (should persist across runs)

**Time to Deploy:** 4-6 hours

---

### ✅ BLOCKER 4: Solana On-Chain Governance
**Status:** 🔴 Not Started  
**Effort:** 5-7 days  
**Dependencies:** Rust knowledge, Anchor framework

**What's Stubbed:**
- `solana-integration.js` – all methods return mock data
- No on-chain proposals or voting
- Token balance checking works (real)

**To Complete:**
1. **Develop Solana Program** (Rust + Anchor):
   - Create `programs/agent-tv-voting/` directory
   - Implement instructions:
     - `CreateProposal { title, description, creator }`
     - `CastVote { proposal_id, choice, weight }`
     - `ExecuteProposal { proposal_id }`
   - Use PDA (Program Derived Address) for proposal storage

2. **Deploy to devnet**:
   ```bash
   anchor build
   anchor deploy --provider.cluster devnet
   ```

3. **Update config with program ID**:
   ```bash
   SOLANA_PROGRAM_ID=your_program_id_here
   SOLANA_RPC=https://api.devnet.solana.com
   TOKEN_MINT_ADDRESS=your_token_mint
   ```

4. **Wire up real on-chain calls**:
   - Implement `createProposal()` with real transaction
   - Implement `submitVote()` with real transaction
   - Implement `getProposalState()` with account lookup

5. **Test**:
   - `npm run test:full` (should create on-chain proposals)
   - Verify on [Solscan devnet](https://devnet.solscan.io)

**References:**
- [Anchor Book](https://www.anchor-lang.com/)
- [AgentTV IDL](./programs/agent-tv-voting/target/idl/agent_tv_voting.json)

**Time to Deploy:** 5-7 days (requires Solana/Rust expertise)

---

### ✅ BLOCKER 5: Avatar Video Generation
**Status:** 🔴 Not Started  
**Effort:** 3-4 hours  
**Dependencies:** HeyGen or Synthesia API key

**What's Stubbed:**
- `video-gen.js` – returns placeholder videos
- No real avatar synthesis
- Falls back to mock on API failure

**To Complete – Option A: HeyGen (Recommended)**
1. Sign up at [HeyGen](https://heygen.com)
2. Get API key from dashboard
3. Add to `.env`:
   ```bash
   HEYGEN_API_KEY=your_key_here
   VIDEO_GENERATION_PROVIDER=heygen
   AVATAR_ID=your_avatar_id  # Create avatar in HeyGen UI
   ```

4. Update `video-gen.js` – `_generateHeyGen()`:
   ```javascript
   const response = await axios.post(
     'https://api.heygen.com/v1/video_requests.submit',
     {
       avatar_id: process.env.AVATAR_ID,
       voice: { type: 'text', input: scriptSegment },
       aspect_ratio: '16:9',
     },
     {
       headers: { 'X-APIKEY': process.env.HEYGEN_API_KEY }
     }
   );
   ```

5. Test: `npm run test:pilots` (should generate real videos)

**Alternative – Option B: Synthesia**
1. Sign up at [Synthesia](https://www.synthesia.io)
2. Use their API for avatar video generation
3. Similar setup to HeyGen

**Time to Deploy:** 2-3 hours

---

### ✅ BLOCKER 6: Akash Network Deployment
**Status:** 🔴 Not Started  
**Effort:** 2-3 hours  
**Dependencies:** Akash testnet account, AKT tokens

**What's Stubbed:**
- `akash-deploy.js` – generates SDL manifests
- No real RPC submission
- Returns mock deployment IDs

**To Complete:**
1. Create Akash testnet account:
   - Install [Akash CLI](https://docs.akash.network/getting-started/installation)
   - Create keypair: `akash keys add mykey`
   - Get testnet tokens from [faucet](https://faucet.devnet.akashdev.net/)

2. Update config:
   ```bash
   AKASH_PROVIDER_URL=https://node.testnet.akashdev.net:80/
   AKASH_KEY_NAME=mykey
   AKASH_ACCOUNT_ADDRESS=akash1xxx...
   ```

3. Implement real SDL submission in `akash-deploy.js`:
   ```javascript
   const deploymentTx = await akashClient.sendAndBroadcast(
     signingClient,
     deployMsg,
     fees,
     memo
   );
   ```

4. Test: `npm run test:deploy` (should create real deployments on testnet)

5. Verify: `akash query deployment list --owner <your_address>`

**Time to Deploy:** 2-3 hours

---

### ✅ BLOCKER 7: Theta EdgeCloud Streaming
**Status:** 🔴 Not Started  
**Effort:** 2-3 hours  
**Dependencies:** Theta testnet account, TFUEL tokens

**What's Stubbed:**
- `theta-streamer.js` – generates streaming URLs
- No real video uploads
- Returns mock stream IDs

**To Complete:**
1. Create Theta Edge Cloud account:
   - Sign up at [EdgeCloud](https://edgecloud.ai)
   - Create API key
   - Get testnet TFUEL from [faucet](https://testnet-faucet.thetatoken.org/)

2. Update config:
   ```bash
   THETA_API_KEY=your_key_here
   THETA_WALLET_ADDRESS=your_wallet
   THETA_TESTNET=true
   ```

3. Implement real video upload in `theta-streamer.js`:
   ```javascript
   const uploadResponse = await axios.post(
     'https://api.edgecloud.ai/api/v1/uploads',
     formData,
     {
       headers: { 'X-API-KEY': process.env.THETA_API_KEY }
     }
   );
   ```

4. Test: `npm run test:deploy` (should upload real videos to Theta)

5. Verify on [Theta Explorer](https://testnet-explorer.thetatoken.org/)

**Time to Deploy:** 2-3 hours

---

### ✅ BLOCKER 8: Pipecat Voice Pipeline
**Status:** 🔴 Not Started  
**Effort:** 3-5 days  
**Dependencies:** RunPod GPU endpoint, Pipecat SDK

**What's Stubbed:**
- `voice-pipeline.js` – TTS/STT framework present, no real services
- `twilio-handler.js` – call routing works, voice synthesis stubbed
- Requires local GPU or remote GPU endpoint

**To Complete:**
1. **Option A: Remote RunPod GPU (Recommended)**
   - Sign up at [RunPod](https://www.runpod.io)
   - Deploy Pipecat container
   - Get endpoint URL
   - Add to `.env`:
     ```bash
     VOICE_GPU_REMOTE=true
     VOICE_GPU_ENDPOINT=https://api-xxx.runpod.io/run
     ```

2. **Option B: Local GPU (llama.cpp or vLLM)**
   - Install vLLM: `pip install vllm`
   - Start server:
     ```bash
     python -m vllm.entrypoints.openai.api_server --model mistral --port 8000
     ```
   - Add to `.env`:
     ```bash
     VOICE_GPU_REMOTE=false
     VOICE_GPU_ENDPOINT=http://localhost:8000
     ```

3. **Wire up Pipecat calls** in `voice-pipeline.js`:
   - Implement real TTS (text-to-speech) via RunPod
   - Implement real STT (speech-to-text) via faster-whisper
   - Replace mock segment generation

4. **Test**: `npm start` (should handle real Twilio calls with voice)

**Time to Deploy:** 3-5 days (requires GPU infrastructure)

---

### ✅ BLOCKER 9: Frontend UI
**Status:** 🔴 Not Started  
**Effort:** 5-7 days  
**Technologies:** Svelte 4 + Vite (per project style guide)

**What's Needed:**
- Pilot submission form
- Live voting dashboard
- Channel browser
- Queue status viewer
- Governance proposal details

**To Complete:**
1. Create `web/` directory (separate SvelteKit app)
2. Implement pages:
   - `/submit` – pilot submission form
   - `/governance` – voting dashboard
   - `/channels` – channel browser
   - `/status` – live queue/deployment status
3. Connect to API endpoints:
   - `POST /pilots/submit`
   - `GET /governance/proposals`
   - `GET /channels`
   - `GET /orchestrator/status`
4. Add real-time updates (WebSocket)
5. Deploy alongside API

**Time to Deploy:** 5-7 days

---

## Quick Deploy Checklist

### Immediate (< 2 hours)
- [ ] Add Groq API key → test LLM
- [ ] Add GROK_API_KEY → test trends
- [ ] Run `npm run test:pilots` (should work with real LLM)

### Short-term (2-8 hours)
- [ ] Setup PostgreSQL & migrations → database persistence
- [ ] Add HeyGen API key → video generation
- [ ] Setup Akash testnet account → deployment
- [ ] Setup Theta testnet account → streaming

### Medium-term (1-2 weeks)
- [ ] Deploy Solana governance program
- [ ] Setup Pipecat GPU endpoint (RunPod)
- [ ] Build basic frontend UI

---

## Current Dependencies Status

```
✅ express – API working
✅ axios – HTTP working
✅ @solana/web3.js – RPC working
✅ twilio – call routing working
❌ pipecat – voice pipeline (not installed)
❌ @heygen/sdk – video generation (not installed)
❌ @theta-labs/edgecloud-sdk – streaming (not installed)
❌ @akashnetwork/akashjs – deployment (not installed)
❌ pg – database persistence (not installed)
```

---

## Recommended Deploy Path

1. **Week 1:** Get LLM + video generation working (mock → real)
2. **Week 2:** Add database persistence + Solana program
3. **Week 3:** Wire up Akash + Theta + Pipecat
4. **Week 4:** Build frontend UI + go live

---

## Support & References

- **Groq API:** https://console.groq.com
- **HeyGen:** https://developers.heygen.com
- **Solana Docs:** https://docs.solana.com
- **Akash Docs:** https://docs.akash.network
- **Theta Docs:** https://docs.thetatoken.org

