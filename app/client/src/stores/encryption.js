import escapeHtml from 'escape-html';
import { defineStore } from 'pinia';
import { MESSAGE_ENCRYPTION_VERSION } from '../../../api/encryption.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const getSubtleCrypto = () => {
    const crypto = globalThis.crypto;
    if (!crypto || !crypto.subtle) {
        throw new Error('WebCrypto API is not available in this browser.');
    }
    return crypto.subtle;
};

const bufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const base64ToBuffer = (value) => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

const bufferToHex = (buffer) => {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};

const formatPlaintext = (plaintext) => {
    return escapeHtml(plaintext).replace(/\n/g, '<br>');
};

const encryptString = async (key, plaintext) => {
    const subtle = getSubtleCrypto();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const cipherBuffer = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
    return {
        ciphertext: bufferToBase64(cipherBuffer),
        iv: bufferToBase64(iv.buffer),
    };
};

const decryptString = async (key, payload) => {
    const subtle = getSubtleCrypto();
    const ivBuffer = base64ToBuffer(payload.iv);
    const cipherBuffer = base64ToBuffer(payload.ciphertext);
    const plaintextBuffer = await subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(ivBuffer) }, key, cipherBuffer);
    return decoder.decode(plaintextBuffer);
};

const deriveMessageKey = async (keyMaterial, salt) => {
    const subtle = getSubtleCrypto();
    return subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: 600000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
};

const randomSalt = () => {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return {
        raw: salt,
        serialized: bufferToBase64(salt.buffer),
    };
};

export const useEncryptionStore = defineStore('encryption', {
    state: () => ({
        passphrases: {},
        composerError: null,
    }),

    getters: {
        knownPassphrases(state) {
            return Object.entries(state.passphrases).map(([keyHash, entry]) => ({
                keyHash,
                label: entry.label || 'Unnamed key',
            }));
        },
    },

    actions: {
        clearComposerError() {
            this.composerError = null;
        },

        async rememberPassphrase(passphrase, label = null) {
            const trimmedLabel = label?.trim() || null;
            const subtle = getSubtleCrypto();
            const keyMaterial = await subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
            const hashBuffer = await subtle.digest('SHA-256', encoder.encode(passphrase));
            const keyHash = bufferToHex(hashBuffer);
            const existing = this.passphrases[keyHash];
            this.passphrases[keyHash] = {
                keyMaterial,
                label: trimmedLabel ?? existing?.label ?? null,
            };
            return { keyHash, entry: this.passphrases[keyHash] };
        },

        forgetPassphrase(keyHash) {
            delete this.passphrases[keyHash];
        },

        async prepareOutgoingMessage(rawMessage, options = {}) {
            const { encrypt = false, passphrase = '', keyHash = null, label = '', remember = true } = options;
            if (rawMessage.startsWith('/')) {
                this.clearComposerError();
                return rawMessage;
            }
            if (!encrypt) {
                this.clearComposerError();
                return rawMessage;
            }
            let content = rawMessage;
            let quotedId = null;
            const quoteMatch = content.match(/^@([0-9]+)/);
            if (quoteMatch && quoteMatch[1]) {
                quotedId = parseInt(quoteMatch[1], 10);
                content = content.slice(quoteMatch[0].length);
            }
            try {
                let resolvedHash = keyHash;
                let entry = resolvedHash ? this.passphrases[resolvedHash] : null;
                if (!entry) {
                    if (!passphrase) {
                        this.composerError = keyHash
                            ? 'Unknown encryption key. Select another key or provide a passphrase.'
                            : 'Passphrase is required to encrypt this message.';
                        return null;
                    }
                    const cached = await this.rememberPassphrase(passphrase, label || null);
                    resolvedHash = cached.keyHash;
                    entry = cached.entry;
                    if (!remember) {
                        delete this.passphrases[resolvedHash];
                    }
                } else if (label?.trim()) {
                    entry.label = label.trim();
                }
                const salt = randomSalt();
                const aesKey = await deriveMessageKey(entry.keyMaterial, salt.raw);
                const { ciphertext, iv } = await encryptString(aesKey, content);
                const payload = {
                    type: 'skychat.e2ee',
                    ciphertext,
                    iv,
                    salt: salt.serialized,
                    keyHash: resolvedHash,
                    label: entry.label,
                    version: MESSAGE_ENCRYPTION_VERSION,
                };
                if (quotedId) {
                    payload.quotedId = quotedId;
                }
                this.clearComposerError();
                return JSON.stringify(payload);
            } catch (error) {
                console.error(error);
                this.composerError = 'Unable to encrypt this message.';
                return null;
            }
        },

        async decryptIncomingMessage(message) {
            if (!message?.meta?.encrypted || !message.storage?.e2ee) {
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted);
                }
                return message;
            }
            const payload = message.storage.e2ee;
            const keyHash = payload.keyHash || message.meta?.keyHash;
            if (!payload.salt || !payload.ciphertext || !payload.iv) {
                message.meta.decryptionError = 'invalid-key';
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted);
                }
                return message;
            }
            if (!keyHash) {
                message.meta.decryptionError = 'missing-key';
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted);
                }
                return message;
            }
            const entry = this.passphrases[keyHash];
            if (!entry) {
                message.meta.decryptionError = 'missing-key';
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted);
                }
                return message;
            }
            try {
                const saltBuffer = base64ToBuffer(payload.salt);
                const aesKey = await deriveMessageKey(entry.keyMaterial, new Uint8Array(saltBuffer));
                const plaintext = await decryptString(aesKey, payload);
                message.content = plaintext;
                message.formatted = formatPlaintext(plaintext);
                delete message.meta.decryptionError;
            } catch (error) {
                console.error(error);
                message.meta.decryptionError = 'invalid-key';
            }
            if (message?.quoted) {
                message.quoted = await this.decryptIncomingMessage(message.quoted);
            }
            return message;
        },

        async unlockMessage(message, passphrase, label = null) {
            if (!message?.storage?.e2ee) {
                return false;
            }
            try {
                await this.rememberPassphrase(passphrase, label ?? message.storage.e2ee.label ?? null);
                await this.decryptIncomingMessage(message);
                return !message.meta.decryptionError;
            } catch (error) {
                console.error(error);
                message.meta.decryptionError = 'invalid-key';
                return false;
            }
        },
    },
});
