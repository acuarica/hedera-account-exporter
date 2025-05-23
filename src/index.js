import assert from 'assert/strict';

import { Decimal } from 'decimal.js';

const ONE_HBAR = new Decimal('100_000_000');

/**
 * @param {bigint} n 
 * @returns {bigint}
 */
const abs = n => n < 0 ? -n : n;

/**
 * 
 * @param {string} accountId 
 * @param {readonly ('USD' | 'CHF')[]} currencies 
 * @param {import('./mirror-node-client.js').MirrorNodeClient} mirrorNodeClient
 * @param {import('./exchange-rate.js').Forex} forex
 */
export async function getTransfers(accountId, currencies, mirrorNodeClient, forex) {
    const txs = (await mirrorNodeClient.getTransactionsOf(accountId)).map(tx => {
        assert(tx.charged_tx_fee > 0, 'Charged transaction fee cannot be negative');
        assert(new Set(tx.transfers.map(t => t.account)).size === tx.transfers.length, 'transfers has repeated account');
        assert(new Set(tx.staking_reward_transfers.map(t => t.account)).size === tx.staking_reward_transfers.length, 'staking_reward_transfers has repeated account');
        assert(tx.transfers.length >= 2, 'transfers is empty or single transfer');

        const transfers = tx.transfers.map(t => ({
            account: t.account,
            amount: BigInt(t.amount),
            remarks: '',
        }));
        const netAmount = transfers.filter(t => t.amount > 0n).reduce((p, c) => p + c.amount, 0n) - BigInt(tx.charged_tx_fee);
        assert(netAmount > 0n, 'Net amount cannot be negative');

        let balance = 0n;

        const rewards = [];
        for (const t of transfers) {
            assert(t.amount !== 0n, 'tx amount is zero');
            balance += t.amount;
            const stakingRewards = tx.staking_reward_transfers.filter(s => s.account === t.account);
            if (stakingRewards.length > 0) {
                assert(stakingRewards.length === 1);
                const amount = BigInt(stakingRewards[0].amount);
                t.amount -= amount;
                rewards.push({ account: t.account, amount, remarks: 'Staking Reward' });
            }
            t.remarks = abs(t.amount) < 50_000n ? 'Probably Spam' : '';
        }

        assert(balance === 0n, 'tx balance is not zero');
        return {
            transfers: [...transfers, ...rewards],
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
                remarks: t.remarks,
                transactionId: tx.transaction_id,
                accum: 0n,
                balanceAt: 0n,
                diff: 0n,
                values: /**@type{import('./hbar.js').HbarValues}*/({}),
            })),
        ])
        .filter(t => t.account === accountId);

    let prevDate = new Date(2024, 1, 1);
    let accum = 0n;
    for (const t of transfers) {
        assert(prevDate <= t.date, `Not sorted ${prevDate} / ${t.date}`);
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

            const rate = new Decimal(data.amount);
            const amount = rate.mul(new Decimal(Number(t.amount)).div(ONE_HBAR));
            t.values[currency] = { rate, amount };
        }
    }

    const total = accum;
    const balances = await mirrorNodeClient.getBalancesOf(accountId);
    assert(balances.length === 1);
    assert(balances[0].account === accountId);

    return {
        total,
        balance: BigInt(balances[0].balance),
        transfers,
    };
}
