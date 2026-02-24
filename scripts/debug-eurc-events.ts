import { config } from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

interface EurcEventRow {
  action_type: string
  asset_address: string | null
  bid_asset: string | null
  amount_underlying: number | null
  amount_tokens: number | null
  bid_amount: number | null
  implied_rate: number | null
  ledger_closed_at: string
  pool_id: string
}

async function main() {
  const connString = process.env.SMOOTHIE_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connString });

  const userAddress = 'GCBYMMOSIINFRGFEJKEUGNCUNAOUQYZ6DOQXA47P76UGCUQSXVNWWM3L';
  const eurcAsset = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

  // Get ALL events for this user involving EURC (as asset or bid_asset)
  const { rows: events } = await pool.query<EurcEventRow>(`
    SELECT
      action_type,
      asset_address,
      bid_asset,
      amount_underlying / 10000000.0 as amount_underlying,
      amount_tokens / 10000000.0 as amount_tokens,
      bid_amount / 10000000.0 as bid_amount,
      implied_rate,
      ledger_closed_at,
      pool_id
    FROM parsed_events
    WHERE user_address = $1
      AND (asset_address = $2 OR bid_asset = $2)
    ORDER BY ledger_closed_at ASC
  `, [userAddress, eurcAsset]);

  console.log('All EURC-related events for user:');
  console.log('================================');
  events.forEach((e, i) => {
    const assetShort = e.asset_address?.slice(0,10) || 'n/a';
    const bidShort = e.bid_asset?.slice(0,10) || 'n/a';
    console.log(`${i+1}. ${e.action_type} | asset: ${assetShort}... | bid: ${bidShort}... | underlying: ${e.amount_underlying} | tokens: ${e.amount_tokens} | bid_amt: ${e.bid_amount} | rate: ${e.implied_rate} | ${e.ledger_closed_at}`);
  });

  console.log('\n\nSummary by action_type:');
  const { rows: summary } = await pool.query(`
    SELECT
      action_type,
      COUNT(*) as count,
      SUM(amount_underlying / 10000000.0) as total_underlying,
      SUM(amount_tokens / 10000000.0) as total_tokens,
      SUM(bid_amount / 10000000.0) as total_bid_amount
    FROM parsed_events
    WHERE user_address = $1
      AND (asset_address = $2 OR bid_asset = $2)
    GROUP BY action_type
  `, [userAddress, eurcAsset]);
  console.table(summary);

  await pool.end();
}

main().catch(console.error);
