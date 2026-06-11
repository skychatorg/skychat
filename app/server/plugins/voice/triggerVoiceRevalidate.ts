import type { RoomManager } from '../../skychat/RoomManager.js';

/**
 * Ask the voice plugin (if enabled) to re-evaluate live voice policy. Used by moderation
 * toggles (ban/shadowban, blacklist, bunker, roomprotect, setright, private-room unallow)
 * that change who may join/speak/hear in voice but do not close the WS connection.
 *
 * Loose-typed on purpose so trigger plugins do not import VoicePlugin (avoids an import cycle).
 */
export function triggerVoiceRevalidate(manager: RoomManager) {
    (manager.getPlugin('voice') as unknown as { revalidateVoice?: () => void } | null)?.revalidateVoice?.();
}
