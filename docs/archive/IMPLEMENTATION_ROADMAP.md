# CryptoCall FM – Implementation Roadmap

**Current Status:** 85% Complete  
**Target:** Production-ready by end of Month 2  

---

## Session 1 (Feb 11, 2026) – Blocker Analysis & Planning ✅

### What Was Done
- ✅ Analyzed all 9 blocking issues
- ✅ Created `COMPREHENSIVE_AUDIT.md` (540 lines – full status report)
- ✅ Created `BLOCKERS_RESOLUTION.md` (450 lines – detailed blocker guides)
- ✅ Created `SETUP_QUICK_START.md` (150 lines – 15-minute setup)
- ✅ Created database schema (`001_init_schema.sql` – 11 tables)
- ✅ Created `DatabaseManager` class (`src/db/index.js` – 300+ lines)
- ✅ Created migration runner (`src/db/migrate.js` – 150 lines)
- ✅ Created `DATABASE_INTEGRATION.md` (guide for wiring DB)
- ✅ Created `BLOCKERS_PROGRESS.md` (session summary)

### Artifacts Created
```
📄 BLOCKERS_RESOLUTION.md (450 lines)
📄 SETUP_QUICK_START.md (150 lines)
📄 DATABASE_INTEGRATION.md (250 lines)
📄 BLOCKERS_PROGRESS.md (300 lines)
📄 IMPLEMENTATION_ROADMAP.md (this file)
📁 src/migrations/001_init_schema.sql (11 tables)
📁 src/db/index.js (DatabaseManager class)
📁 src/db/migrate.js (Migration runner)
```

---

## Month 1 (Weeks 1-4) – API Integration Layer

### Week 1: LLM + Grok API (Effort: 3-5 hours)

**Blocker 1 & 2: LLM Integration + Grok Trends**

```
Priority: 🔴 CRITICAL
Status: 🟢 Code Complete – Waiting for API Keys
```

**Tasks:**
- [ ] Sign up for Groq: https://console.groq.com (5 min)
- [ ] Get free API key (no credit card) (5 min)
- [ ] Add to `.env`:
  ```bash
  GROQ_API_KEY=gsk_...
  LLM_ENDPOINT=groq
  GROK_API_KEY=gsk_...
  ```
- [ ] Test: `npm run test:pilots` (2 min)
- [ ] Verify real responses in logs (5 min)
- [ ] Run full test suite: `npm run test:full` (2 min)

**Expected Result:**
- ✅ LLMProvider calls real Groq API (no mocks)
- ✅ Trends fetched from X (Grok API)
- ✅ Test output shows real agent responses

**Time Estimate:** 20 minutes  
**Difficulty:** ⭐ Very Easy

---

### Week 2: Database Persistence (Effort: 6-8 hours)

**Blocker 3: Database Persistence**

```
Priority: 🔴 CRITICAL
Status: 🟡 40% Complete – Schema Built, Wiring Needed
```

**Tasks:**
- [ ] Install PostgreSQL (15 min)
  ```bash
  apt-get install postgresql postgresql-contrib
  pg_ctlcluster 14 main start
  ```
- [ ] Create database (5 min)
  ```bash
  createdb cryptocall_fm
  ```
- [ ] Update `.env` (2 min)
  ```bash
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cryptocall_fm
  ```
- [ ] Run migrations (5 min)
  ```bash
  node src/db/migrate.js
  ```
- [ ] Verify schema (5 min)
  ```bash
  psql cryptocall_fm -c "\dt"
  ```
- [ ] Wire voting system (2 hours)
  - Modify `src/governance/voting.js`
  - Replace in-memory Map with `database.recordVote()`
  - Update `getAllProposals()` to use `database.getAllProposals()`
- [ ] Wire submissions (1 hour)
  - Modify `src/frontend-api/pilot-submission.js`
  - Use `database.createSubmission()`
