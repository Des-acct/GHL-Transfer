/**
 * conversations.js — Extracts all conversations from GHL.
 * Endpoint: GET /conversations/search (paginated)
 */

import { ghlFetchAll } from '../ghl-client.js';

export const MODULE_NAME = 'conversations';

export async function extract(locationId) {
    const records = await ghlFetchAll('/conversations/search', { locationId }, {
        dataKey: 'conversations',
        limit: 100,
    });

    return {
        moduleName: MODULE_NAME,
        count: records.length,
        data: records,
    };
}
