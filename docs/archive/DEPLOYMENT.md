# CryptoCall FM – Deployment Guide

## Local Development (Termux / Linux)

### Prerequisites

- Node.js 20+ (`node --version`)
- npm or pnpm
- GROK_API_KEY (free from x.ai)
- Twilio keys (optional for Phase 2+)

### 1. Setup

```bash
cd cryptocall-fm
npm install
cp .env.example .env

# Edit .env with your keys
nano .env
```

### 2. Test

```bash
# Full dry-run (mocks all external APIs)
npm test

# Expected output:
# ✓ Config validation passed
# ✓ QueueManager tests passed
# ✓ VoicePipeline tests passed
# ✓ TwilioHandler tests passed
# ✓ HeliusListener initialized
# ✅ All dry-run tests completed!
```

### 3. Run

```bash
# Start server + pipeline loop
npm start

# Expected logs:
# 🎙️  CryptoCall FM starting up...
# 🚀 Server live on port 3000
```

### 4. Verify

```bash
# In another terminal:
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2025-02-11T..."}

curl http://localhost:3000/status
# Shows queue + voice pipeline state

curl http://localhost:3000/queue
# Current queue (empty in Phase 1)
```

---

## Production Deployment (Linux Server)

### Option A: VPS / Dedicated Server

1. **SSH into server**
   ```bash
   ssh root@your-server-ip
   ```

2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone repo**
   ```bash
   cd /opt
   git clone https://github.com/yourusername/cryptocall-fm.git
   cd cryptocall-fm
   npm install --production
   ```

4. **Setup systemd service**
   ```bash
   sudo tee /etc/systemd/system/cryptocall-fm.service > /dev/null << EOF
   [Unit]
   Description=CryptoCall FM
   After=network.target
   
   [Service]
   Type=simple
   User=nodejs
   WorkingDirectory=/opt/cryptocall-fm
   Environment="NODE_ENV=production"
   Environment="LOG_LEVEL=info"
   EnvironmentFile=/opt/cryptocall-fm/.env
   ExecStart=/usr/bin/node src/index.js
   Restart=always
   RestartSec=10
   
   [Install]
   WantedBy=multi-user.target
   EOF
   
   sudo useradd -r nodejs
   sudo chown -R nodejs:nodejs /opt/cryptocall-fm
   sudo systemctl enable cryptocall-fm
   sudo systemctl start cryptocall-fm
   
   # Verify
   systemctl status cryptocall-fm
   ```

5. **Setup nginx reverse proxy**
   ```bash
   sudo apt-get install -y nginx
   
   sudo tee /etc/nginx/sites-available/cryptocall-fm > /dev/null << EOF
   server {
       listen 80;
       server_name your-domain.com;
   
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host \$host;
           proxy_cache_bypass \$http_upgrade;
       }
   }
   EOF
   
   sudo ln -s /etc/nginx/sites-available/cryptocall-fm /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

6. **SSL (Let's Encrypt)**
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Option B: Docker

1. **Create Dockerfile**
   ```dockerfile
   FROM node:20-slim
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   
   ENV NODE_ENV=production
   EXPOSE 3000
   
   CMD ["node", "src/index.js"]
   ```

2. **Build & run**
   ```bash
   docker build -t cryptocall-fm .
   docker run -d \
     --name cryptocall-fm \
     -p 3000:3000 \
     --env-file .env \
     cryptocall-fm
   
   # Check logs
   docker logs -f cryptocall-fm
   ```

3. **Docker Compose** (optional, for multi-service)
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       env_file: .env
       restart: unless-stopped
     redis:  # Phase 2+
       image: redis:7-alpine
       ports:
         - "6379:6379"
   ```

---

## GPU Voice Pipeline (Phase 2+)

### RunPod RTX 4090 Setup

1. **Create Pod on RunPod.io**
   - Image: `runpod/pytorch` or similar
   - GPU: RTX 4090 (or 3090)
   - Disk: 50GB+ (models are large)
   - Expose port 8000

2. **SSH into Pod**
   ```bash
   ssh root@<runpod-ip>
   ```

3. **Install dependencies**
   ```bash
   pip install -U pip
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   
   pip install pipecat-ai pipecat-services
   pip install vLLM faster-whisper
   pip install pydantic fastapi uvicorn
   ```

4. **Create inference server** (`voice-server.py`)
   ```python
   from fastapi import FastAPI
   from pipecat.services.services import VLLMService, ChatGPTService
   from pipecat.services.tts import ChatterboxTTS
   from pipecat.services.stt import FasterWhisperSTT
   import asyncio
   
   app = FastAPI()
   
   llm = VLLMService(
       model="meta-llama/Llama-2-7b-chat-hf",
       base_url="http://localhost:8001/v1"
   )
   
   @app.post("/generate")
   async def generate(prompt: str):
       response = await llm.generate(prompt, max_tokens=256)
       return {"text": response}
   
   if __name__ == "__main__":
       import uvicorn
       uvicorn.run(app, host="0.0.0.0", port=8000)
   ```

