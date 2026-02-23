/**
 * opportunities.js — Extracts pipelines and opportunities from GHL.
 * Endpoints:
 *   GET /opportunities/pipelines   — list pipelines
 *   GET /opportunities/search      — search opportunities (paginated)
 */

import { ghlFetch, ghlFetchAll } from '../ghl-client.js';
import chalk from 'chalk';

export const MODULE_NAME = 'opportunities';

export async function extract(locationId) {
    // 1. Fetch all pipelines
    const pipelinesResponse = await ghlFetch('/opportunities/pipelines', { locationId });
    const pipelines = pipelinesResponse.pipelines || pipelinesResponse.data || [];

    console.log(chalk.dim(`   🔀  Found ${pipelines.length} pipelines. Fetching opportunities...`));

    // 2. Fetch opportunities (across all pipelines)
    let allOpportunities = [];
    for (const pipeline of pipelines) {
        try {
            const opps = await ghlFetchAll('/opportunities/search', {
                location_id: locationId,
                pipeline_id: pipeline.id,
            }, {
                dataKey: 'opportunities',
                limit: 100,
            });
            allOpportunities.push(...opps);
        } catch (err) {
            console.log(chalk.yellow(`   ⚠  Could not fetch opportunities for pipeline "${pipeline.name || pipeline.id}": ${err.message}`));
        }
    }

    return {
        moduleName: MODULE_NAME,
        count: allOpportunities.length,
        pipelineCount: pipelines.length,
        data: {
            pipelines,
            opportunities: allOpportunities,
        },
    };
}
