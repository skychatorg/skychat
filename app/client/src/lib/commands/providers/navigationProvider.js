import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { labels } from '../labels';

export function useNavigationCommands() {
    const app = useAppStore();
    const client = useClientStore();
    const router = useRouter();
    const route = useRoute();

    return computed(() => {
        /** @type {import('../types.js').Command[]} */
        const out = [];

        if (route?.name === 'home' && (client.state.user?.right ?? -1) >= 0) {
            out.push({
                id: 'nav.go.chat',
                title: labels.goToChat(),
                icon: 'comments',
                category: 'Navigation',
                keywords: ['open app', 'chat view'],
                run: () => router.push('/app'),
            });
        }
        if (route?.name === 'app') {
            out.push({
                id: 'nav.go.home',
                title: labels.goToHome(),
                icon: 'globe',
                category: 'Navigation',
                keywords: ['homepage', 'landing'],
                run: () => router.push('/'),
            });
        }

        const views = /** @type {const} */ ([
            ['left', labels.mobileShowLeft(), 'folder'],
            ['middle', labels.mobileShowMiddle(), 'comments'],
            ['right', labels.mobileShowRight(), 'users'],
        ]);
        for (const [view, title, icon] of views) {
            if (app.mobileView === view) continue;
            out.push({
                id: `nav.mobile.${view}`,
                title,
                icon,
                category: 'Navigation',
                keywords: ['mobile', 'column', view],
                run: () => app.mobileSetView(view),
            });
        }

        return out;
    });
}
