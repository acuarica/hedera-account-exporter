import { debuglog } from 'util';
import { readFileSync, writeFileSync } from 'fs';

const log = debuglog('http-cache');

/**
 * 
 */
export class HttpCache {

    /**
     * @param {string} path 
     */
    constructor(path) {
        this.path = path;
        try {
            this.cache = JSON.parse(readFileSync(this.path, 'utf-8'));
        } catch {
            this.cache = {};
        }
    }

    /**
     * @template [T=unknown]
     * @param {string} url 
     * @returns {Promise<T>}
     */
    async get(url) {
        if (url in this.cache) {
            log('Cache hit for %s', url);
            return JSON.parse(this.cache[url]);
        }

        log('Fetching %s', url);
        const resp = await fetch(url);
        if (resp.status !== 200) {
            throw new Error('not ok', { cause: resp });
        }

        const json = await resp.json();
        this.cache[url] = JSON.stringify(json);

        return json;
    }

    /**
     * 
     */
    save() {
        writeFileSync(this.path, JSON.stringify(this.cache, undefined, 4));
    }
}