- [ ] Wire channels (1 hour)
  - Modify `src/frontend-api/channels.js`
  - Use `database.createChannel()`, `getAllChannels()`
- [ ] Test persistence (30 min)
  - Run `npm run test:full`
  - Restart server
  - Verify data persisted
- [ ] Add logging integration (30 min)
  - Wire `database.logActivity()` to important events

**Expected Result:**
- ✅ All state persisted to PostgreSQL
- ✅ Data survives server restart
- ✅ Tests pass with real database backend
- ✅ Audit log tracks all proposals/votes

**Time Estimate:** 6-8 hours  
**Difficulty:** ⭐⭐⭐ Medium

---

### Week 3: Avatar Video Generation (Effort: 3-4 hours)

**Blocker 5: Avatar Video Generation**

```
Priority: 🟠 HIGH
Status: 🔴 Not Started – Code Ready, API Integration Needed
```

**Tasks:**
- [ ] Sign up for HeyGen: https://heygen.com (5 min)
- [ ] Create avatar in UI (15 min)
- [ ] Get API key (2 min)
- [ ] Update `.env` (2 min)
  ```bash
  HEYGEN_API_KEY=sk_...
  AVATAR_ID=your_avatar_id
  ```
- [ ] Implement HeyGen call in `video-gen.js` (1-2 hours)
  - Uncomment `_generateHeyGen()` method
  - Fix API endpoint (currently placeholder)
  - Test with sample prompt
- [ ] Test end-to-end (1 hour)
  - Run `npm run test:pilots`
  - Check for real HeyGen video URLs in response
- [ ] Handle errors gracefully (30 min)
  - Still falls back to placeholder if API fails

**Expected Result:**
- ✅ Real avatar videos generated
- ✅ Videos hosted on HeyGen infrastructure
- ✅ Fallback to placeholder on failure

**Cost:** ~$20-50/month depending on volume  
**Time Estimate:** 3-4 hours  
**Difficulty:** ⭐⭐ Easy

---

### Week 4: Infrastructure Setup (Effort: 4-6 hours)

**Blocker 6 & 7: Akash + Theta**

```
Priority: 🟠 HIGH
Status: 🔴 Not Started – Code Ready, Infrastructure Setup Needed
```

**Akash Setup (2-3 hours):**
- [ ] Install Akash CLI (15 min)
- [ ] Create testnet account (15 min)
  ```bash
  akash keys add mykey
  ```
- [ ] Get tokens from faucet (15 min)
- [ ] Update `.env` (5 min)
  ```bash
  AKASH_PROVIDER_URL=https://node.testnet.akashdev.net:80/
  AKASH_KEY_NAME=mykey
  AKASH_ACCOUNT_ADDRESS=akash1...
  ```
- [ ] Implement real RPC submission (1.5 hours)
  - Modify `akash-deploy.js`
  - Wire real transaction submission
- [ ] Test deployment (30 min)

**Theta Setup (2-3 hours):**
- [ ] Create EdgeCloud account (15 min)
- [ ] Get API key (5 min)
- [ ] Get testnet TFUEL from faucet (15 min)
- [ ] Update `.env` (5 min)
  ```bash
  THETA_API_KEY=key_...
  THETA_WALLET_ADDRESS=...
  ```
- [ ] Implement real video upload (1.5 hours)
  - Modify `theta-streamer.js`
  - Wire real upload endpoints
- [ ] Test streaming (30 min)

**Expected Result:**
- ✅ Deployments created on Akash testnet
- ✅ Videos streamed via Theta EdgeCloud
- ✅ Can verify on block explorers

**Cost:** Testnet only (free, but need initial tokens)  
**Time Estimate:** 4-6 hours  
**Difficulty:** ⭐⭐⭐ Medium

---

## Month 2 (Weeks 5-8) – On-Chain + Frontend

### Week 5: Solana Governance Program (Effort: 20-40 hours)

