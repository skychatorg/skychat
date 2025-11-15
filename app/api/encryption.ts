export const ROOM_ENCRYPTION_VERSION = 1;

export type RoomEncryptionDescriptor = {
    enabled: boolean;
    salt: string | null;
    version: number;
};

export type EncryptedMessagePayload = {
    ciphertext: string;
    iv: string;
    version: number;
    quotedId?: number | null;
};
