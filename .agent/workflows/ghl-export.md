---
description: Manually trigger a full or partial GHL data export
---

This workflow exports data from your GoHighLevel account via the GHL API V2.
It is a **read-only copy** — all original data stays in GHL untouched.

## Prerequisites
- `.env` file configured with `GHL_API_TOKEN` and `GHL_LOCATION_ID` (see `.env.example`)
- Dependencies installed (`npm install` in the GHL integration directory)

## Steps

### Option A: Full Export (all modules)
// turbo
1. Run `node trigger.js` from the `GHL integration` directory to export all data.

### Option B: Dry Run (validation only, no data fetched)
// turbo
2. Run `node trigger.js --dry-run` from the `GHL integration` directory.

### Option C: Selective Export (specific modules only)
// turbo
3. Run `node trigger.js --modules contacts,calendars,workflows` from the `GHL integration` directory.

## Available Modules
`contacts`, `conversations`, `calendars`, `opportunities`, `workflows`, `campaigns`, `forms`, `payments`, `users`, `locations`

## After Export
4. Review the JSON output files in `exports/<timestamp>/`.
5. The `_summary.json` file contains a complete overview of what was exported.