5. **Start vLLM backend**
   ```bash
   python -m vllm.entrypoints.openai.api_server \
     --model meta-llama/Llama-2-7b-chat-hf \
     --tensor-parallel-size 1 \
     --gpu-memory-utilization 0.9 \
     --port 8001
   ```

6. **Start voice server** (in another terminal)
   ```bash
   python voice-server.py
   ```

7. **Update .env on main server**
   ```env
   VOICE_GPU_REMOTE=true
   VOICE_GPU_ENDPOINT=https://runpod-xyz.runpod.io:8000
   ```

8. **Restart CryptoCall FM**
   ```bash
   systemctl restart cryptocall-fm
   # Now has real voice!
   ```

---

## Twilio Integration (Phase 2+)

### 1. Get Twilio Account

- Sign up at twilio.com
- Get Account SID, Auth Token, Phone Number

### 2. Configure Webhooks

In Twilio dashboard:
- Phone Number → Configure
- Voice → A call comes in
  - POST to: `https://your-domain.com/twilio/voice-webhook`
  - Status callback: `https://your-domain.com/twilio/call-status`

### 3. Update .env

```env
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 4. Test inbound call

```bash
# Simulate inbound call
curl -X POST http://localhost:3000/twilio/voice-webhook \
  -d "From=+1111111111&To=+1234567890&CallSid=CA_test"

# Add caller to queue
curl -X POST http://localhost:3000/queue/add \
  -H "Content-Type: application/json" \
  -d '{"callerId":"test","phoneNumber":"+1111111111"}'

# Get status
curl http://localhost:3000/status
```

---

## Solana / Helius Integration (Phase 3)

### 1. Get Helius API Key

- Sign up at helius.xyz
- Create webhook for treasury burn address

### 2. Setup Solana RPC

```env
HELIUS_API_KEY=your_key_here
HELIUS_WEBHOOK_URL=https://your-domain.com/helius-webhook
SOLANA_BURN_ADDRESS=11111111111111111111111111111112
```

### 3. Register Webhook

```bash
curl -X POST https://api.helius.xyz/v0/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_url": "https://your-domain.com/helius-webhook",
    "api_key": "your_key",
    "transaction_types": ["BURN"]
  }'
```

### 4. Handle burn notifications

Burns are received at `POST /helius-webhook` and auto-queue callers.

---

## Monitoring & Logs

### Local logs

```bash
# Watch logs in real-time
tail -f ~/.pm2/logs/cryptocall-fm-out.log

# Or via systemd
journalctl -u cryptocall-fm -f

# Or docker
docker logs -f cryptocall-fm
```

### Remote monitoring

```bash
# SSH port forward
ssh -L 3000:localhost:3000 user@server

# Then monitor locally
watch curl http://localhost:3000/status
```

### Datadog / New Relic (optional)

```bash
npm install --save datadog-browser-rum

# In src/index.js, initialize:
import { datadogRum } from '@datadog/browser-rum'
datadogRum.init({
  applicationId: '...',
  clientToken: '...',
})
```

---

## Backup & Recovery

### Backup config

```bash
# Backup .env
cp .env .env.backup
tar -czf cryptocall-fm-backup.tar.gz src/ package.json package-lock.json

# Upload to S3 or similar
aws s3 cp cryptocall-fm-backup.tar.gz s3://your-bucket/
```

### Restore

```bash
aws s3 cp s3://your-bucket/cryptocall-fm-backup.tar.gz .
tar -xzf cryptocall-fm-backup.tar.gz
npm install
npm start
```

---

## Troubleshooting

### Port 3000 already in use

```bash
# Find process
lsof -i :3000

# Kill it
kill -9 <PID>

# Or change port
PORT=3001 npm start
```

### npm: command not found

```bash
# Install Node.js / npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Service won't start

```bash
# Check systemd logs
journalctl -u cryptocall-fm -n 50

# Check if .env is readable
cat /opt/cryptocall-fm/.env | head

# Test manually
cd /opt/cryptocall-fm
NODE_ENV=production npm start
```

### Grok API failing

```bash
# Check key is valid
curl -H "Authorization: Bearer $GROK_API_KEY" \
  https://api.x.ai/v1/models

# Enable debug logging
LOG_LEVEL=debug npm start
```

---

## Performance Tuning

### Increase worker threads (Phase 2+)

```bash
# For heavy LLM inference
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Rate limiting for Grok

```env
GROK_POLL_INTERVAL=60000  # Every 60s instead of 45s
GROK_RATE_LIMIT=2000      # 2s between calls
```

### Redis queue (Phase 2+)

```bash
npm install redis

# In .env
QUEUE_TYPE=redis
REDIS_URL=redis://localhost:6379
```

---

## Scaling (Phase 3+)

### Multiple instances

```bash
npm install -g pm2

pm2 start src/index.js -i max
pm2 save
pm2 startup
```

### Load balancer (nginx)

```nginx
upstream cryptocall {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://cryptocall;
    }
}
```

---

**Last updated:** 2025-02-11
