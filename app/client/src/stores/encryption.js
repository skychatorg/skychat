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

const importPassphraseMaterial = async (passphrase) => {
    const subtle = getSubtleCrypto();
    return subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
};

export const useEncryptionStore = defineStore('encryption', {
    state: () => ({
        composerError: null,
    }),

    actions: {
        clearComposerError() {
            this.composerError = null;
        },

        async prepareOutgoingMessage(rawMessage, options = {}) {
            const { encrypt = false, passphrase = '', label = '' } = options;
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
                const normalizedPassphrase = passphrase?.trim();
                if (!normalizedPassphrase) {
                    this.composerError = 'Passphrase is required to encrypt this message.';
                    return null;
                }
                const trimmedLabel = label?.trim() || null;
                const keyMaterial = await importPassphraseMaterial(normalizedPassphrase);
                const salt = randomSalt();
                const aesKey = await deriveMessageKey(keyMaterial, salt.raw);
                const { ciphertext, iv } = await encryptString(aesKey, content);
                const payload = {
                    type: 'skychat.e2ee',
                    ciphertext,
                    iv,
                    salt: salt.serialized,
                    label: trimmedLabel,
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
            if (!message.meta) {
                message.meta = {};
            }
            if (!message?.meta?.encrypted || !message.storage?.e2ee) {
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted);
                }
                return message;
            }
            if (message.meta?.decrypted) {
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted);
                }
                return message;
            }
            message.meta.decryptionError = message.meta.decryptionError || 'locked';
            if (message?.quoted) {
                message.quoted = await this.decryptIncomingMessage(message.quoted);
            }
            return message;
        },

        async unlockMessage(message, passphrase) {
            if (!message?.storage?.e2ee) {
                return false;
            }
            if (!message.meta) {
                message.meta = {};
            }
            try {
                const payload = message.storage.e2ee;
                if (!payload.salt || !payload.iv || !payload.ciphertext) {
                    message.meta.decryptionError = 'invalid-key';
                    return false;
                }
                const normalizedPassphrase = passphrase?.trim();
                if (!normalizedPassphrase) {
                    message.meta.decryptionError = 'missing-passphrase';
                    return false;
                }
                const keyMaterial = await importPassphraseMaterial(normalizedPassphrase);
                const saltBuffer = base64ToBuffer(payload.salt);
                const aesKey = await deriveMessageKey(keyMaterial, new Uint8Array(saltBuffer));
                const plaintext = await decryptString(aesKey, payload);
                message.content = plaintext;
                message.formatted = formatPlaintext(plaintext);
                delete message.meta.decryptionError;
                message.meta.decrypted = true;
                if (message?.quoted) {
                    await this.unlockMessage(message.quoted, normalizedPassphrase);
                }
                return true;
            } catch (error) {
                console.error(error);
                message.meta.decryptionError = 'invalid-key';
                return false;
            }
        },
    },
});
