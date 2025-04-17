
/**
 * @param {{[prop: string]: unknown }[]} table 
 * @returns {string}
 */
export function csv(table) {
    let result = '';
    const cols = Object.getOwnPropertyNames(table[0]);
    result += cols.join(', ') + '\n';

    for (const row of table) {
        result += cols.map(col => row[col]).join(', ') + '\n';
    }

    return result;
}
