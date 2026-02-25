/**
 * ghl-client.js — Authenticated HTTP client for GoHighLevel API V2.
 *
 * Features:
 *   • Bearer token authentication via Private Integration Token
 *   • API version header (Version: 2021-07-28)
 *   • Automatic rate-limit monitoring after every request
 *   • Pagination helpers for list endpoints
 *   • Retry on 429 (Too Many Requests) with backoff
 *   • Descriptive error messages
 */

import config from './config.js';
import { processRateLimitHeaders } from './rate-limiter.js';
import chalk from 'chalk';

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 5000;

/**
 * Core fetch wrapper with auth headers and rate-limit handling.
 *
 * @param {string} path — API path (e.g. "/contacts/")
 * @param {Record<string, string>} [params] — URL query parameters
 * @param {object} [options] — Additional fetch options
 * @returns {Promise<object>} Parsed JSON response body
 */
export async function ghlFetch(path, params = {}, options = {}) {
    const url = new URL(path, config.baseUrl);
    Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
            url.searchParams.set(key, String(val));
        }
    });

    const headers = {
        'Authorization': `Bearer ${config.apiToken}`,
        'Version': config.apiVersion,
        'Content-Type': 'application/json',
        ...options.headers,
    };

    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url.toString(), {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            // Process rate-limit headers (may pause if threshold hit)
            await processRateLimitHeaders(response);

            // Handle 429 — Too Many Requests
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('retry-after') ?? '10', 10);
                const waitMs = retryAfter * 1000;
                console.log(
                    chalk.yellow(`   ⚠  429 Too Many Requests. Waiting ${retryAfter}s before retry (attempt ${attempt}/${MAX_RETRIES})...`)
                );
                await sleep(waitMs);
                continue;
            }

            // Handle non-OK responses
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(
                    `GHL API Error [${response.status} ${response.statusText}]\n` +
                    `   URL: ${url.toString()}\n` +
                    `   Body: ${errorBody.slice(0, 500)}`
                );
            }

            return await response.json();
        } catch (err) {
            lastError = err;
            if (attempt < MAX_RETRIES && err.message?.includes('429')) {
                continue;
            }
            if (attempt < MAX_RETRIES && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
                console.log(chalk.yellow(`   ⚠  Network error (${err.code}). Retrying in ${RETRY_BACKOFF_MS / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`));
                await sleep(RETRY_BACKOFF_MS);
                continue;
            }
            throw err;
        }
    }

    throw lastError;
}

/**
 * Fetches all pages of a paginated GHL endpoint.
 *
 * GHL V2 pagination varies by endpoint. This handles the common patterns:
 *   Pattern A: Uses `meta.startAfterId` / `meta.startAfter` for cursor-based
 *   Pattern B: Uses `meta.nextPageUrl` or `meta.total` + `skip`/`limit`
 *
 * @param {string} path — API path
 * @param {Record<string, string>} params — Query params (locationId, etc.)
 * @param {object} opts
 * @param {string} opts.dataKey — Key in response containing the array (e.g. "contacts")
 * @param {number} [opts.limit=100] — Page size
 * @param {number} [opts.maxPages=100] — Safety cap on number of pages
 * @returns {Promise<object[]>} All records across pages
 */
export async function ghlFetchAll(path, params = {}, { dataKey, limit, maxPages = 100 } = {}) {
    const allRecords = [];
    let page = 0;
    let cursor = undefined;
    let hasMore = true;

    while (hasMore && page < maxPages) {
        page++;
        const queryParams = { ...params };
        if (limit) queryParams.limit = String(limit);

        // Cursor-based pagination
        if (cursor) {
            queryParams.startAfterId = cursor;
        } else if (page > 1) {
            // Skip/offset pagination fallback
            queryParams.skip = String((page - 1) * limit);
        }

        console.log(chalk.dim(`   📄  Fetching page ${page}${cursor ? ` (cursor: ${cursor.slice(0, 8)}...)` : ''}...`));

        const data = await ghlFetch(path, queryParams);

        // Extract records
        const records = data[dataKey] || data.data || [];
        allRecords.push(...records);

        // Determine if there are more pages
        if (data.meta) {
            cursor = data.meta.startAfterId || data.meta.startAfter || undefined;
            const total = data.meta.total;
            if (cursor) {
                hasMore = records.length === limit;
            } else if (total !== undefined) {
                hasMore = allRecords.length < total;
            } else {
                hasMore = records.length === limit;
            }
        } else if (data.traceId && records.length === 0) {
            // GHL sometimes returns traceId with empty results at end
            hasMore = false;
        } else {
            hasMore = records.length === limit;
        }

        if (records.length === 0) {
            hasMore = false;
        }
    }

    if (page >= maxPages) {
        console.log(chalk.yellow(`   ⚠  Reached max page limit (${maxPages}). Some records may not be fetched.`));
    }

    return allRecords;
}

/**
 * Tests the API connection by fetching location info.
 * @returns {Promise<boolean>} true if auth is successful
 */
export async function testConnection() {
    try {
        const data = await ghlFetch(`/locations/${config.locationId}`);
        return !!(data && (data.location || data.id || data.name));
    } catch (err) {
        console.error(chalk.red(`   ❌  Connection test failed: ${err.message}`));
        return false;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
