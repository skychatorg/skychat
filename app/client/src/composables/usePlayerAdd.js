import { computed } from 'vue';
import { useClientStore } from '@/stores/client';
import { useUserRight } from '@/composables/useUserRight';

/**
 * Shared by every source of the player window: whether this viewer can add right now (and why not),
 * and whether a media is already playing or queued, read from the server's state rather than guessed.
 */
export function usePlayerAdd() {
    const client = useClientStore();
    const canAdd = useUserRight('minRightForPlayerAddMedia', 0);

    const blockedReason = computed(() => {
        if (!client.state.user?.id) {
            return 'Log in to add things to the player.';
        }
        if (!canAdd.value) {
            return "Your account can't add to the player yet.";
        }
        if (!client.mediaChannel) {
            return 'Join a media channel first, from the channel list.';
        }
        return null;
    });

    const isQueued = (type, id) => {
        const { current, queue } = client.state.player;
        const matches = (video) => video?.type === type && video?.id === id;
        return matches(current?.video) || queue.some((entry) => matches(entry.video));
    };

    const send = (command) => client.sendMessage(command);

    return { blockedReason, isQueued, send };
}
