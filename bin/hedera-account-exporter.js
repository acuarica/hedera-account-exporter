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
 * @param {string} hashscan
 */
async function main(accounts, currencies, hashscan) {
    const mirrorNodeClient = new MirrorNodeClient();
    const forex = new Forex();

    const tss = await Promise.all(accounts.map(account => getTransfers(account, currencies, mirrorNodeClient, forex)));

    mirrorNodeClient.httpCache.save();
    forex.httpCache.save();

    const table = tss.flatMap(ts => ts.transfers).map(t => ({
        Date: t.date.toLocaleDateString('en-CH', { timeZone: 'Europe/Zurich' }),
        Account: t.account,
        'Transaction ID': hashscan + t.transactionId,
        'Amount (HBAR)': fmt(t.amount),
        'Accum (HBAR)': fmt(t.accum),
        'Balance at (HBAR)': fmt(t.balanceAt),
        'Diff (HBAR)': fmt(t.diff),
        'HBAR-USD Rate': t['HBAR-USD'],
        'HBAR-CHF Rate': t['HBAR-CHF'],
    }));

    process.stdout.write(csv(table));
}

const cmd = program
    .description(packageJson.description)
    .version(packageJson.version)
    .addOption(new Option('-c, --currencies <symbols...>', 'specify currency exchange rates').choices(['USD', 'CHF']))
    .option('--hashscan', 'display transaction IDs as links to Hashscan')
    .argument('<accounts...>')
    .showHelpAfterError()
    .parse();

const { currencies = [], hashscan } = cmd.opts();
await main(cmd.args, currencies, hashscan ? 'https://hashscan.io/mainnet/transaction/' : '');

// const currencies = /**@type{const}*/(['USD', 'CHF']);
// const accounts = ['0.0.4601352', '0.0.5007959'];

// console.log(t1.balances);
// console.log(t2.balances);
// console.log(Number(t1.total) / ONE_HBAR);
// console.log(Number(t2.total) / ONE_HBAR);
// console.log(Number(t1.total + t2.total) / ONE_HBAR);