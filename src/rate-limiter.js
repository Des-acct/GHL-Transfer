/**
 * rate-limiter.js — Monitors GHL API rate-limit headers and pauses execution
 * when limits are approached, preventing service interruption.
 *
 * GHL Limits:
 *   • Burst:  100 requests per 10 seconds
 *   • Daily:  200,000 requests per day
 *
 * Headers read:
 *   X-RateLimit-Remaining              — burst remaining
 *   X-RateLimit-Interval-Milliseconds  — burst window length
 *   X-RateLimit-Max                    — max per burst window
 *   X-RateLimit-Limit-Daily            — total daily limit
 *   X-RateLimit-Daily-Remaining        — daily remaining
 */

import chalk from 'chalk';

// Thresholds
const BURST_PAUSE_THRESHOLD = 5;    // pause when ≤5 burst requests remain
const DAILY_ABORT_THRESHOLD = 100;  // abort when ≤100 daily requests remain

// Track state
let totalRequests = 0;

/**
 * Reads rate-limit headers from a fetch Response and sleeps if we are
 * approaching the burst limit. Aborts if daily limit is nearly exhausted.
 *
 * @param {Response} response — fetch Response object
 * @returns {{ burstRemaining: number, dailyRemaining: number, paused: boolean }}
 */
export async function processRateLimitHeaders(response) {
    totalRequests++;

    const burstRemaining = parseInt(response.headers.get('x-ratelimit-remaining') ?? '100', 10);
    const burstInterval = parseInt(response.headers.get('x-ratelimit-interval-milliseconds') ?? '10000', 10);
    const burstMax = parseInt(response.headers.get('x-ratelimit-max') ?? '100', 10);
    const dailyLimit = parseInt(response.headers.get('x-ratelimit-limit-daily') ?? '200000', 10);
    const dailyRemaining = parseInt(response.headers.get('x-ratelimit-daily-remaining') ?? '200000', 10);

    let paused = false;

    // Log every request's rate-limit status
    const burstPct = ((burstRemaining / burstMax) * 100).toFixed(0);
    const dailyPct = ((dailyRemaining / dailyLimit) * 100).toFixed(0);
    console.log(
        chalk.dim(`   ⏱  Rate Limit — Burst: ${burstRemaining}/${burstMax} (${burstPct}%)  |  Daily: ${dailyRemaining.toLocaleString()}/${dailyLimit.toLocaleString()} (${dailyPct}%)  |  Session requests: ${totalRequests}`)
    );

    // --- Daily limit check (abort) ---
    if (dailyRemaining <= DAILY_ABORT_THRESHOLD) {
        console.error(
            chalk.red.bold(`\n🚫  Daily rate limit nearly exhausted! Only ${dailyRemaining} requests remaining.`) +
            chalk.red(`\n   Aborting to prevent service interruption. Try again tomorrow.\n`)
        );
        throw new Error(`Daily rate limit nearly exhausted (${dailyRemaining} remaining). Aborting.`);
    }

    // --- Burst limit check (pause) ---
    if (burstRemaining <= BURST_PAUSE_THRESHOLD) {
        const waitMs = burstInterval + 500; // wait full interval + 500ms buffer
        console.log(
            chalk.yellow(`   ⏸  Burst limit approaching (${burstRemaining} remaining). Pausing for ${(waitMs / 1000).toFixed(1)}s...`)
        );
        await sleep(waitMs);
        paused = true;
        console.log(chalk.green(`   ▶  Resumed after rate-limit pause.`));
    }

    return { burstRemaining, dailyRemaining, paused };
}

/**
 * Returns the total number of API requests made in this session.
 */
export function getSessionRequestCount() {
    return totalRequests;
}

/**
 * Resets the session request counter (useful for testing).
 */
export function resetSessionCount() {
    totalRequests = 0;
}

/**
 * Promise-based sleep helper.
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
