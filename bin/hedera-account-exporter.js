#!/usr/bin/env node

import { program, Option } from 'commander';
import figlet from 'figlet';
import Handlebars from 'handlebars';

import packageJson from '../package.json' with { type: 'json' }
import { Forex } from "../src/exchange-rate.js";
import { MirrorNodeClient } from "../src/mirror-node-client.js";
import { csv } from '../src/csv.js';
import { fmt } from '../src/fmt.js';
import { getTransfers } from "../src/index.js";
import { readFileSync, writeFileSync } from 'fs';

const symbols = {
    HBAR: 'ℏ',
    USD: '$',
    CHF: '₣',
};

const diffFormat = new Intl.NumberFormat('en-CH', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
});

const currencyFormat = new Intl.NumberFormat('en-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

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
    .addOption(new Option('-c, --currencies <symbols...>', 'specify currency exchange rates').choices(['USD', 'CHF']).default([], 'only HBAR'))
    .addOption(new Option('-s, --summary', 'display total summary'))
    .addOption(new Option('--html', 'display report as HTML'))
    .addOption(new Option('--hashscan', 'display transaction IDs as links to Hashscan (only applicable when output is CSV)').conflicts('summary'))
    .argument('<accounts...>')
    .showHelpAfterError()
    .parse();
const opts = cmd.opts();

const tss = await main(cmd.args, opts.currencies);

if (opts.summary) {
    console.info(figlet.textSync('Hedera Account Exporter'));
    console.table(Object.fromEntries(Object.entries(tss).map(
        ([account, { total, balance }]) => [
            account, {
                Total: 'ℏ ' + fmt(total),
                Balance: 'ℏ ' + fmt(balance),
                Status: total === balance ? '✔' : '⍻',
            }
        ]
    )));
} else {
    const table = Object.values(tss).flatMap(ts => ts.transfers).map(t => ({
        // ...t,
        date: t.date,
        Date: t.date.toLocaleDateString('en-CH', { timeZone: 'Europe/Zurich' }),
        Account: t.account,
        'Transaction ID': (opts.hashscan ? 'https://hashscan.io/mainnet/transaction/' : '') + t.transactionId,
        transactionId: t.transactionId,
        amount: currencyFormat.format(fmt(t.amount)),
        accum: currencyFormat.format(fmt(t.accum)),
        balanceAt: currencyFormat.format(fmt(t.balanceAt)),
        diff: diffFormat.format(fmt(t.diff)),
        remarks: t.remarks,
        ...Object.fromEntries(/**@type{string[]}*/(opts.currencies).flatMap(c => [
            [`HBAR-${c}-Rate`, t.values[c].rate],
            [`HBAR-${c}-Amount`, t.values[c].amount],
        ])),
        values: Object.fromEntries(
            Object
                .entries(t.values)
                .map(([currency, { rate, amount }]) => [
                    currency, {
                        rate: rate.toFixed(4),
                        amount: currencyFormat.format(amount.toString()),
                    }
                ])
        ),
    }));

    if (opts.html) {

        // {{#each ../currencies}}
        // <td align="right">{{ lookup ../this this }}</td>
        // <td align="right">{{ lookup ../this this }}</td>
        // {{/each}}

        const groups = Object.groupBy(table, ({ date }) => date.getFullYear() + '-' + (date.getMonth() + 1));
        console.log(groups);
        const html = readFileSync('./template.html', 'utf-8');
        const template = Handlebars.compile(html);
        writeFileSync('output.html', template({ groups: groups, currencies: opts.currencies, symbols }));
    } else {
        process.stdout.write(csv(table));
    }
}
