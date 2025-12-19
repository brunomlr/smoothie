-- Migration: Add pegged_currency column to tokens table
-- Description: Stores what currency a token is pegged to (e.g., USDC is pegged to USD)
-- If a token is pegged to the user's selected display currency, we don't show the token amount

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS pegged_currency VARCHAR(10);

-- Update known pegged tokens
UPDATE tokens SET pegged_currency = 'USD' WHERE symbol IN ('USDC', 'USDT', 'DAI', 'BUSD', 'UST', 'FRAX', 'TUSD', 'USDP', 'GUSD', 'LUSD');
UPDATE tokens SET pegged_currency = 'EUR' WHERE symbol IN ('EURC', 'EURS', 'EURT', 'EUROC', 'agEUR', 'EURA');
UPDATE tokens SET pegged_currency = 'BRL' WHERE symbol IN ('BRZ', 'BRLA');
UPDATE tokens SET pegged_currency = 'ARS' WHERE symbol IN ('ARS');

-- Create index for pegged_currency lookup
CREATE INDEX IF NOT EXISTS idx_tokens_pegged_currency ON tokens(pegged_currency);
