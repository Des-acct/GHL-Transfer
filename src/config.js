/**
 * config.js — Loads and validates environment configuration.
 *
 * All GHL credentials are read from a local .env file.
 * No secrets are ever hardcoded or exposed to public endpoints.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const REQUIRED_VARS = ['GHL_API_TOKEN', 'GHL_LOCATION_ID'];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  const msg = `Missing required environment variables: ${missing.join(', ')}. Set them in Vercel dashboard → Settings → Environment Variables.`;
  console.error(`\n❌  ${msg}\n`);
  // Don't process.exit() — it kills Vercel serverless functions
  // throw so the import fails gracefully with a clear message
  if (process.env.VERCEL) {
    // On Vercel, let the app start but config will have empty values
    console.error('Running on Vercel without env vars — API calls will fail with clear errors.');
  } else {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Frozen config object
// ---------------------------------------------------------------------------
const config = Object.freeze({
  apiToken: process.env.GHL_API_TOKEN,
  locationId: process.env.GHL_LOCATION_ID,
  baseUrl: process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com',
  apiVersion: '2021-07-28',
});

export default config;
