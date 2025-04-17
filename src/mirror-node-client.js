import { HttpCache } from './get.js';

/**
 * 
 */
export class MirrorNodeClient {
    constructor(baseUrl = 'https://mainnet-public.mirrornode.hedera.com') {
        this.baseUrl = baseUrl;
        this.httpCache = new HttpCache('mirror-node-client.cache.json');
    }

    /**
     * @param {string} accountId 
     * @param {string} transactionType
     * @returns {Promise<import('./global.js').Transaction[]>}
     */
    getTransactionsOf(accountId, transactionType = 'CRYPTOTRANSFER') {
        const url = `${this.baseUrl}/api/v1/transactions?account.id=${accountId}&order=asc&transactiontype=${transactionType}&result=success&limit=100`;
        return this.#getAll(url, 'transactions');
    }

    /**
     * @param {string} accountId 
     */
    getBalancesOf(accountId) {
        const url = `${this.baseUrl}/api/v1/balances?account.id=${accountId}&order=asc&limit=100`;
        return this.#getAll(url, 'balances');
    }

    /**
     * @param {string} accountId 
     * @param {number} timestamp;
     */
    getBalancesOfAt(accountId, timestamp) {
        const url = `${this.baseUrl}/api/v1/balances?account.id=${accountId}&timestamp=${timestamp}&order=asc&limit=100`;
        return this.#getAll(url, 'balances');
    }

    /**
     * 
     * @param {string} url 
     * @param {string} fieldName
     */
    async #getAll(url, fieldName) {
        const json = await this.httpCache.get(url);

        const txs = json[fieldName];
        if ('links' in json && 'next' in json['links']) {
            const next = json['links']['next'];
            if (next) {
                txs.push(...await this.#getAll(this.baseUrl + next, fieldName));
            }
        }
        return txs;
    }

}
