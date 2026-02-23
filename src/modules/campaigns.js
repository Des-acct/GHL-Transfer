/**
 * campaigns.js — Extracts all campaigns from GHL.
 * Endpoint: GET /campaigns/ (paginated)
 */

import { ghlFetchAll } from '../ghl-client.js';

export const MODULE_NAME = 'campaigns';

export async function extract(locationId) {
    const records = await ghlFetchAll('/campaigns/', { locationId }, {
        dataKey: 'campaigns',
        limit: 100,
    });

    return {
        moduleName: MODULE_NAME,
        count: records.length,
        data: records,
    };
}
