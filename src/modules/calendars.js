/**
 * calendars.js — Extracts all calendars and their events from GHL.
 * Endpoints:
 *   GET /calendars/         — list calendars
 *   GET /calendars/events   — list events per calendar
 */

import { ghlFetch, ghlFetchAll } from '../ghl-client.js';
import chalk from 'chalk';

export const MODULE_NAME = 'calendars';

export async function extract(locationId) {
    // 1. Fetch all calendars
    const calendarsResponse = await ghlFetch('/calendars/', { locationId });
    const calendars = calendarsResponse.calendars || calendarsResponse.data || [];

    console.log(chalk.dim(`   📅  Found ${calendars.length} calendars. Fetching events...`));

    // 2. Fetch events for each calendar
    for (const cal of calendars) {
        try {
            const events = await ghlFetchAll('/calendars/events', {
                locationId,
                calendarId: cal.id,
            }, {
                dataKey: 'events',
                limit: 100,
            });
            cal.events = events;
            cal.eventCount = events.length;
        } catch (err) {
            console.log(chalk.yellow(`   ⚠  Could not fetch events for calendar "${cal.name || cal.id}": ${err.message}`));
            cal.events = [];
            cal.eventCount = 0;
        }
    }

    const totalEvents = calendars.reduce((sum, c) => sum + (c.eventCount || 0), 0);

    return {
        moduleName: MODULE_NAME,
        count: calendars.length,
        totalEvents,
        data: calendars,
    };
}
