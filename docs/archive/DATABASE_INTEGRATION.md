# Database Integration Guide

Convert CryptoCall FM from in-memory to PostgreSQL-backed persistence.

---

## Quick Setup (5 minutes)

### 1. Install PostgreSQL

```bash
# Linux/Ubuntu
apt-get install postgresql postgresql-contrib

# Start service
pg_ctlcluster 14 main start

# Or using Termux (Android)
pkg install postgresql
```

### 2. Create Database

```bash
createdb cryptocall_fm
```

### 3. Update .env

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cryptocall_fm
```

### 4. Run Migrations

```bash
node src/db/migrate.js
```

**Expected output:**
```
Connected to PostgreSQL
Migrations table ready
Found migration files: [ '001_init_schema.sql' ]
Executing migration: 001_init_schema.sql
Migration completed successfully
All migrations completed successfully
```

### 5. Test Connection

```bash
npm run test:full
```

Database should now persist data across restarts.

---

## Wire Up Voting System

**File:** `src/governance/voting.js`

Change from in-memory storage to database:

```javascript
// BEFORE (in-memory)
this.proposals = new Map();
this.votes = new Map();

// AFTER (database)
async recordVote(proposalId, voter, choice, weight) {
  await database.recordVote(proposalId, voter, choice, weight);
  // Update local cache for fast reads
  this.votes.set(`${proposalId}:${voter}`, { choice, weight });
}

async getAllProposals() {
  return await database.getAllProposals();
}
```

---

## Wire Up Submissions

**File:** `src/frontend-api/pilot-submission.js`

```javascript
// BEFORE (in-memory)
router.post('/submit', (req, res) => {
  const submission = { id: crypto.randomUUID(), ...req.body };
  submissions.push(submission);
  res.json(submission);
});

// AFTER (database)
router.post('/submit', async (req, res) => {
  const submission = await database.createSubmission({
    title: req.body.title,
    description: req.body.description,
    creator: req.body.creator,
    workflowId: req.body.workflowId
  });
  res.json(submission);
});
```

---

## Wire Up Channels

**File:** `src/frontend-api/channels.js`

```javascript
// BEFORE (in-memory)
const channels = [];

// AFTER (database)
router.get('/channels', async (req, res) => {
  const channels = await database.getAllChannels(100, 0);
  res.json(channels);
});

router.post('/channels', async (req, res) => {
  const channel = await database.createChannel({
    title: req.body.title,
    description: req.body.description,
    creator: req.body.creator
  });
  res.json(channel);
});
```

---

## Wire Up Logging

**File:** `src/utils/logger.js` (or add to index.js)

```javascript
import database from '../db/index.js';

// When logging important events:
await database.logActivity('pilot_submitted', creator, submissionId, 'submission', {
  title: submission.title,
  description: submission.description
});

await database.logActivity('vote_cast', voter, proposalId, 'proposal', {
  choice: choice,
  weight: weight
});
```

---

## Migration Files

### Current Schema (1 migration):
- `src/migrations/001_init_schema.sql` – 11 tables

### To Add More Migrations:

Create `src/migrations/002_add_new_table.sql`:

```sql
-- Example: Add new table
CREATE TABLE new_feature (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Then run:
```bash
node src/db/migrate.js
```

Migration runner will:
1. Check migrations table
2. Run any new .sql files
3. Record in migrations table
4. Prevent re-running old migrations

---

## Database Queries Reference

```javascript
import { database } from './src/db/index.js';

// Initialize (call once at startup)
await database.initialize();

// PROPOSALS
await database.createProposal({
  title: 'My Proposal',
  description: 'Details...',
  creator: 'user123'
});

const proposal = await database.getProposal(proposalId);
const allProposals = await database.getAllProposals(100, 0);

await database.updateProposalVotes(proposalId, yesCount, noCount, abstainCount);

// VOTES
await database.recordVote(proposalId, voter, 'yes', weight);
const votes = await database.getProposalVotes(proposalId);

// SUBMISSIONS
await database.createSubmission({
  title: 'Pilot Title',
  description: 'Details...',
  creator: 'user123',
  workflowId: 'workflow-id'
});

const submission = await database.getSubmission(submissionId);
const userSubmissions = await database.getUserSubmissions(creator);

await database.updateSubmissionStatus(submissionId, 'approved', {
  videoUrl: 'https://...',
  streamingUrl: 'rtmps://...'
});

// CHANNELS
await database.createChannel({
  title: 'Channel Title',
  description: 'Details...',
  creator: 'user123'
});

const channel = await database.getChannel(channelId);
const channels = await database.getAllChannels(100, 0);

await database.updateChannelStats(channelId, {
  totalEpisodes: 5,
  totalVotes: 150,
  totalViewers: 5000,
  creatorTreasury: 100.50,
  governancePool: 50.25
});

// LOGGING
await database.logActivity(
  'proposal_created',
  creator,
  proposalId,
  'proposal',
  { title: 'My Proposal' }
);

// UTILITY
await database.getStatus();

// Cleanup
await database.close();
```

---

## Testing Database

```bash
# Start database
createdb cryptocall_fm
node src/db/migrate.js

# Run tests (should persist)
npm test
npm run test:pilots
npm run test:full

# Verify data persisted
psql cryptocall_fm
SELECT * FROM proposals;
SELECT * FROM votes;
SELECT * FROM submissions;
\q
```

---

## Common Issues

### "Database connection failed"
- Check PostgreSQL is running: `psql -U postgres`
- Check DATABASE_URL is correct in .env
- Check database exists: `createdb cryptocall_fm`

### "Migrations table doesn't exist"
- Run `node src/db/migrate.js` again (it creates the table)

### "Column not found"
- Migrations may have failed silently
- Check: `psql cryptocall_fm` → `\dt` (list tables)
- Rerun: `node src/db/migrate.js`

### "Connection timeout"
- PostgreSQL not running or not accessible
- Check: `pg_ctlcluster 14 main start`
- Or: `systemctl start postgresql`

---

## Advanced: Connection Pooling

Database manager uses connection pool (max 20):

```javascript
// In src/db/index.js
this.pool = new Pool({
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle after 30s
  connectionTimeoutMillis: 2000,
});
```

Adjust if needed:
```javascript
max: 50,              // More concurrent requests
idleTimeoutMillis: 60000,  // Keep connections longer
```

---

## Advanced: Custom Queries

For queries not in `DatabaseManager`:

```javascript
import { database } from './src/db/index.js';

// Custom query
const result = await database.pool.query(
  'SELECT * FROM proposals WHERE created_at > $1',
  [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] // Last 7 days
);

console.log(result.rows);
```

---

## Production Checklist

- [ ] PostgreSQL running with backups enabled
- [ ] DATABASE_URL set in production .env
- [ ] Migrations applied before deployment
- [ ] Connection pool tuned for load
- [ ] Database user has minimal permissions
- [ ] Secrets not logged (check logger config)
- [ ] Monitoring/alerting on connection pool
- [ ] Regular backups scheduled

---

## Deployment Path

1. ✅ Setup PostgreSQL locally
2. ✅ Create database + run migrations
3. ✅ Wire up voting/submissions/channels
4. ✅ Test with `npm run test:full`
5. ✅ Deploy to production
   - Use managed PostgreSQL (Heroku, AWS RDS, Railway, etc.)
   - Update DATABASE_URL in production
   - Run migrations once before deploy
   - Profit

---

## Support

See:
- `BLOCKERS_RESOLUTION.md` – Database blocker details
- `DATABASE_URL` syntax: https://www.postgresql.org/docs/current/libpq-connect.html
- Node.js pg docs: https://node-postgres.com

