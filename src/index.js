import assert from 'assert/strict';

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
                remarks: t.amount < 50_000n ? 'Probably Spam' : '',
                transactionId: tx.transaction_id,
                accum: 0n,
                balanceAt: 0n,
                diff: 0n,
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
            /**@type{import('./hbar.js').Hbar}*/(t)[`HBAR-${currency}`] = data.amount;
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
