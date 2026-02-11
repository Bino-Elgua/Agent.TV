# CryptoCall FM 🎙️

24/7 AI crypto radio host streaming to X Spaces. High-energy degen DJ that reads live crypto trends, accepts paid call-ins (Solana token burns), and keeps the vibes chaotic.

## Project Phases

**Phase 1 (MVP – Now):** Non-interactive 24/7 host looping X crypto summaries + filler hype. No callers yet.

**Phase 2:** Scheduled live slots (1 hour, 3x/day), free call-ins, Twilio integration, real Pipecat voice.

**Phase 3:** Full Solana integration – Pump.fun token, Helius burn webhooks, queue gating ($2 USD burn = get on air), treasury split (50/50 burn/treasury).

## Architecture

```
┌─────────────────────────────────────────┐
│   Voice Pipeline (Pipecat)              │
│   ├─ LLM (vLLM/Ollama on RunPod GPU)   │
│   ├─ TTS (chatterbox or piper)         │
│   └─ STT (faster-whisper)              │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌────────┐ ┌──────────┐ ┌─────────┐
   │ Trends │ │  Queue   │ │ Twilio  │
   │(Grok)  │ │(Inbound) │ │(Calls)  │
   └────────┘ └──────────┘ └─────────┘
        ▲          ▼
   ┌─────────────────────┐
   │  Express API        │
   │  ├─ /queue          │
   │  ├─ /status         │
   │  ├─ /twilio/*       │
   │  └─ /helius-webhook │
   └─────────────────────┘
```

## Tech Stack

- **Voice:** Pipecat (realtime pipeline), Twilio (telephony), Media Streams
- **LLM:** vLLM/Ollama (Qwen-2.5-72B, Llama-3.1-70B) on RunPod RTX 4090
- **TTS/STT:** chatterbox-tts + faster-whisper
- **Crypto Data:** Grok-3 API (OpenAI-compatible)
- **On-Chain:** @helius-labs/helius-sdk, Solana RPC
- **Backend:** Node.js 20+, Express, Pino logging
- **Storage:** In-memory queue (Phase 1); Redis (Phase 2+)

## Quick Start

### 1. Clone & Install

```bash
cd cryptocall-fm
npm install
# or pnpm install (recommended)
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```env
GROK_API_KEY=your_grok_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Run Tests

```bash
npm test
# or
npm run test
```

This runs dry-run mocks: queue, pipeline, Twilio, Helius stubs.

### 4. Start Server

```bash
npm run dev
# or
npm start
```

Server starts on http://localhost:3000

- `GET /health` – health check
- `GET /status` – pipeline + queue status
- `GET /queue` – current queue state
- `POST /queue/add` – add caller

### 5. Monitor

```bash
curl http://localhost:3000/status
```

Example response:

```json
{
  "running": true,
  "queue": {
    "queued": 2,
    "active": 1,
    "total": 3
  },
  "config": {
    "voiceMode": "non-interactive",
    "gpuRemote": false,
    "mockTwilio": true
  }
}
```

## Running on Termux (Android)

CryptoCall FM is Termux-friendly. The voice pipeline itself requires GPU (RunPod), but you can test queue, fetcher, and API locally:

```bash
# In Termux
pkg install nodejs npm

cd /data/data/com.termux/files/home/cryptocall-fm
npm install

# Run tests (full dry-run, no GPU needed)
npm test

# Start server + fetcher
npm start
# Logs: 'Run voice on remote GPU' for Pipecat part

# In another terminal, test queue
curl -X POST http://localhost:3000/queue/add \
  -H "Content-Type: application/json" \
  -d '{"callerId":"caller1","phoneNumber":"+1234567890"}'
```

## Running Voice on Remote GPU (Phase 2+)

For full voice synthesis (TTS) + LLM inference, deploy Pipecat on RunPod:

1. **Create RunPod Pod** (RTX 4090 recommended)
   - Image: runpod/pytorch (or similar)
   - Expose port 8000

2. **Install on RunPod**

   ```bash
   pip install pipecat-ai pipecat-services
   pip install vLLM faster-whisper
   ```

3. **Update .env**

   ```env
   VOICE_GPU_REMOTE=true
   VOICE_GPU_ENDPOINT=https://your-runpod-endpoint:8000
   ```

4. **Restart**

   ```bash
   npm start
   ```

