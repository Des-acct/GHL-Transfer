/**
 * workflows.js — Extracts all workflows from GHL.
 * Endpoint: GET /workflows/ (paginated)
 */

import { ghlFetchAll } from '../ghl-client.js';

export const MODULE_NAME = 'workflows';

export async function extract(locationId) {
    const records = await ghlFetchAll('/workflows/', { locationId }, {
        dataKey: 'workflows',
        limit: 100,
    });

    return {
        moduleName: MODULE_NAME,
        count: records.length,
        data: records,
    };
}
