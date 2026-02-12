# AgentTV Network – Decentralized AI Entertainment Platform

**Vision:** A fully agentic decentralized Netflix where AI-powered shows run 24/7 on community-voted pilots, hosted on Akash + Theta, governed by $TICKER token holders.

**Flagship Pilot:** CryptoCall FM (enhanced with video + avatar)

---

## 🎯 Core Concept

```
User submits show idea
    ↓
Multi-agent workflow (Research → Script → Video → Stream)
    ↓
Community votes (token-weighted, on-chain)
    ↓
Winner auto-deploys on Akash + Theta (24/7 streaming)
    ↓
Creator + relayers earn TFUEL + treasury rewards
```

---

## 🚀 Phase Roadmap

### Phase 1: CryptoCall FM Enhanced (Current MVP)
- [x] 24/7 voice host loop (Pipecat)
- [x] X trend fetching (Grok API)
- [x] Twilio call-ins
- [x] Queue manager
- [ ] Add LiveKit video + avatar compositing
- [ ] Stream to Theta EdgeCloud

**Duration:** 2-3 weeks (video pipeline)

### Phase 2: Pilot Submission + Agent Orchestration
- [ ] User submission form (frontend)
- [ ] Multi-agent workflow: Research → Script → Video → Stream
- [ ] Dry-run tests for workflow
- [ ] Token-gated submission (min $TICKER balance)

**Duration:** 3-4 weeks

### Phase 3: Governance & On-Chain Voting
- [ ] Solana/Base program for proposals + voting
- [ ] Vote events trigger deployment
- [ ] Treasury fund Akash bids + Theta rewards
- [ ] Leaderboard (creator scores, viewer counts)

**Duration:** 3-4 weeks

### Phase 4: Persistent Deployment + Analytics
- [ ] Auto-deploy voted-in pilots on Akash
- [ ] LiveKit vision + HeyGen avatar per-channel
- [ ] Metrics dashboard (viewers, TFUEL earned)
- [ ] Channel management (pause, archive, retire)

**Duration:** 3-4 weeks

---

## 🛠️ Architecture

### Components

**Agents (Multi-Agent Orchestration)**
- **Researcher:** Gathers trends, context for show topic
- **Scriptor:** Converts research to engaging script with timing
- **VideoGenAgent:** Avatar video synthesis (HeyGen/Synthesia API) + LiveKit compositing
- **StreamerAgent:** Publishes to Theta + optionally deploys to Akash

**Governance**
- **VotingSystem:** Create proposals, track $TICKER-weighted votes, emit "passed" events
- **Treasury:** Allocate funds for Akash bids + Theta relay rewards

**Deployment**
- **AkashDeployer:** Generate SDL manifests, submit to Akash provider
- **ThetaStreamer:** Upload clips + manage EdgeNode relays

**Frontend APIs**
- **PilotSubmissionHandler:** Validate submissions, queue for orchestration
- **ChannelManager:** Track deployed channels, metrics, lifecycle

---

## 📋 API Endpoints (New in Phases 2-4)

### Pilot Submission (Phase 2)
```
POST   /pilots/submit           # Submit show idea
GET    /pilots/status/:id       # Check generation status
GET    /pilots/my               # User's submissions
GET    /pilots/stats            # Submission statistics
```

### Governance (Phase 3)
```
GET    /governance/proposals    # All active proposals
GET    /governance/proposal/:id # Proposal details + vote counts
POST   /governance/vote         # Cast vote (token-weighted)
```

### Channels (Phase 4)
```
GET    /channels                # All deployed channels (with filters)
GET    /channels/featured       # Top channels by viewers
GET    /channels/:id            # Channel details + metrics
GET    /channels/stats          # Network-wide stats
```

### System
```
GET    /orchestrator/status     # All agents + workflows
```

---

## 💻 Tech Stack

**Voice/Video**
- Pipecat (realtime pipeline)
- LiveKit Agents (video + vision processing)
- HeyGen / Synthesia (avatar synthesis)
- chatterbox-tts + faster-whisper

**AI/LLM**
- vLLM / Ollama (Qwen-2.5-72B, Llama-3.1-70B on GPU)
- Grok-3 API (trend research)

**Decentralized Infra**
- Akash Network (compute + inference hosting)
- Theta EdgeCloud (video streaming + P2P CDN)
- Solana/Base (governance voting contracts)

**Backend**
- Node.js 20+ (orchestration, API)
- Express (REST routes)
- EventEmitter (agent communication)
- Pino (logging)

---

## 🔑 Key Features by Phase

### Phase 1 (Now)
- 24/7 CryptoCall FM with video feed
- Manual streaming to Theta

### Phase 2 (In Progress)
- User can submit show ideas
- Agents auto-generate videos
- Community can watch clips before voting

### Phase 3 (Next)
- On-chain proposals + voting
- Vote passes → deployment triggered
- Treasury rewards creators + relayers

### Phase 4 (Final)
- Full persistent channels
- Per-channel avatars + branding
- Analytics dashboard
- Multi-show ecosystem

---

