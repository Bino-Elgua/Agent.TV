#!/bin/bash
# AgentTV Network - Complete Test Suite

echo "🎬 AgentTV Network - Full Test Suite"
echo "===================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠ Node.js not found${NC}"
    exit 1
fi

echo -e "${BLUE}✓ Node.js $(node --version)${NC}"

# Install
echo -e "${BLUE}\n1️⃣  Installing dependencies...${NC}"
npm install --silent 2>/dev/null || true

# Phase 1 Tests
echo -e "${BLUE}\n2️⃣  Running Phase 1 Tests (Voice)...${NC}"
node src/tests/dry-run.js

# Phase 2 Tests
echo -e "${BLUE}\n3️⃣  Running Phase 2 Tests (Agents)...${NC}"
node src/tests/pilot-flow.js

# Phase 3-4 Tests
echo -e "${BLUE}\n4️⃣  Running Phase 3-4 Tests (Deployment)...${NC}"
node src/tests/deployment-dry-run.js

# Full Integration
echo -e "${BLUE}\n5️⃣  Running Full Integration Test...${NC}"
node src/tests/full-integration.js

echo -e "${GREEN}\n✅ ALL TESTS COMPLETE${NC}"
echo ""
echo "Next steps:"
echo "  1. npm start (start server on :3000)"
echo "  2. Configure .env with API keys"
echo "  3. POST /pilots/submit to create a pilot"
echo ""
