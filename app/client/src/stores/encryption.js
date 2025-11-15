import escapeHtml from 'escape-html';
import { defineStore } from 'pinia';
import { ROOM_ENCRYPTION_VERSION } from '../../../api/encryption.ts';

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

export const useEncryptionStore = defineStore('encryption', {
    state: () => ({
        roomKeys: {},
        roomErrors: {},
    }),

    actions: {
        handleRoomDescriptors(rooms) {
            const knownRoomIds = new Set(rooms.map((room) => room.id));
            Object.keys(this.roomKeys).forEach((roomId) => {
                if (!knownRoomIds.has(parseInt(roomId, 10))) {
                    this.forgetRoom(parseInt(roomId, 10));
                }
            });
            rooms.forEach((room) => {
                if (!room.encryption?.enabled) {
                    this.forgetRoom(room.id);
                } else {
                    const entry = this.roomKeys[room.id];
                    if (entry && entry.salt !== room.encryption.salt) {
                        this.forgetRoom(room.id);
                    }
                }
            });
        },

        async setPassphrase(room, passphrase) {
            if (!room?.encryption?.enabled) {
                return;
            }
            if (!passphrase) {
                this.roomErrors[room.id] = 'Passphrase is required to unlock this room.';
                return;
            }
            try {
                const subtle = getSubtleCrypto();
                const keyMaterial = await subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
                const key = await subtle.deriveKey(
                    {
                        name: 'PBKDF2',
                        salt: encoder.encode(room.encryption.salt || ''),
                        iterations: 600000,
                        hash: 'SHA-256',
                    },
                    keyMaterial,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt'],
                );
                this.roomKeys[room.id] = {
                    key,
                    salt: room.encryption.salt || '',
                };
                delete this.roomErrors[room.id];
            } catch (error) {
                console.error(error);
                this.roomErrors[room.id] = 'Unable to derive encryption key.';
            }
        },

        forgetRoom(roomId) {
            delete this.roomKeys[roomId];
            delete this.roomErrors[roomId];
        },

        hasKey(roomId) {
            return typeof this.roomKeys[roomId] !== 'undefined';
        },

        async prepareOutgoingMessage(rawMessage, room) {
            if (!room?.encryption?.enabled || rawMessage.startsWith('/')) {
                return rawMessage;
            }
            const entry = this.roomKeys[room.id];
            if (!entry) {
                this.roomErrors[room.id] = 'Enter the room passphrase to send messages.';
                return null;
            }
            delete this.roomErrors[room.id];
            let content = rawMessage;
            let quotedId = null;
            const quoteMatch = content.match(/^@([0-9]+)/);
            if (quoteMatch && quoteMatch[1]) {
                quotedId = parseInt(quoteMatch[1], 10);
                content = content.slice(quoteMatch[0].length);
            }
            const { ciphertext, iv } = await encryptString(entry.key, content);
            const payload = {
                ciphertext,
                iv,
                version: ROOM_ENCRYPTION_VERSION,
            };
            if (quotedId) {
                payload.quotedId = quotedId;
            }
            return JSON.stringify(payload);
        },

        async decryptIncomingMessage(message, rooms) {
            if (!message?.meta?.encrypted || !message.storage?.e2ee) {
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted, rooms);
                }
                return message;
            }
            const room = rooms.find((entry) => entry.id === message.room);
            if (!room?.encryption?.enabled) {
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted, rooms);
                }
                return message;
            }
            const entry = this.roomKeys[room.id];
            if (!entry) {
                message.meta.decryptionError = 'missing-key';
                if (message?.quoted) {
                    message.quoted = await this.decryptIncomingMessage(message.quoted, rooms);
                }
                return message;
            }
            try {
                const plaintext = await decryptString(entry.key, message.storage.e2ee);
                message.content = plaintext;
                message.formatted = formatPlaintext(plaintext);
                delete message.meta.decryptionError;
            } catch (error) {
                console.error(error);
                message.meta.decryptionError = 'invalid-key';
            }
            if (message?.quoted) {
                message.quoted = await this.decryptIncomingMessage(message.quoted, rooms);
            }
            return message;
        },
    },
});
