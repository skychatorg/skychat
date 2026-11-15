import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { labels } from '../labels';
import { useUserRight } from '@/composables/useUserRight';

export function usePlayerCommands() {
    const client = useClientStore();
    const app = useAppStore();
    const canMusic = useUserRight('minRightForNavidrome', 0);

    return computed(() => {
        /** @type {import('../types.js').Command[]} */
        const out = [];
        const enabled = app.playerMode.enabled;
        const hasCurrent = Boolean(client.state.player?.current);

        out.push({
            id: 'player.toggle',
            title: labels.togglePlayer(enabled),
            icon: enabled ? 'toggle-on' : 'toggle-off',
            category: 'Player',
            keywords: ['enable', 'disable', 'on', 'off'],
            run: () => app.setPlayerEnabled(!enabled),
        });

        if (enabled) {
            out.push({
                id: 'player.expand',
                title: labels.expandPlayer(),
                icon: 'expand',
                category: 'Player',
                shortcut: 'Shift+↓',
                run: () => app.expandPlayer(),
            });
            out.push({
                id: 'player.shrink',
                title: labels.shrinkPlayer(),
                icon: 'compress',
                category: 'Player',
                shortcut: 'Shift+↑',
                run: () => app.shrinkPlayer(),
            });
        }

        if (hasCurrent) {
            out.push({
                id: 'player.skip',
                title: labels.skipVideo(),
                icon: 'forward-step',
                category: 'Player',
                keywords: ['next video'],
                run: () => client.sendMessage('/player skip'),
            });
            out.push({
                id: 'player.skip30',
                title: labels.skipForward30(),
                icon: 'forward-step',
                category: 'Player',
                run: () => client.sendMessage('/player skip30'),
            });
            out.push({
                id: 'player.replay30',
                title: labels.replay30(),
                icon: 'reply',
                category: 'Player',
                run: () => client.sendMessage('/player replay30'),
            });
            out.push({
                id: 'player.sync',
                title: labels.syncPlayer(),
                icon: 'rotate',
                category: 'Player',
                keywords: ['resync'],
                run: () => client.sendMessage('/playersync'),
            });
        }

        out.push({
            id: 'player.queue',
            title: labels.openPlayerQueue(),
            icon: 'list',
            category: 'Player',
            keywords: ['queue', 'up next'],
            run: () => app.toggleModal('player', { pane: 'queue' }),
        });
        out.push({
            id: 'player.add',
            title: labels.addToPlayer(),
            icon: 'plus',
            category: 'Player',
            keywords: ['youtube', 'search video', 'queue video', 'link', 'jellyfin', 'schedule'],
            run: () => app.toggleModal('player'),
        });
        if (client.state.config?.navidromeEnabled && canMusic.value) {
            out.push({
                id: 'player.add.music',
                title: labels.browseMusic(),
                icon: 'music',
                category: 'Player',
                keywords: ['navidrome', 'song', 'album', 'listen'],
                run: () => app.toggleModal('player', { tab: 'music' }),
            });
        }

        if (client.state.op) {
            out.push({
                id: 'player.manageChannels',
                title: labels.manageChannels(),
                icon: 'gears',
                category: 'Player',
                keywords: ['admin', 'create channel', 'party', 'casino', 'games', 'media'],
                run: () => app.toggleModal('admin', { tab: 'channels' }),
            });
        }

        return out;
    });
}
