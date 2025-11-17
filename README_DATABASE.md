# Smoothie Database Setup

Smoothie now has its own API and connects directly to Neon DB, making it independent from the backfill_backend project.

## Configuration

The database connection is configured in [.env](.env):

```bash
DATABASE_URL=postgresql://neondb_owner:...@ep-empty-wave-ahr1wvfq-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## Architecture

### Database Layer
- **Database**: PostgreSQL (Neon DB)
- **Configuration**: [lib/db/config.ts](lib/db/config.ts)
- **Connection Pool**: pg library with SSL support

### Repository Layer
- **User Repository**: [lib/db/user-repository.ts](lib/db/user-repository.ts)
  - `getUserBalance()` - Get current balance for a user/asset
  - `getUserBalanceHistory()` - Get balance history over a date range

### API Layer
- **Balance History API**: [app/api/balance-history/route.ts](app/api/balance-history/route.ts)
  - Endpoint: `GET /api/balance-history?user={address}&asset={address}&days={number}`
  - Queries database directly using userRepository
  - Returns balance history in the same format as backfill_backend

### Frontend Layer
- **React Hook**: [hooks/use-balance-history.ts](hooks/use-balance-history.ts)
  - Fetches data from `/api/balance-history`
  - Uses React Query for caching and state management
  - Transforms data for charts

## Running Smoothie Independently

1. **Ensure DATABASE_URL is set** in `.env`

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Test the API**:
   ```bash
   curl "http://localhost:3000/api/balance-history?user=GBZUE4C27CKHVKPTV7FQT3KFZY3ZGXPWQ5XFQZO6IIU7DCOHSOMWWV34&asset=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC&days=7"
   ```

## No Dependency on backfill_backend

Smoothie no longer needs the backfill_backend API server running. It queries the Neon DB directly, making it a standalone application.

The old `NEXT_PUBLIC_BACKFILL_API_URL` environment variable is no longer needed and has been commented out in `.env`.

## Database Tables

Smoothie queries the following tables:
- `user_positions` - User positions per pool/asset/date
- `pool_snapshots` - Pool rates (b_rate, d_rate) per date

These tables must be populated by the backfill_backend scripts, but smoothie only reads from them.
