import { HttpCache } from "./http-cache.js";

export class Forex {
    constructor() {
        this.httpCache = new HttpCache('exchange-rate.cache.json');
    }

    /**
     * 
     * @param {string} currency 
     * @param {Date} date 
     * @returns {Promise<import("./coinbase.js").Price>}
     */
    async getExchangeRate(currency, date) {
        const url = `https://api.coinbase.com/v2/prices/HBAR-${currency}/spot?date=${date.toISOString().slice(0, 10)}`;
        return /**@type{import("./coinbase.js").Price}*/(await this.httpCache.get(url));
    }

    /**
     * 
     * @param {string} currency 
     * @returns {Promise<import("./coinbase.js").Price>}
     */
    static async getCurrentExchangeRate(currency) {
        const resp = await fetch(`https://api.coinbase.com/v2/prices/HBAR-${currency}/spot`);
        if (resp.status !== 200)
            throw new Error('getCurrentExchangeRate: not ok', { cause: resp });
        return /**@type{import("./coinbase.js").Price}*/(await resp.json());
    }
}