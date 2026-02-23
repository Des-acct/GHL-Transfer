#!/usr/bin/env node

/**
 * trigger.js — Manual Trigger Entry Point
 *
 * Usage:
 *   node trigger.js                         Full export of all modules
 *   node trigger.js --dry-run               Validate config + list modules (no fetch)
 *   node trigger.js --modules contacts,calendars   Export only specific modules
 *
 * This is the ONLY entry point. Data export is NEVER automated — it is
 * always manually invoked by the developer.
 */

import chalk from 'chalk';
import { testConnection } from './src/ghl-client.js';
import { runExtraction } from './src/orchestrator.js';
import { getSessionRequestCount } from './src/rate-limiter.js';

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

const dryRun = args.includes('--dry-run');
let selectedModules = [];

const modulesIdx = args.indexOf('--modules');
if (modulesIdx !== -1 && args[modulesIdx + 1]) {
    selectedModules = args[modulesIdx + 1].split(',').map((m) => m.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------
console.log('');
console.log(chalk.bold.hex('#6C63FF')(`
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║    ⚡  GHL Data Export — Manual Trigger          ║
  ║                                                  ║
  ║    GoHighLevel API V2 · Private Integration      ║
  ║    Read-only copy · No data leaves this machine  ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
`));

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    try {
        // 1. Test connection
        console.log(chalk.dim('  Testing API connection...'));
        const connected = await testConnection();
        if (!connected) {
            console.error(chalk.red.bold('\n  ❌  Could not connect to GHL API.'));
            console.error(chalk.red('     Check your GHL_API_TOKEN and GHL_LOCATION_ID in .env\n'));
            process.exit(1);
        }
        console.log(chalk.green('  ✓  Authentication successful — API connection verified.\n'));

        // 2. Run extraction
        const summary = await runExtraction({ selectedModules, dryRun });

        // 3. Print results
        if (!dryRun) {
            printSummaryTable(summary);
        }

        console.log(chalk.green.bold('\n  ✅  Export complete.\n'));
        process.exit(0);
    } catch (err) {
        if (err.message?.includes('Daily rate limit')) {
            console.error(chalk.red.bold(`\n  ${err.message}\n`));
        } else {
            console.error(chalk.red.bold('\n  ❌  Export failed with error:'));
            console.error(chalk.red(`     ${err.message}\n`));
            if (process.env.DEBUG) {
                console.error(err.stack);
            }
        }
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// Summary Table
// ---------------------------------------------------------------------------
function printSummaryTable(summary) {
    console.log('');
    console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.cyan('  EXPORT SUMMARY'));
    console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log('');

    // Module results table
    const colModule = 18;
    const colCount = 10;
    const colTime = 10;
    const colStatus = 10;

    console.log(
        chalk.bold('  ' +
            'Module'.padEnd(colModule) +
            'Records'.padEnd(colCount) +
            'Time'.padEnd(colTime) +
            'Status'.padEnd(colStatus)
        )
    );
    console.log(chalk.dim('  ' + '─'.repeat(colModule + colCount + colTime + colStatus)));

    for (const mod of summary.modules) {
        const statusIcon = mod.status === 'success' ? chalk.green('✓') : chalk.red('✗');
        const countStr = mod.count.toLocaleString();
        console.log(
            '  ' +
            chalk.white(mod.module.padEnd(colModule)) +
            chalk.yellow(countStr.padEnd(colCount)) +
            chalk.dim(mod.elapsed.padEnd(colTime)) +
            statusIcon + ' ' + mod.status
        );
    }

    console.log('');
    console.log(chalk.dim('  ─'.repeat(25)));
    console.log(chalk.bold(`  Total records:      ${summary.totalRecords.toLocaleString()}`));
    console.log(chalk.bold(`  API requests:       ${summary.totalApiRequests}`));
    console.log(chalk.bold(`  Elapsed time:       ${summary.elapsedTime}`));
    console.log(chalk.bold(`  Modules OK/Total:   ${summary.successfulModules}/${summary.totalModules}`));

    if (summary.errors && summary.errors.length > 0) {
        console.log('');
        console.log(chalk.red.bold(`  ⚠  ${summary.errors.length} module(s) failed:`));
        for (const e of summary.errors) {
            console.log(chalk.red(`     • ${e.module}: ${e.error}`));
        }
    }
}

main();
