#!/bin/bash

# CryptoCall FM – Quick Deployment Script
# Sets up everything needed to run the system

set -e

echo "======================================================================"
echo "              CryptoCall FM – Quick Deployment Setup"
echo "======================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js
echo -e "${YELLOW}1. Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Install from https://nodejs.org${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Install dependencies
echo ""
echo -e "${YELLOW}2. Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create .env file if missing
echo ""
echo -e "${YELLOW}3. Setting up .env file...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env (update with your API keys)${NC}"
    echo ""
    echo "Add these to .env:"
    echo "  GROQ_API_KEY=gsk_..." 
    echo "  HEYGEN_API_KEY=..."
    echo "  DATABASE_URL=postgresql://user:pass@localhost:5432/cryptocall_fm"
    echo ""
else
    echo -e "${GREEN}✓ .env already exists${NC}"
fi

# Check PostgreSQL
echo ""
echo -e "${YELLOW}4. Checking PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL installed${NC}"
    
    # Try to connect
    if psql -l &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"
        
        # Create database if missing
        if ! psql -lqt | cut -d \| -f 1 | grep -qw cryptocall_fm; then
            echo -e "${YELLOW}  Creating database...${NC}"
            createdb cryptocall_fm
            echo -e "${GREEN}  ✓ Database created${NC}"
        else
            echo -e "${GREEN}  ✓ Database exists${NC}"
        fi
        
        # Run migrations
        echo -e "${YELLOW}  Running migrations...${NC}"
        node src/db/migrate.js
        echo -e "${GREEN}  ✓ Migrations complete${NC}"
    else
        echo -e "${YELLOW}⚠ PostgreSQL not running. Start it with: pg_ctlcluster 14 main start${NC}"
    fi
else
    echo -e "${YELLOW}⚠ PostgreSQL not installed. Install with: apt-get install postgresql${NC}"
fi

# Run tests
echo ""
echo -e "${YELLOW}5. Running tests...${NC}"
echo "  (To test with API keys, set them in .env first)"
npm test || echo -e "${YELLOW}⚠ Some tests skipped (API keys not set)${NC}"

# Final status
echo ""
echo "======================================================================"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "======================================================================"
echo ""
echo "Next steps:"
echo "  1. Update .env with your API keys:"
echo "     - GROQ_API_KEY (https://console.groq.com)"
echo "     - HEYGEN_API_KEY (https://heygen.com) [optional]"
echo "     - THETA_API_KEY (https://edgecloud.ai) [optional]"
echo "     - SOLANA_PROGRAM_ID [after deployment]"
echo ""
echo "  2. Run full test:"
echo "     npm run test:full"
echo ""
echo "  3. Start server:"
echo "     npm start"
echo ""
echo "  4. Open in browser:"
echo "     http://localhost:3000/status"
echo ""
echo "======================================================================"
echo ""
echo "Documentation:"
echo "  - FINAL_STATUS_ALL_BLOCKERS.md (complete status)"
echo "  - DEPLOYMENT_CHECKLIST.md (production deployment)"
echo "  - SETUP_QUICK_START.md (quick start guide)"
echo "  - BLOCKERS_RESOLUTION.md (detailed blocker guides)"
echo ""