**Blocker 4: Solana On-Chain Governance**

```
Priority: 🔴 CRITICAL
Status: 🔴 Not Started – Integration Ready, Program Needs Development
```

**Tasks:**
- [ ] Learn Anchor framework (if new to it) (8-16 hours)
  - Read: https://www.anchor-lang.com/docs/installation
  - Do: Tutorial programs (Counter, etc.)
- [ ] Create Solana program (6-8 hours)
  ```bash
  anchor init programs/agent-tv-voting
  ```
  - Implement `CreateProposal` instruction
  - Implement `CastVote` instruction
  - Implement `ExecuteProposal` instruction
  - Add PDA for proposal storage
- [ ] Test program locally (2-3 hours)
  - Unit tests
  - Integration tests
- [ ] Deploy to devnet (2-3 hours)
  ```bash
  anchor deploy --provider.cluster devnet
  ```
- [ ] Wire real calls in `solana-integration.js` (4-6 hours)
  - Implement `createProposal()` with real transaction
  - Implement `submitVote()` with real vote submission
  - Implement `getProposalState()` with PDA lookup
- [ ] Test end-to-end (2-3 hours)
  - Create on-chain proposal
  - Cast votes
  - Execute proposal
  - Verify on Solscan

**Expected Result:**
- ✅ Custom Solana program deployed to devnet
- ✅ Governance fully on-chain (no local fallback)
- ✅ Proposals + votes immutable
- ✅ Token-weighted voting enforced at protocol level

**Cost:** Free (devnet only)  
**Time Estimate:** 20-40 hours (depends on Anchor familiarity)  
**Difficulty:** ⭐⭐⭐⭐ Hard (requires Rust/blockchain knowledge)

**Alternative (Faster):**
- Use existing governance program (if available)
- Skip devnet, use mainnet governance program
- Effort: 4-6 hours instead

---

### Weeks 6-7: Voice Pipeline + Frontend (Effort: 30-50 hours)

**Blocker 8 & 9: Pipecat Voice + Frontend UI**

```
Priority: 🟠 HIGH
Status: 🔴 Not Started – Framework Ready, Services + UI Needed
```

**Pipecat Voice Pipeline (4-6 days):**
- [ ] Get RunPod account (15 min)
- [ ] Deploy Pipecat container (1-2 hours)
- [ ] Get endpoint URL (5 min)
- [ ] Update `.env` (2 min)
  ```bash
  VOICE_GPU_REMOTE=true
  VOICE_GPU_ENDPOINT=https://api-xxx.runpod.io/run
  ```
- [ ] Implement real TTS/STT in `voice-pipeline.js` (2-3 hours)
- [ ] Test with Twilio calls (2-3 hours)

**Frontend UI (5-7 days):**
- [ ] Setup Svelte 4 + Vite (30 min)
  ```bash
  npm create vite@latest web -- --template svelte
  ```
- [ ] Create pages (5-6 days)
  - `/submit` – Pilot submission form
  - `/governance` – Voting dashboard
  - `/channels` – Channel browser
  - `/status` – Live status viewer
  - `/episodes` – Episode library
- [ ] Wire API connections (1-2 days)
- [ ] Add real-time updates (WebSocket) (1-2 days)
- [ ] Deploy alongside API (4-6 hours)

**Expected Result:**
- ✅ Real voice pipeline end-to-end
- ✅ Modern web UI for submissions + voting
- ✅ Real-time status updates
- ✅ Production-ready platform

**Cost:** RunPod ~$0.40/hour GPU time  
**Time Estimate:** 30-50 hours  
**Difficulty:** ⭐⭐⭐⭐ Hard (full-stack work)

---

### Week 8: Testing + Deployment (Effort: 10-15 hours)

**Integration Testing & Production Deployment**

**Tasks:**
- [ ] Full end-to-end testing (4-6 hours)
  - All 4 phases working
  - Database persistence
  - Real LLM/video/voice
  - Solana program
  - Akash deployments
  - Theta streaming
  - Frontend UI
