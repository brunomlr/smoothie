/**
 * Dune Analytics API Client
 * Fetches query results from Dune Analytics
 */

const DUNE_API_BASE_URL = 'https://api.dune.com/api/v1';

export interface DuneQueryResult {
  execution_id: string;
  query_id: number;
  state: string;
  submitted_at: string;
  expires_at: string;
  execution_started_at?: string;
  execution_ended_at?: string;
  result?: {
    rows: Record<string, any>[];
    metadata: {
      column_names: string[];
      column_types: string[];
      row_count: number;
      result_set_bytes: number;
      total_row_count: number;
      total_result_set_bytes: number;
      datapoint_count: number;
      pending_time_millis: number;
      execution_time_millis: number;
    };
  };
}

/**
 * Fetches the latest results from a Dune query
 * @param queryId - The Dune query ID
 * @param apiKey - Dune API key (optional, will use env var if not provided)
 * @returns Query results
 */
export async function fetchDuneQueryResults(
  queryId: number,
  apiKey?: string
): Promise<DuneQueryResult> {
  const key = apiKey || process.env.DUNE_API_KEY;

  if (!key) {
    throw new Error('Dune API key not found');
  }

  const response = await fetch(
    `${DUNE_API_BASE_URL}/query/${queryId}/results`,
    {
      method: 'GET',
      headers: {
        'X-Dune-API-Key': key,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Dune API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  return data;
}

/**
 * Executes a Dune query and waits for results
 * @param queryId - The Dune query ID
 * @param apiKey - Dune API key (optional, will use env var if not provided)
 * @returns Query results
 */
export async function executeDuneQuery(
  queryId: number,
  apiKey?: string
): Promise<DuneQueryResult> {
  const key = apiKey || process.env.DUNE_API_KEY;

  if (!key) {
    throw new Error('Dune API key not found');
  }

  // Execute the query
  const executeResponse = await fetch(
    `${DUNE_API_BASE_URL}/query/${queryId}/execute`,
    {
      method: 'POST',
      headers: {
        'X-Dune-API-Key': key,
      },
    }
  );

  if (!executeResponse.ok) {
    const errorText = await executeResponse.text();
    throw new Error(
      `Dune API execute error (${executeResponse.status}): ${errorText}`
    );
  }

  const executeData = await executeResponse.json();
  const executionId = executeData.execution_id;

  // Poll for results
  let attempts = 0;
  const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max wait

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(
      `${DUNE_API_BASE_URL}/execution/${executionId}/results`,
      {
        method: 'GET',
        headers: {
          'X-Dune-API-Key': key,
        },
      }
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(
        `Dune API status error (${statusResponse.status}): ${errorText}`
      );
    }

    const statusData = await statusResponse.json();

    if (statusData.state === 'QUERY_STATE_COMPLETED') {
      return statusData;
    }

    if (statusData.state === 'QUERY_STATE_FAILED') {
      throw new Error('Dune query execution failed');
    }

    // Wait 2 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  throw new Error('Dune query execution timeout');
}
