/**
 * orchestrator.js — Ties all GHL extraction modules together.
 *
 * Runs each module sequentially (to respect rate limits),
 * saves results as JSON artifacts, and returns a summary report.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import config from './config.js';
import { getSessionRequestCount } from './rate-limiter.js';

// Import all extraction modules
import * as contacts from './modules/contacts.js';
import * as conversations from './modules/conversations.js';
import * as calendars from './modules/calendars.js';
import * as opportunities from './modules/opportunities.js';
import * as workflows from './modules/workflows.js';
import * as campaigns from './modules/campaigns.js';
import * as forms from './modules/forms.js';
import * as payments from './modules/payments.js';
import * as users from './modules/users.js';
import * as locations from './modules/locations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// All available modules, in recommended execution order
const ALL_MODULES = [
    locations,
    contacts,
    conversations,
    calendars,
    opportunities,
    workflows,
    campaigns,
    forms,
    payments,
    users,
];

/**
 * Run the full extraction.
 *
 * @param {object} opts
 * @param {string[]} [opts.selectedModules] — Filter to specific module names. If empty, runs all.
 * @param {boolean} [opts.dryRun] — If true, validate config + connection only.
 * @returns {Promise<object>} Summary report
 */
export async function runExtraction({ selectedModules = [], dryRun = false } = {}) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const exportDir = resolve(PROJECT_ROOT, 'exports', timestamp);

    // Determine which modules to run
    let modulesToRun = ALL_MODULES;
    if (selectedModules.length > 0) {
        const requested = selectedModules.map((m) => m.toLowerCase().trim());
        modulesToRun = ALL_MODULES.filter((mod) => requested.includes(mod.MODULE_NAME));
        const found = modulesToRun.map((m) => m.MODULE_NAME);
        const notFound = requested.filter((r) => !found.includes(r));
        if (notFound.length > 0) {
            console.log(chalk.yellow(`   ⚠  Unknown modules skipped: ${notFound.join(', ')}`));
        }
    }

    console.log(chalk.bold.cyan(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(chalk.bold.cyan(`  GHL Data Export — ${dryRun ? 'DRY RUN' : 'LIVE RUN'}`));
    console.log(chalk.bold.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(chalk.dim(`  Location ID:  ${config.locationId}`));
    console.log(chalk.dim(`  Modules:      ${modulesToRun.map((m) => m.MODULE_NAME).join(', ')}`));
    console.log(chalk.dim(`  Export dir:   ${exportDir}`));
    console.log(chalk.dim(`  Timestamp:    ${timestamp}`));
    console.log('');

    if (dryRun) {
        console.log(chalk.green(`  ✓  Configuration valid.`));
        console.log(chalk.green(`  ✓  ${modulesToRun.length} module(s) ready for extraction.`));
        console.log(chalk.dim(`\n  Dry run complete. No data was fetched or written.\n`));
        return { dryRun: true, modules: modulesToRun.map((m) => m.MODULE_NAME) };
    }

    // Create export directory
    mkdirSync(exportDir, { recursive: true });

    const results = [];
    const errors = [];

    // Run each module sequentially
    for (const mod of modulesToRun) {
        const modStart = Date.now();
        console.log(chalk.bold.white(`\n▸ Extracting: ${mod.MODULE_NAME.toUpperCase()}`));
        console.log(chalk.dim(`  ${'─'.repeat(50)}`));

        try {
            const result = await mod.extract(config.locationId);

            // Write per-module JSON
            const filePath = resolve(exportDir, `${result.moduleName}.json`);
            writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf-8');

            const elapsed = ((Date.now() - modStart) / 1000).toFixed(1);
            console.log(chalk.green(`  ✓  ${result.moduleName}: ${result.count} records exported (${elapsed}s)`));

            results.push({
                module: result.moduleName,
                count: result.count,
                file: filePath,
                elapsed: `${elapsed}s`,
                status: 'success',
                ...(result.totalEvents !== undefined && { totalEvents: result.totalEvents }),
                ...(result.pipelineCount !== undefined && { pipelineCount: result.pipelineCount }),
                ...(result.surveyCount !== undefined && { surveyCount: result.surveyCount }),
            });
        } catch (err) {
            const elapsed = ((Date.now() - modStart) / 1000).toFixed(1);
            console.error(chalk.red(`  ✗  ${mod.MODULE_NAME}: FAILED (${elapsed}s)`));
            console.error(chalk.red(`     ${err.message}`));
            errors.push({ module: mod.MODULE_NAME, error: err.message });
            results.push({
                module: mod.MODULE_NAME,
                count: 0,
                file: null,
                elapsed: `${elapsed}s`,
                status: 'failed',
                error: err.message,
            });
        }
    }

    // Write combined summary
    const summary = {
        exportedAt: new Date().toISOString(),
        locationId: config.locationId,
        totalModules: modulesToRun.length,
        successfulModules: results.filter((r) => r.status === 'success').length,
        failedModules: errors.length,
        totalRecords: results.reduce((sum, r) => sum + r.count, 0),
        totalApiRequests: getSessionRequestCount(),
        elapsedTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        modules: results,
        errors: errors.length > 0 ? errors : undefined,
    };

    const summaryPath = resolve(exportDir, '_summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

    return summary;
}