- [ ] Load testing (2-3 hours)
  - Concurrent pilots
  - Concurrent votes
  - Queue stress
- [ ] Security audit (2-3 hours)
  - No hardcoded secrets
  - API rate limiting
  - Input validation
  - Authorization checks
- [ ] Documentation (1-2 hours)
  - Deployment guide
  - API reference
  - User guide
- [ ] Deploy to production (2-4 hours)
  - Configure managed PostgreSQL
  - Deploy API
  - Deploy frontend
  - Setup monitoring

**Expected Result:**
- ✅ Production-ready system
- ✅ All tests passing
- ✅ Live and accessible
- ✅ Fully documented

---

## Summary Timeline

```
MONTH 1 (Weeks 1-4):
├── Week 1: LLM + Grok API (20 min) ✅ EASY
├── Week 2: Database Persistence (6-8 hours) ⭐⭐⭐ MEDIUM
├── Week 3: Avatar Video Gen (3-4 hours) ⭐⭐ EASY
└── Week 4: Akash + Theta Setup (4-6 hours) ⭐⭐⭐ MEDIUM

MONTH 2 (Weeks 5-8):
├── Week 5: Solana Program (20-40 hours) ⭐⭐⭐⭐ HARD
├── Weeks 6-7: Voice + Frontend (30-50 hours) ⭐⭐⭐⭐ HARD
└── Week 8: Testing + Deploy (10-15 hours) ⭐⭐⭐ MEDIUM

TOTAL EFFORT: ~100-150 hours
ELAPSED TIME: 8 weeks (2 months)
DIFFICULTY: Mixed (easy → hard → medium)
```

---

## Success Criteria

✅ **Production Ready When:**
1. ✅ LLM integration working (real Groq API)
2. ✅ Database persisting all state
3. ✅ Avatar videos generated
4. ✅ Akash deployments created
5. ✅ Theta streaming enabled
6. ✅ Solana governance on-chain
7. ✅ Voice pipeline end-to-end
8. ✅ Frontend UI deployed
9. ✅ All tests passing
10. ✅ Monitoring + alerting setup
11. ✅ Documentation complete

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Solana program complex | Alternative: Use existing program or mainnet governance |
| Frontend UI large scope | Start with minimal MVP (just voting) |
| GPU infrastructure costs | Start with local LLM, migrate to RunPod if needed |
| Database scaling issues | Use managed PostgreSQL (Railway, Heroku, AWS RDS) |
| API rate limits | Implement caching + rate limiting middleware |

---

## Next Immediate Steps (DO THIS NOW)

1. **Get Groq API Key:** https://console.groq.com (5 minutes)
2. **Update .env with key** (2 minutes)
3. **Run test:** `npm run test:pilots` (2 minutes)
4. **Verify real responses** in logs (5 minutes)

**Total time to get working system:** ~15 minutes

---

## Checkpoint Schedule

- [ ] **Week 1 EOD:** LLM + Grok working ✅
- [ ] **Week 2 EOD:** Database integrated ✅
- [ ] **Week 3 EOD:** HeyGen videos working ✅
- [ ] **Week 4 EOD:** Akash + Theta deployed ✅
- [ ] **Week 5 EOD:** Solana program live ✅
- [ ] **Week 6 EOD:** Voice pipeline working ✅
- [ ] **Week 7 EOD:** Frontend UI deployed ✅
- [ ] **Week 8 EOD:** Production ready ✅

---

## Questions / Issues?

Refer to:
- `BLOCKERS_RESOLUTION.md` – Details on each blocker
- `SETUP_QUICK_START.md` – Get started immediately
- `DATABASE_INTEGRATION.md` – Database wiring guide
- `COMPREHENSIVE_AUDIT.md` – Full status + code structure
- `START_HERE.md` – Architecture overview

