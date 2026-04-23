import { computed } from 'vue';
import { useClientStore } from '@/stores/client';
import { useUserRight } from '@/composables/useUserRight';
import { labels } from '../labels';

const DURATIONS = [
    { id: '1h', name: '1 hour', seconds: 3600 },
    { id: '1d', name: '1 day', seconds: 86400 },
    { id: '7d', name: '7 days', seconds: 604800 },
    { id: '30d', name: '30 days', seconds: 2592000 },
    { id: 'perm', name: 'Permanent', seconds: 100 * 365 * 86400 },
];

function isUserBlacklisted(user, meState) {
    const blacklist = meState.user?.data?.plugins?.blacklist;
    if (!blacklist) return false;
    if (Array.isArray(blacklist)) {
        return blacklist.includes(user.username.toLowerCase());
    }
    if (user.id === 0 && blacklist.guests) return true;
    return (blacklist.users || []).includes(user.username.toLowerCase());
}

export function useUserCommands() {
    const client = useClientStore();
    const canModerate = useUserRight('minRightForUserModeration');

    return computed(() => {
        /** @type {import('../types.js').Command[]} */
        const out = [];
        const list = client.state.connectedList || [];
        const selfUsername = client.state.user?.username?.toLowerCase();

        for (const entry of list) {
            const user = entry.user;
            if (!user?.username) continue;
            if (user.username.toLowerCase() === selfUsername) continue;

            const u = user.username;
            const subtitle = entry.deadSinceTime ? 'away' : 'online';
            const blacklisted = isUserBlacklisted(user, client.state);

            out.push({
                id: `user.pm.${u}`,
                title: labels.sendPm(u),
                subtitle,
                icon: 'paper-plane',
                category: 'Users',
                keywords: ['private message', 'dm'],
                run: () => client.sendMessage(`/pm ${u}`),
            });

            out.push({
                id: `user.bl.${u}`,
                title: blacklisted ? labels.unblacklistUser(u) : labels.blacklistUser(u),
                subtitle,
                icon: blacklisted ? 'user' : 'user-slash',
                category: 'Users',
                keywords: ['ignore', 'block'],
                run: () => client.sendMessage(`${blacklisted ? '/unblacklist' : '/blacklist'} ${u}`),
            });

            if (canModerate.value) {
                out.push({
                    id: `user.kick.${u}`,
                    title: labels.kickUser(u),
                    subtitle,
                    icon: 'arrow-right-from-bracket',
                    category: 'Users',
                    keywords: ['disconnect', 'moderate'],
                    run: () => {
                        if (confirm(`Kick ${u}?`)) {
                            client.sendMessage(`/kick ${u}`);
                        }
                    },
                });

                out.push({
                    id: `user.ban.${u}`,
                    title: labels.banUser(u),
                    subtitle,
                    icon: 'ban',
                    category: 'Users',
                    keywords: ['block', 'moderate'],
                    expand: () => ({
                        type: 'list',
                        title: `Ban ${u}`,
                        commands: [
                            ...DURATIONS.map((d) => ({
                                id: `user.ban.${u}.${d.id}`,
                                title: labels.banUserFor(d.name),
                                icon: 'ban',
                                category: /** @type {import('../types.js').CommandCategory} */ ('Users'),
                                run: () => client.sendMessage(`/ban ${u} access ${d.seconds}`),
                            })),
                            {
                                id: `user.ban.${u}.custom`,
                                title: labels.banUserCustom(),
                                icon: 'pen-to-square',
                                category: 'Users',
                                expand: () => ({
                                    type: 'prompt',
                                    title: `Ban ${u} — custom duration (seconds)`,
                                    placeholder: 'e.g. 3600',
                                    run: (value) => {
                                        const seconds = parseInt(value, 10);
                                        if (Number.isFinite(seconds) && seconds > 0) {
                                            client.sendMessage(`/ban ${u} access ${seconds}`);
                                        }
                                    },
                                }),
                            },
                        ],
                    }),
                });
            }

            out.push({
                id: `user.copy.${u}`,
                title: labels.copyUsername(u),
                subtitle,
                icon: 'copy',
                category: 'Users',
                run: () => navigator.clipboard.writeText(u),
            });
        }

        return out;
    });
}
