
import assert from 'assert/strict';

import { MirrorNodeClient } from './mirror-node-client.js';
import { csv } from './csv.js';
import { fmt } from './fmt.js';
import { Forex } from './exchange-rate.js';

const mirrorNodeClient = new MirrorNodeClient();
const forex = new Forex();

/**
 * 
 * @param {string} accountId 
 * @param {readonly ('USD' | 'CHF')[]} currencies 
 */
async function getTransfers(accountId, currencies) {
    const txs = (await mirrorNodeClient.getTransactionsOf(accountId)).map(tx => {
        assert(tx.charged_tx_fee > 0, 'Charged transaction fee cannot be negative');
        assert(new Set(tx.transfers.map(t => t.account)).size === tx.transfers.length, 'transfers has repeated account');
        assert(new Set(tx.staking_reward_transfers.map(t => t.account)).size === tx.staking_reward_transfers.length, 'staking_reward_transfers has repeated account');
        assert(tx.transfers.length >= 2, 'transfers is empty or single transfer');

        const transfers = tx.transfers.map(t => ({ ...t, amount: BigInt(t.amount) }));
        const netAmount = transfers.filter(t => t.amount > 0n).reduce((p, c) => p + c.amount, 0n) - BigInt(tx.charged_tx_fee);
        assert(netAmount > 0n, 'Net amount cannot be negative');

        let balance = 0n;

        for (const t of transfers) {
            assert(t.amount !== 0n, 'tx amount is zero');
            balance += t.amount;
        }

        assert(balance === 0n, 'tx balance is not zero');
        return {
            transfers,
            consensus_timestamp: tx.consensus_timestamp,
            transaction_id: tx.transaction_id,
        };
    });

    const transfers = txs
        .flatMap(tx => [
            ...tx.transfers.map(t => ({
                date: new Date(Number(tx.consensus_timestamp) * 1000),
                account: t.account,
                amount: t.amount,
                transactionId: tx.transaction_id,
                accum: 0n,
                balanceAt: 0n,
                diff: 0n,
                'HBAR-USD': '',
                'HBAR-CHF': '',
            })),
            // ...tx.staking_reward_transfers.map(t => ({ ...t, transaction_id: tx.transaction_id })),
        ])
        .filter(t => t.account === accountId);

    let prevDate = new Date(2024, 1, 1);
    let accum = 0n;
    for (const t of transfers) {
        assert(prevDate < t.date);
        const b = await mirrorNodeClient.getBalancesOfAt(accountId, t.date.getTime() / 1000);
        prevDate = t.date;
        t.accum = accum;
        accum += t.amount;
        t.balanceAt = BigInt(b[0].balance);
        t.diff = t.accum - t.balanceAt;

        for (const currency of currencies) {
            const { data } = await forex.getExchangeRate(currency, t.date);
            assert(data.base === 'HBAR');
            assert(data.currency === currency);
            t[`HBAR-${currency}`] = data.amount;
        }
    }

    const total = transfers.reduce((p, c) => p + c.amount, 0n);
    const balances = await mirrorNodeClient.getBalancesOf(accountId);

    return { total, balances, transfers };
}

const currencies = /**@type{const}*/(['USD', 'CHF']);
const accounts = ['0.0.4601352', '0.0.5007959'];

const tss = await Promise.all(accounts.map(account => getTransfers(account, currencies)));

mirrorNodeClient.httpCache.save();
forex.httpCache.save();

const table = tss.flatMap(ts => ts.transfers).map(t => ({
    Date: t.date.toISOString().slice(0, 10),
    Account: t.account,
    'Transaction ID': t.transactionId,
    Amount: fmt(t.amount),
    Accum: fmt(t.accum),
    'Balance at': fmt(t.balanceAt),
    Diff: fmt(t.diff),
    'HBAR-USD': t['HBAR-USD'],
    'HBAR-CHF': t['HBAR-CHF'],
}));

process.stdout.write(csv(table));