## 🎬 Example Workflow: User Submits Pilot

1. **User submits:**
   ```bash
   POST /pilots/submit
   {
     "title": "DeFi Degens Daily",
     "description": "Deep dives into DeFi hacks and yield",
     "creator": "alice_web3",
     "duration": 300,
     "tone": "casual",
     "tags": ["defi", "hacks", "yield"],
     "avatarStyle": "cyberpunk"
   }
   ```

2. **System validates:**
   - Alice has min $TICKER balance
   - Title/description are valid
   - Duration 60-600s

3. **Agents orchestrate:**
   - Researcher: fetch DeFi trends
   - Scriptor: write 5-min script with segments
   - VideoGen: create avatar video
   - Streamer: upload to Theta, register for voting

4. **Governance:**
   - Proposal created: "DeFi Degens Daily"
   - Community votes for 7 days
   - If >50% yes: auto-deploy on Akash
   - Theta relayers start streaming, earn TFUEL

5. **Channel Live:**
   - Available at `/channels/defi-degens-daily`
   - Viewers see avatar, trending data overlay
   - Creator earns treasury rewards

---

## 🔐 Tokenomics ($TICKER)

**Uses:**
- `GATING_COST = 100`: Minimum balance to submit pilot
- Vote weight: 1 token = 1 vote power
- Tips: Viewers can tip creators via $TICKER
- Treasury: Fund Akash bids (~1 AKT/day = ~$5 USD worth in $TICKER at parity)

**Rewards:**
- Creator: 50% of treasury allocation for deployed channel
- Relayers (Theta EdgeNodes): 30% in TFUEL
- DAO treasury: 20% (future voting on expansion)

---

## 📂 File Structure (Phases 2-4 additions)

```
src/
├── agents/
│   ├── base-agent.js            # Foundation (EventEmitter-based)
│   ├── orchestrator.js          # Workflow coordinator
│   ├── researcher.js            # Trend research
│   ├── scriptor.js              # Script generation
│   ├── video-gen.js             # Avatar + video synthesis
│   └── streamer.js              # Publish to Theta/Akash
├── deployment/
│   ├── akash-deploy.js          # SDL generation + deployment
│   └── theta-streamer.js        # Upload + stream management
├── governance/
│   └── voting.js                # On-chain proposals + voting
├── frontend-api/
│   ├── pilot-submission.js      # Submission handling
│   └── channels.js              # Channel management
└── tests/
    ├── pilot-flow.js            # End-to-end pilot workflow test
    └── deployment-dry-run.js    # Akash/Theta dry-run
```

---

## 🚦 Getting Started (Phase 1→2)

### Install
```bash
npm install
```

### Configure .env
```env
# Phase 1 (existing)
GROK_API_KEY=...
TWILIO_*=...

# Phase 2+ (new)
LIVEKIT_URL=wss://your-livekit.example.com
HEYGEN_API_KEY=...  # For avatar generation
THETA_API_KEY=...   # Theta EdgeCloud
AKASH_PROVIDER_URL=http://akash-provider:3030
SOLANA_RPC=...      # For governance
```

### Run
```bash
npm start
# 🚀 AgentTV Network live
# 📺 CryptoCall FM: http://localhost:3000/status
# 📝 Submit pilots: POST http://localhost:3000/pilots/submit
# 🗳️  Voting: GET http://localhost:3000/governance/proposals
```

### Test Workflow
```bash
npm run test:pilots       # End-to-end pilot submission → deployment
npm run test:deploy       # Dry-run Akash/Theta integration
```

---

## 📊 Success Metrics

**Phase 1:**
- CryptoCall FM streaming 24/7 with video
- 10+ connected callers/day

**Phase 2:**
- 5+ pilot submissions
- 3+ videos generated end-to-end
- 0 crashes in orchestration

**Phase 3:**
- 1 proposal passes
- 100+ votes cast
- 1 new channel deployed on Akash

**Phase 4:**
- 10+ active channels
- 1,000+ daily viewers
- $5K+ monthly treasury earned

---

## 🔮 Future Expansions

- **Marketplace:** Buy/sell channel assets
- **Creator studios:** Tools for custom branding per-channel
- **Governance 2.0:** DAO treasury management, fee allocation
- **Multi-language:** Localized pilots for different regions
- **Integrations:** Twitter Spaces, YouTube, TikTok streaming
- **Analytics:** Real-time metrics + leaderboards
- **AI Moderation:** Auto-remove spam/inappropriate content

---

## 📚 References

- **Akash Network:** https://docs.akash.network/
- **Theta EdgeCloud:** https://docs.thetatoken.org/docs/edgecloud-platform
- **Pipecat:** https://github.com/pipecat-ai/pipecat
- **LiveKit Agents:** https://github.com/livekit-examples/agents
- **Solana Programs:** https://docs.solana.com/developers/programs

---

**Status:** 🟢 Phase 1 MVP + Phase 2 Agents Built | Phase 3-4 Scaffolded  
**Next:** Integrate LiveKit video into voice-pipeline.js + test pilot workflow
