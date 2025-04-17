#!/usr/bin/env node

import { program, Option } from 'commander';

import packageJson from '../package.json' with { type: 'json' }
import { Forex } from "../src/exchange-rate.js";
import { MirrorNodeClient } from "../src/mirror-node-client.js";
import { csv } from '../src/csv.js';
import { fmt } from '../src/fmt.js';
import { getTransfers } from "../src/index.js";

/**
 * 
 * @param {string[]} accounts 
 * @param {readonly ('USD' | 'CHF')[]} currencies 
 */
async function main(accounts, currencies) {
    const mirrorNodeClient = new MirrorNodeClient();
    const forex = new Forex();

    const tss = await Promise.all(accounts.map(async account => /**@type{const}*/([
        account, await getTransfers(account, currencies, mirrorNodeClient, forex)
    ])));

    mirrorNodeClient.httpCache.save();
    forex.httpCache.save();

    return Object.fromEntries(tss);
}

const cmd = program
    .description(packageJson.description)
    .version(packageJson.version)
    .addOption(new Option('-c, --currencies <symbols...>', 'specify currency exchange rates').choices(['USD', 'CHF']))
    .option('--hashscan', 'display transaction IDs as links to Hashscan')
    .option('--summary', 'display total summary')
    .argument('<accounts...>')
    .showHelpAfterError()
    .parse();

const { currencies = [], hashscan, summary } = cmd.opts();
const tss = await main(cmd.args, currencies);

if (summary) {
    // let total = 0n;
    // for (const ts of tss) {
    //     console.info(ts.balance);
    //     console.info(fmt(ts.total));
    //     total += ts.total;
    // }
    // console.info(total);
    console.table(Object.fromEntries(Object.entries(tss).map(
        ([account, { total, balance }]) => [
            account, {
                Total: 'ℏ ' + fmt(total),
                Balance: 'ℏ ' + fmt(balance),
            }
        ]
    )));
} else {
    const table = Object.values(tss).flatMap(ts => ts.transfers).map(t => ({
        Date: t.date.toLocaleDateString('en-CH', { timeZone: 'Europe/Zurich' }),
        Account: t.account,
        'Transaction ID': (hashscan ? 'https://hashscan.io/mainnet/transaction/' : '') + t.transactionId,
        'Amount (HBAR)': fmt(t.amount),
        'Accum (HBAR)': fmt(t.accum),
        'Balance at (HBAR)': fmt(t.balanceAt),
        'Diff (HBAR)': fmt(t.diff),
        Remarks: t.remarks,
        'HBAR-USD Rate': t['HBAR-USD'],
        'HBAR-CHF Rate': t['HBAR-CHF'],
    }));
    process.stdout.write(csv(table));
}
