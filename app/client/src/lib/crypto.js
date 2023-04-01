import { Buffer } from 'buffer';


const RAW_SALT = new Uint8Array([
    140,
    187,
    244,
    128,
    28,
    57,
    92
]);

const RAW_PASSWORD_ALG = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 339616,
    salt: RAW_SALT,
};

const MESSAGE_KEY_ALG = {
    name: 'AES-GCM',
    length: 256,
};

const ENCRYPT_IV_SIZE = 32;

/**
 * Get a CryptoKey from a password
 */
export const getPasswordKey = async password => {
    // Create key from raw password
    const passwordRawKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        RAW_PASSWORD_ALG,
        false,
        ['deriveKey']
    );
    // Derive new key
    return crypto.subtle.deriveKey(
        RAW_PASSWORD_ALG,
        passwordRawKey,
        MESSAGE_KEY_ALG,
        false,
        ['encrypt', 'decrypt']
    );
};

/**
 * Encrypt some string data using the provided key
 */
export const encrypt = async (key, data) => {
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPT_IV_SIZE));
    const cipher = await crypto.subtle.encrypt(
        { ...MESSAGE_KEY_ALG, iv },
        key,
        new TextEncoder().encode(data)
    );
    return {
        iv: Buffer.from(iv).toString('base64'),
        cipher: Buffer.from(cipher).toString('base64'),
    };
};

/**
 * Decrypt data using the provided key
 * Fails with an error if the key does not correspond to the one used to encrypt the data
 */
export const decrypt = async (key, { iv, cipher }) => {
    const encodedData = await crypto.subtle.decrypt(
        { ...MESSAGE_KEY_ALG, iv: Buffer.from(iv, 'base64') },
        key,
        Buffer.from(cipher, 'base64')
    );
    return new TextDecoder().decode(encodedData);
};

/**
 * Verify that the provided key is compatible with the given encrypted data
 */
export const verify = async (key, { iv, cipher }) => {
    try {
        return !! await decrypt(key, { iv, cipher });
    } catch (error) {
        return false;
    }
};
