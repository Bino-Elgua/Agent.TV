# Quick Start: Dynamic Oracle Mode 🚀

**Time to Deploy:** 5 minutes  
**Status:** ✅ Production-Ready

---

## In 60 Seconds

### 1. Test It (No Setup)
```bash
cd cryptocall-fm
npm run test:dynamic-oracle
```
✅ See all 6 test scenarios pass

### 2. Add Your API Key
```bash
export GROK_API_KEY=gsk_...  # Get from https://api.groq.com
```

### 3. Deploy
```bash
npm run dev
```
✅ Live with dynamic intros

---

## What You Get

### Before: Canned Scripts ❌
```
"Clean book, steady hand. You actually trade instead of chase. Respect."
(Same for all Tier 3 wallets)
```

### After: Fresh Intros ✨
```
"Steady hand, Quantum Degen badge. You bought at floor, sold at moon.
 But that rug in Dec? Still hurts. What's your read, oracle?"
(Unique per wallet, every time)
```

---

## Features

✅ **Dynamic Intros** (15 sec, Grok-powered)  
✅ **Dynamic Exits** (5 sec, tone-aware)  
✅ **Voice Modulation** (pitch/speed per tier)  
✅ **Loop Prevention** (cache last 5 intros)  
✅ **Fallback Mode** (templates if Grok down)  
✅ **Real On-Chain Data** (Helius API or mock)  
✅ **5-Tier System** (Noob → Oracle)  

---

## Optional: Real On-Chain Data

```bash
export HELIUS_API_KEY=...  # Get from https://helius.dev
```

Then oracle will fetch real Solana wallet history instead of mock data.

---

## Test Commands

```bash
npm run test:dynamic-oracle      # Full integration test
npm run test:oracle              # Legacy wallet tests
npm run test:intro               # Legacy dynamic intro tests
npm run dev                      # Start dev server
```

---

## Troubleshooting

**Q: "GROK_API_KEY not set"**  
A: Expected! Falls back to templates. Everything works.

**Q: Voice not changing?**  
A: Check logs for "LOCAL mode". Set `VOICE_GPU_REMOTE=true` for production.

**Q: Cache not loading?**  
A: Check `last_intros.json` exists. Will auto-create on first run.

---

## Architecture

```
Caller → Burn detected → Analyze wallet → Grok intro → Voice switch →
Play 15s → Q&A → Call ends → Grok exit → Play 5s → Done
```

---

## Files Changed

- ✅ `src/services/wallet-oracle.js` – Dynamic intros/exits, cache
- ✅ `src/voice/voice-pipeline.js` – Oracle integration, voice switching
- ✅ `src/tests/dynamic-oracle-full-flow.js` – Comprehensive test
- ✅ `package.json` – New test command
- ✅ Documentation files

---

## Example Output

```json
{
  "wallet": "9Y7jX9z...qRsT",
  "tier": 3,
  "tone": "respect",
  "intro": "Steady hand, Quantum Degen badge. You bought at floor...",
  "exit": "Keep that discipline. See you next time.",
  "voice": {
    "pitch": "medium",
    "speed": "medium",
    "effect": "clean"
  }
}
```

---

## Tiers at a Glance

| Tier | Name | Win Ratio | Tone | Voice |
|------|------|-----------|------|-------|
| 1 | Noob | <40% | Curious | Low, slow |
| 2 | Degen | <40% + rugs | Roast | Fast, sharp |
| 3 | Steady | >55% | Respect | Medium |
| 4 | Whale | Top 10% | Awe | High |
| 5 | Oracle | >55% + viral | Ritual | Deep, slow |

---

## What's Next?

1. ✅ Run `npm run test:dynamic-oracle` → See it work
2. ✅ Set `GROK_API_KEY` → Enable real generation
3. ✅ Set `HELIUS_API_KEY` → Enable real on-chain data
4. ✅ Deploy → Go live

---

## More Info

- **Full Guide:** `WALLET_ORACLE_DYNAMIC_UPGRADE.md`
- **Implementation Details:** `DYNAMIC_ORACLE_IMPLEMENTATION_SUMMARY.md`
- **Test Suite:** `src/tests/dynamic-oracle-full-flow.js`

---

## Status

✅ Code complete and tested  
✅ Fallback mode working  
✅ Ready for Grok API integration  
✅ Ready for production deployment  

🎯 **Next:** Deploy on your infra!
