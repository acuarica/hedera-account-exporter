import { HttpCache } from "./http-cache.js";

export class Forex {
    constructor() {
        this.httpCache = new HttpCache('exchange-rate.cache.json');
    }

    /**
     * 
     * @param {string} currency 
     * @param {Date} date 
     */
    getExchangeRate(currency, date) {
        const url = `https://api.coinbase.com/v2/prices/HBAR-${currency}/spot?date=${date.toISOString().slice(0, 10)}`;
        return this.httpCache.get(url);
    }
}