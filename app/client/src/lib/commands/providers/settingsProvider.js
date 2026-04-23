import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useUserRight } from '@/composables/useUserRight';
import { labels } from '../labels';

export function useSettingsCommands() {
    const app = useAppStore();
    const client = useClientStore();
    const canManageStickers = useUserRight('minRightForStickerManagement');

    return computed(() => {
        /** @type {import('../types.js').Command[]} */
        const out = [];
        const loggedIn = (client.state.user?.right ?? -1) >= 0;

        out.push({
            id: 'settings.profile',
            title: labels.openProfile(),
            icon: 'user',
            category: 'Settings',
            keywords: ['preferences', 'account', 'motto', 'avatar'],
            run: () => app.toggleModal('profile'),
        });

        out.push({
            id: 'settings.gallery',
            title: labels.openGallery(),
            icon: 'image',
            category: 'Settings',
            keywords: ['files', 'uploads', 'media'],
            run: () => app.toggleModal('gallery'),
        });

        if (canManageStickers.value) {
            out.push({
                id: 'settings.stickers',
                title: labels.manageStickers(),
                icon: 'image',
                category: 'Settings',
                keywords: ['emoji', 'custom'],
                run: () => app.toggleModal('manageStickers'),
            });
        }

        if (loggedIn) {
            out.push({
                id: 'settings.motto',
                title: labels.changeMotto(),
                icon: 'pen-to-square',
                category: 'Settings',
                keywords: ['status', 'bio', 'about'],
                expand: () => ({
                    type: 'prompt',
                    title: 'Change motto',
                    placeholder: client.state.user?.data?.plugins?.motto || 'What drives you?',
                    run: (value) => client.sendMessage(`/motto ${value}`),
                }),
            });

            const colors = client.state.custom?.color || [];
            if (colors.length) {
                out.push({
                    id: 'settings.color',
                    title: labels.changeColor(),
                    icon: 'circle',
                    category: 'Settings',
                    keywords: ['username color', 'theme'],
                    expand: () => ({
                        type: 'list',
                        title: 'Change color',
                        commands: colors.map((color) => ({
                            id: `settings.color.${color.id}`,
                            title: labels.pickColor(color.name),
                            subtitle: color.value,
                            icon: 'circle',
                            category: /** @type {import('../types.js').CommandCategory} */ ('Settings'),
                            run: () => client.sendMessage(`/custom use color:${color.id}`),
                        })),
                    }),
                });
            }

            const blacklist = client.state.user?.data?.plugins?.blacklist;
            const guestsHidden = !Array.isArray(blacklist) && Boolean(blacklist?.guests);
            out.push({
                id: 'settings.guest.blacklist',
                title: labels.toggleGuestBlacklist(guestsHidden),
                icon: 'user-slash',
                category: 'Settings',
                keywords: ['hide guests', 'show guests'],
                run: () => client.sendMessage(guestsHidden ? '/unblacklistguests' : '/blacklistguests'),
            });
        }

        return out;
    });
}
