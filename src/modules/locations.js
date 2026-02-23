/**
 * locations.js — Extracts location (sub-account) details from GHL.
 * Endpoint: GET /locations/{locationId}
 *
 * Also fetches custom fields, custom values, tags, and other metadata.
 */

import { ghlFetch } from '../ghl-client.js';
import chalk from 'chalk';

export const MODULE_NAME = 'locations';

export async function extract(locationId) {
    // 1. Location details
    const locationResponse = await ghlFetch(`/locations/${locationId}`);
    const location = locationResponse.location || locationResponse;

    const result = {
        location,
        customFields: [],
        customValues: [],
        tags: [],
    };

    // 2. Custom Fields
    try {
        const cfResponse = await ghlFetch(`/locations/${locationId}/customFields`);
        result.customFields = cfResponse.customFields || cfResponse.data || [];
        console.log(chalk.dim(`   🏷  Fetched ${result.customFields.length} custom fields.`));
    } catch (err) {
        console.log(chalk.yellow(`   ⚠  Could not fetch custom fields: ${err.message}`));
    }

    // 3. Custom Values
    try {
        const cvResponse = await ghlFetch(`/locations/${locationId}/customValues`);
        result.customValues = cvResponse.customValues || cvResponse.data || [];
        console.log(chalk.dim(`   📌  Fetched ${result.customValues.length} custom values.`));
    } catch (err) {
        console.log(chalk.yellow(`   ⚠  Could not fetch custom values: ${err.message}`));
    }

    // 4. Tags
    try {
        const tagsResponse = await ghlFetch(`/locations/${locationId}/tags`);
        result.tags = tagsResponse.tags || tagsResponse.data || [];
        console.log(chalk.dim(`   🏷  Fetched ${result.tags.length} tags.`));
    } catch (err) {
        console.log(chalk.yellow(`   ⚠  Could not fetch tags: ${err.message}`));
    }

    return {
        moduleName: MODULE_NAME,
        count: 1,
        data: result,
    };
}
