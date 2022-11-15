import * as crypto from 'crypto';
const biguint = require('biguint-format');


export class RandomGenerator {

    /**
     *
     * @param bytes Number of bytes to use to generate the number between 0 and 1. The number of distinct values
     *  that this function can return is equal to 255^bytes.
     */
    public static random(bytes: number): number {
        bytes = bytes || 4;
        return biguint(crypto.randomBytes(bytes), 'dec') / Math.pow(256, bytes);
    }
}
