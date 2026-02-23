/**
 * contacts.js — Extracts all contacts from GHL.
 * Endpoint: GET /contacts/ (paginated)
 */

import { ghlFetchAll } from '../ghl-client.js';

export const MODULE_NAME = 'contacts';

export async function extract(locationId) {
    const records = await ghlFetchAll('/contacts/', { locationId }, {
        dataKey: 'contacts',
        limit: 100,
    });

    return {
        moduleName: MODULE_NAME,
        count: records.length,
        data: records,
    };
}
