/**
 * payments.js — Extracts orders, subscriptions, transactions, and invoices from GHL.
 * Endpoints:
 *   GET /payments/orders          — list orders
 *   GET /payments/subscriptions   — list subscriptions
 *   GET /payments/transactions    — list transactions
 *   GET /invoices/                — list invoices
 */

import { ghlFetch, ghlFetchAll } from '../ghl-client.js';
import chalk from 'chalk';

export const MODULE_NAME = 'payments';

export async function extract(locationId) {
    const result = {
        orders: [],
        subscriptions: [],
        transactions: [],
        invoices: [],
    };

    // 1. Orders
    try {
        result.orders = await ghlFetchAll('/payments/orders', { locationId }, {
            dataKey: 'orders',
            limit: 100,
        });
        console.log(chalk.dim(`   💳  Fetched ${result.orders.length} orders.`));
    } catch (err) {
        console.log(chalk.yellow(`   ⚠  Could not fetch orders: ${err.message}`));
    }

    // 2. Subscriptions
    try {
        result.subscriptions = await ghlFetchAll('/payments/subscriptions', { locationId }, {
            dataKey: 'subscriptions',
            limit: 100,
        });
        console.log(chalk.dim(`   🔄  Fetched ${result.subscriptions.length} subscriptions.`));
    } catch (err) {
        console.log(chalk.yellow(`   ⚠  Could not fetch subscriptions: ${err.message}`));
    }

    // 3. Transactions
    try {
        result.transactions = await ghlFetchAll('/payments/transactions', { locationId }, {
            dataKey: 'transactions',
            limit: 100,
        });
        console.log(chalk.dim(`   📊  Fetched ${result.transactions.length} transactions.`));
    } catch (err) {
        console.log(chalk.yellow(`   ⚠  Could not fetch transactions: ${err.message}`));
    }

    // 4. Invoices
    try {
        result.invoices = await ghlFetchAll('/invoices/', { locationId }, {
            dataKey: 'invoices',
            limit: 100,
        });
        console.log(chalk.dim(`   🧾  Fetched ${result.invoices.length} invoices.`));
    } catch (err) {
        console.log(chalk.yellow(`   ⚠  Could not fetch invoices: ${err.message}`));
    }

    const totalCount = result.orders.length + result.subscriptions.length +
        result.transactions.length + result.invoices.length;

    return {
        moduleName: MODULE_NAME,
        count: totalCount,
        data: result,
    };
}
