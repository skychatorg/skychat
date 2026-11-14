import { useUserRight } from '@/composables/useUserRight';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

/**
 * The admin sections this user may open, by the same rights the server checks. Empty for everyone else
 */
export function useAdminTabs() {
    const client = useClientStore();
    const canStickers = useUserRight('minRightForStickerManagement');
    const canHighlights = useUserRight('minRightForHighlightManagement');
    const canModerate = useUserRight('minRightForUserModeration');
    const canSetRight = useUserRight('minRightForSetRight');
    return computed(() =>
        [
            { id: 'users', label: 'Users', icon: 'users', allowed: canSetRight.value },
            { id: 'bans', label: 'Bans', icon: 'ban', allowed: canModerate.value },
            { id: 'rooms', label: 'Rooms', icon: 'comments', allowed: client.state.op },
            { id: 'channels', label: 'Channels', icon: 'tv', allowed: client.state.op },
            { id: 'voice', label: 'Voice channels', icon: 'headphones', allowed: client.state.op && client.state.voiceEnabled },
            { id: 'stickers', label: 'Stickers', icon: 'image', allowed: canStickers.value },
            { id: 'highlights', label: 'Highlighted words', icon: 'highlighter', allowed: canHighlights.value },
            { id: 'server', label: 'Server', icon: 'gears', allowed: client.state.op },
        ].filter((tab) => tab.allowed),
    );
}
