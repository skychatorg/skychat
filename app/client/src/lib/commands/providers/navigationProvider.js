import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { labels } from '../labels';

export function useNavigationCommands() {
    const app = useAppStore();

    return computed(() => {
        /** @type {import('../types.js').Command[]} */
        const out = [];

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
