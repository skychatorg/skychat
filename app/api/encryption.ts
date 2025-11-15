export const MESSAGE_ENCRYPTION_VERSION = 1;

export type EncryptedMessagePayload = {
    type: 'skychat.e2ee';
    ciphertext: string;
    iv: string;
    salt: string;
    version: number;
    label?: string | null;
    quotedId?: number | null;
};
