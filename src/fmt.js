
/**
 * 
 * @param {bigint} n 
 * @returns {string}

 */
export function fmt(n) {
    const s = n.toString().padStart(9, '0');
    return `${s.slice(0, -8)}.${s.slice(-8)}`;
}
