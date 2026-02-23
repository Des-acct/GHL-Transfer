/**
 * users.js — Extracts all users from GHL.
 * Endpoint: GET /users/ (by locationId)
 */

import { ghlFetch } from '../ghl-client.js';

export const MODULE_NAME = 'users';

export async function extract(locationId) {
    const response = await ghlFetch('/users/', { locationId });
    const records = response.users || response.data || [];

    return {
        moduleName: MODULE_NAME,
        count: records.length,
        data: records,
    };
}
