# CryptoCall FM – Quick Reference

## Commands

```bash
npm install          # Install deps
npm test            # Dry-run tests
npm start           # Start server (requires .env)
npm run dev         # Same as start
npm run fetch-x     # Test X trend fetch
npm run queue-status # Debug queue
```

## .env Essentials

```env
# Required (Phase 1)
GROK_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# Optional
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
DRY_RUN=false
MOCK_TWILIO=false
VOICE_GPU_REMOTE=false
VOICE_GPU_ENDPOINT=http://localhost:8000
```

## API Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/health` | Health check |
| GET | `/status` | Pipeline + queue status |
| GET | `/queue` | Current queue state |
| POST | `/queue/add` | Add caller (body: `{"callerId":"...","phoneNumber":"+1...","priority":1}`) |
| POST | `/queue/next` | Dequeue next caller |
| POST | `/queue/end-call` | End active call |
| GET | `/trends/current` | Current crypto trends |
| POST | `/trends/refresh` | Force fetch trends |
| POST | `/twilio/voice-webhook` | Inbound call webhook |
| POST | `/twilio/recording-complete` | Recording webhook |
| POST | `/twilio/call-status` | Call status callback |
| POST | `/helius-webhook` | Solana burn webhook |

## File Structure

```
src/
├── index.js                 # Entry, Express routes
├── config.js                # Env loader
├── services/host-system.js  # System prompt
├── utils/
│   ├── logger.js           # Pino
│   └── error-handler.js    # Retry
├── queue/manager.js         # EventEmitter queue
├── voice/
│   ├── voice-pipeline.js   # Pipecat loop
│   ├── x-fetcher.js        # Grok polling
│   └── twilio-handler.js   # Call routing
├── on-chain/
│   └── helius-listener.js  # Solana webhooks
└── tests/dry-run.js         # Test suite
```

## Logs

```bash
# Pretty-print (dev)
LOG_LEVEL=debug npm start

# JSON (prod)
NODE_ENV=production npm start

# Watch file
tail -f ~/.pm2/logs/cryptocall-fm-out.log
```

## Queue Operations

```bash
# Add caller
curl -X POST http://localhost:3000/queue/add \
  -H "Content-Type: application/json" \
  -d '{"callerId":"id1","phoneNumber":"+1234567890","priority":2}'

# Get next
curl -X POST http://localhost:3000/queue/next

# End call
curl -X POST http://localhost:3000/queue/end-call

# Status
curl http://localhost:3000/queue
```

## Energy Levels (Host Prompt Mods)

| Time | Modifier |
|------|----------|
| 6-9 AM | PEAK (market open, MAX hype) |
| 2-4 PM | AFTERNOON (dip buyers, INTENSE) |
| 8-11 PM | EVENING (retail FOMO, CHAOTIC) |
| 11 PM-6 AM | NIGHT (insomniacs, SLOW-BURN) |

## Phases

**Phase 1:** ✓ Non-interactive loop, Grok trends, queue stubs  
**Phase 2:** Twilio inbound, STT/TTS, scheduled slots, Redis  
**Phase 3:** Helius webhooks, Pump.fun, burn gating, leaderboard

## Debug Flags

```env
DRY_RUN=true              # Skip voice loop
MOCK_TWILIO=true          # Fake Twilio calls
PIPECAT_DEBUG=true        # Verbose Pipecat logs
LOG_LEVEL=debug           # All debug logs
VOICE_GPU_REMOTE=false    # Local stub mode
```

## Common Errors

| Error | Fix |
|-------|-----|
| `GROK_API_KEY not set` | Add to `.env` |
| `Port 3000 in use` | `PORT=3001 npm start` |
| `Module not found` | `npm install` |
| `GPU endpoint timeout` | Check `VOICE_GPU_ENDPOINT` in .env |
| `Twilio webhook 404` | Deploy on public URL (not localhost) |

## Performance Tuning

```bash
# More memory
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Slow Grok polling
GROK_POLL_INTERVAL=60000 npm start

# Multiple workers
pm2 start src/index.js -i 4
```

## Testing

```bash
# Full dry-run (all systems)
npm test

# Test X fetcher only
node src/voice/x-fetcher.js

# Test queue
node -e "import('./src/queue/manager.js').then(m => console.log(m.queueManager.getStatus()))"
```

## Docker

```bash
# Build
docker build -t cryptocall-fm .

# Run
docker run -d -p 3000:3000 --env-file .env cryptocall-fm

# Logs
docker logs -f <container_id>

# Stop
docker stop <container_id>
```

## Systemd Service (Linux)

```bash
# Create service
sudo tee /etc/systemd/system/cryptocall-fm.service > /dev/null << EOF
[Unit]
Description=CryptoCall FM
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/cryptocall-fm
ExecStart=/usr/bin/node src/index.js
Restart=always
Environment="NODE_ENV=production"
EnvironmentFile=/opt/cryptocall-fm/.env

[Install]
WantedBy=multi-user.target
EOF

# Enable
sudo systemctl enable cryptocall-fm

# Start
sudo systemctl start cryptocall-fm

# Status
sudo systemctl status cryptocall-fm

# Logs
journalctl -u cryptocall-fm -f
```

## Next Steps

1. `npm install && npm test` – Verify build
2. `cp .env.example .env && nano .env` – Configure
3. `npm start` – Run
4. `curl http://localhost:3000/status` – Check status
5. Deploy to RunPod + wire Twilio (Phase 2)

---

**v1.0 – 2025-02-11**
