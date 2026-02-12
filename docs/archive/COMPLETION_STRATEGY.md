# CryptoCall FM - Completion Strategy

**Date:** Feb 11, 2026  
**Objective:** Complete all remaining blockers systematically  
**Status:** Starting implementation  

---

## High-Level Plan

### Phase A: Quick Wins (2-4 hours)
1. ✅ Database setup (PostgreSQL) – optional but recommended
2. ✅ Wire database into voting/submissions
3. ✅ Test end-to-end with real database

### Phase B: LLM Integration (15 minutes - 2 hours)
1. Get Groq API key (free)
2. Add to `.env`
3. Test with `npm run test:pilots`

### Phase C: Avatar Video (2-3 hours - optional for MVP)
1. Get HeyGen API key
2. Wire into `video-gen.js`
3. Test video generation

### Phase D: Infrastructure (4-6 hours)
1. Akash testnet setup
2. Theta EdgeCloud setup
3. Wire deployments

### Phase E: Solana Governance (5-7 days - hardest)
1. Learn Anchor
2. Build voting program
3. Deploy to devnet
4. Wire events

### Phase F: Voice Pipeline (3-5 days - requires GPU)
1. Setup RunPod or local vLLM
2. Wire Pipecat
3. Test real voice

### Phase G: Frontend UI (5-7 days)
1. Build Svelte dashboard
2. Connect to APIs
3. Deploy

---

## Implementation Order

### Session 1 (NOW) – Database + Testing
**Goal:** Get database persistence working  
**Time:** 1-2 hours  
**Blockers:** 3 (Database)

**Steps:**
1. Check if PostgreSQL available on system
2. Create database: `createdb cryptocall_fm`
3. Run migrations: `node src/db/migrate.js`
4. Wire database into:
   - `src/governance/voting.js` (recordVote, getProposalVotes)
   - `src/frontend-api/pilot-submission.js` (createSubmission)
   - `src/frontend-api/channels.js` (getAllChannels)
5. Run tests: `npm run test:pilots`
6. Verify data persists across runs

---

## Blocker Priority Matrix

| Blocker | Priority | Effort | Impact | Status |
|---------|----------|--------|--------|--------|
| 1. LLM (Groq) | CRITICAL | 15min | HIGH | ⏸️ Waiting |
| 2. Grok API (X) | CRITICAL | 5min | HIGH | ⏸️ Waiting |
| 3. Database (PG) | HIGH | 4-6h | MEDIUM | 🟡 Ready |
| 4. Solana Gov | MEDIUM | 5-7d | MEDIUM | 🔴 Blocked |
| 5. Avatar Video | MEDIUM | 2-3h | MEDIUM | 🔴 Blocked |
| 6. Akash Deploy | MEDIUM | 2-3h | HIGH | 🔴 Ready |
| 7. Theta Stream | MEDIUM | 2-3h | HIGH | 🔴 Ready |
| 8. Voice Pipecat | LOW | 3-5d | HIGH | 🔴 Blocked |
| 9. Frontend UI | LOW | 5-7d | CRITICAL | 🔴 Ready |

---

## Key Decisions Made

1. **Database:** PostgreSQL (schema ready, need setup)
2. **LLM:** Groq (free, no cost, high rate limits)
3. **Avatar:** HeyGen (optional, can skip for MVP)
4. **Deployment:** Akash + Theta (scaffolded, ready to wire)
5. **Voice:** GPU infrastructure (can defer)
6. **Frontend:** Svelte 4 + Vite (can defer)

---

## Success Criteria

When complete, system should:

✅ Accept pilot submissions via API  
✅ Process through 4-stage agent workflow  
✅ Generate scripts via real LLM (not mock)  
✅ Persist all data to PostgreSQL  
✅ Enable community voting  
✅ Auto-deploy passed proposals  
✅ Stream on Theta + Akash  
✅ Track metrics end-to-end  

---

## Testing Strategy

1. **Unit tests:** Each blocker resolves independently
2. **Integration tests:** `npm run test:pilots` passes
3. **E2E tests:** Manual curl tests against API
4. **Regression tests:** Existing tests still pass

---

## Session Goals

### Session 1 (Today)
- [ ] Complete Database setup (Blocker 3)
- [ ] Get LLM working with Groq (Blocker 1+2)
- [ ] Run full test suite
- [ ] Document setup

### Session 2
- [ ] Setup Akash/Theta testnet accounts
- [ ] Wire real deployments
- [ ] Test deployment workflow

### Session 3
- [ ] Setup HeyGen (optional)
- [ ] Test video generation end-to-end

### Session 4+
- [ ] Solana program development
- [ ] Voice GPU setup
- [ ] Frontend UI

---

## Files to Modify

```
src/governance/voting.js         → Use database.recordVote()
src/frontend-api/pilot-submission.js → Use database.createSubmission()
src/frontend-api/channels.js     → Load from database
src/agents/llm-provider.js       → Already ready, just needs API key
src/agents/video-gen.js          → Already ready, just needs API key
```

---

## Commands Reference

```bash
# Database setup
createdb cryptocall_fm
node src/db/migrate.js

# Testing
npm test                          # Phase 1 tests
npm run test:pilots              # Full agent workflow
npm run test:deploy              # Deployment workflow
npm run test:full                # All tests together

# Running the app
npm start                         # Start server on port 3000

# Checking status
curl http://localhost:3000/status
curl http://localhost:3000/health
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| DB not available | Fallback to in-memory (already implemented) |
| LLM API missing | Mock responses (already implemented) |
| GPU unavailable | Local mock (already implemented) |
| Solana devnet down | Local fallback (already implemented) |

---

## Next Steps

1. **Immediate:** Start Session 1 below
2. **Short-term:** Complete all Phase A/B items
3. **Medium-term:** Phase C/D items
4. **Long-term:** Phase E/F/G items

---

## Status Tracking

This document will be updated with progress as we complete blockers.

**Last Update:** Feb 11, 2026, 22:35 UTC  
**Next Update:** After Session 1 completion

