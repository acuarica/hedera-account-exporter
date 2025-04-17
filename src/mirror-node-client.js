import { HttpCache } from './http-cache.js';

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
     * @return {Promise<import('./def.js').TransactionsResponse['transactions']>}
     */
    getTransactionsOf(accountId, transactionType = 'CRYPTOTRANSFER') {
        const url = `${this.baseUrl}/api/v1/transactions?account.id=${accountId}&order=asc&transactiontype=${transactionType}&result=success&limit=100`;
        return this.#getAll(url, 'transactions');
    }

    /**
     * @param {string} accountId 
     * @return {Promise<import('./def.js').BalancesResponse['balances']>}
     */
    getBalancesOf(accountId) {
        const url = `${this.baseUrl}/api/v1/balances?account.id=${accountId}&order=asc&limit=100`;
        return this.#getAll(url, 'balances');
    }

    /**
     * @param {string} accountId 
     * @param {number} timestamp;
     * @return {Promise<import('./def.js').BalancesResponse['balances']>}
     */
    getBalancesOfAt(accountId, timestamp) {
        const url = `${this.baseUrl}/api/v1/balances?account.id=${accountId}&timestamp=${timestamp}&order=asc&limit=100`;
        return this.#getAll(url, 'balances');
    }

    /**
     * 
     * @template {string} N
     * @template T
     * @template {import('./def.js').PaginatedResponse & {[fieldName in N]: T[]}} P
     * @param {string} url 
     * @param {N} fieldName
     * @returns {Promise<T[]>}
     */
    async #getAll(url, fieldName) {
        const json = /**@type{P}*/(await this.httpCache.get(url));

        const txs = json[fieldName];
        if ('links' in json && json['links'] !== undefined && 'next' in json['links']) {
            const next = json['links']['next'];
            if (next) {
                txs.push(...await this.#getAll(this.baseUrl + next, fieldName));
            }
        }
        return txs;
    }
}