Voice pipeline will connect to RunPod and stream audio.

## Development

### File Structure

```
src/
├── index.js                 # Express server + startup
├── config.js                # Config loader
├── services/
│   └── host-system.js       # System prompt + energy modifiers
├── utils/
│   ├── logger.js            # Pino logging
│   └── error-handler.js     # Retry logic
├── queue/
│   └── manager.js           # Caller queue (EventEmitter)
├── voice/
│   ├── voice-pipeline.js    # Pipecat loop
│   ├── twilio-handler.js    # Inbound/outbound calls
│   └── x-fetcher.js         # Grok API polling
├── on-chain/
│   └── helius-listener.js   # Solana burn webhooks (Phase 3)
└── tests/
    └── dry-run.js           # Mocks + test suite
```

### Adding Features

1. **New queue event?** Emit in `QueueManager`, listen in `voicePipeline` or elsewhere.
2. **Twilio webhook?** Add route to `twilioHandler.getWebhookRouter()`.
3. **Phase 3 (Helius)?** Uncomment SDK calls, fill in RPC queries.

### Debugging

Set log level:

```bash
LOG_LEVEL=debug npm start
```

Enable pipecat debug:

```bash
PIPECAT_DEBUG=true npm start
```

Mock mode (no real Twilio):

```bash
MOCK_TWILIO=true npm start
```

Dry-run (no voice loop):

```bash
DRY_RUN=true npm start
```

## Phase Roadmap

### Phase 1 ✓ (MVP)

- [x] X trend fetch via Grok (45s polling)
- [x] Voice pipeline skeleton (Pipecat config)
- [x] Queue manager (in-memory)
- [x] Express API (status, queue, trends)
- [x] Logging + error retry
- [x] Dry-run tests + mocks
- [ ] Connect to X Space (needs X API token + streaming endpoint)

### Phase 2

- [ ] Scheduled live call slots (3x/day, 1h each)
- [ ] Real Pipecat on RunPod (TTS + LLM)
- [ ] Twilio inbound call handling
- [ ] STT (caller voice) → LLM → TTS (host reaction)
- [ ] Redis queue (replace in-memory)
- [ ] Call recording + metadata storage
- [ ] Caller leaderboard (top talkers)

### Phase 3

- [ ] Solana integration (Helius webhooks)
- [ ] Pump.fun token launch
- [ ] Burn validation + $2 USD gating
- [ ] Treasury split (50/50 burn/treasury)
- [ ] Jupiter API for token price
- [ ] On-chain call history leaderboard

## Example: Adding a Caller (Phase 2+)

```bash
# Add caller to queue
curl -X POST http://localhost:3000/queue/add \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "caller_1",
    "phoneNumber": "+1234567890",
    "priority": 1
  }'

# Response:
{
  "id": "caller_1",
  "phoneNumber": "+1234567890",
  "addedAt": 1704067200000,
  "priority": 1
}

# Get next caller
curl -X POST http://localhost:3000/queue/next

# Response:
{
  "id": "caller_1",
  "phoneNumber": "+1234567890",
  "startedAt": 1704067210000
}

# End call
curl -X POST http://localhost:3000/queue/end-call
```

## Troubleshooting

**"GROK_API_KEY not set"**
- Fetch crypto trends will fail gracefully (returns empty array)
- Set key in `.env` to enable real X trend fetching

**"Pipecat not initialized"**
- Voice pipeline runs in local stub mode by default
- To enable real voice, set `VOICE_GPU_REMOTE=true` + valid `VOICE_GPU_ENDPOINT`

**"Queue empty"**
- Phase 1 has no callers; Phase 2+ Twilio webhooks add them
- Manually add via `POST /queue/add` for testing

**Port already in use**
- Change `PORT` in `.env`

## Next Steps

1. **Test locally:** `npm test` → `npm start` → `curl http://localhost:3000/status`
2. **Deploy on Termux:** Copy to Android device, `npm install`, `npm start`
3. **GPU setup:** Deploy Pipecat on RunPod, update `.env`
4. **X Space:** Wire X Spaces audio streaming endpoint to voice output
5. **Phase 2:** Enable Twilio, scheduled slots, real call-ins
6. **Phase 3:** Helius webhooks, Pump.fun token, burn gating

## License

MIT (placeholder)

---

**Made with chaos & memes** 🚀
