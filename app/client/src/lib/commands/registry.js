import { computed } from 'vue';
import { useSessionCommands } from './providers/sessionProvider';
import { useRoomCommands } from './providers/roomProvider';
import { useUserCommands } from './providers/userProvider';
import { usePlayerCommands } from './providers/playerProvider';
import { useChatCommands } from './providers/chatProvider';
import { useSettingsCommands } from './providers/settingsProvider';
import { useNavigationCommands } from './providers/navigationProvider';

export function useCommandRegistry() {
    const session = useSessionCommands();
    const rooms = useRoomCommands();
    const users = useUserCommands();
    const player = usePlayerCommands();
    const chat = useChatCommands();
    const settings = useSettingsCommands();
    const navigation = useNavigationCommands();

    return computed(() => {
        const all = [
            ...session.value,
            ...rooms.value,
            ...users.value,
            ...player.value,
            ...chat.value,
            ...settings.value,
            ...navigation.value,
        ];
        if (import.meta.env.DEV) {
            for (const c of all) {
                if ((c.run && c.expand) || (!c.run && !c.expand)) {
                    console.warn(`[palette] command ${c.id} must set exactly one of run/expand`);
                }
            }
        }
        return all;
    });
}
