import { Decimal } from 'decimal.js';

/**
 * 
 */
export interface HbarValues {
    [currency: string]: {
        rate: Decimal,
        amount: Decimal,
    },
}
