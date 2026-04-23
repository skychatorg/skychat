import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useClientStore } from '@/stores/client';
import { useMessageComposer } from '@/composables/useMessageComposer';
import { labels } from '../labels';

export function useChatCommands() {
    const client = useClientStore();
    const composerRef = useMessageComposer();
    const route = useRoute();

    return computed(() => {
        /** @type {import('../types.js').Command[]} */
        const out = [];
        if (route?.name !== 'app') return out;

        const composer = composerRef.value;
        if (composer) {
            out.push({
                id: 'chat.focus',
                title: labels.focusMessageInput(),
                icon: 'paper-plane',
                category: 'Chat',
                keywords: ['compose', 'write'],
                run: () => composer.focus(),
            });
            out.push({
                id: 'chat.upload',
                title: labels.uploadFile(),
                icon: 'paperclip',
                category: 'Chat',
                keywords: ['attach', 'file'],
                run: () => composer.openFilePicker(),
            });
            out.push({
                id: 'chat.audio',
                title: labels.toggleRecording(composer.recording?.value ?? false),
                icon: 'microphone',
                category: 'Chat',
                keywords: ['voice message', 'record'],
                run: () => composer.toggleRecording(),
            });
            out.push({
                id: 'chat.encrypt',
                title: labels.toggleEncryption(),
                icon: 'lock',
                category: 'Chat',
                keywords: ['e2ee', 'encryption', 'private'],
                run: () => composer.toggleEncryption(),
            });
        }

        out.push({
            id: 'chat.search',
            title: labels.searchMessages(),
            icon: 'magnifying-glass',
            category: 'Chat',
            keywords: ['find', 'lookup'],
            expand: () => ({
                type: 'prompt',
                title: 'Search messages',
                placeholder: 'Search…',
                run: (value) => client.searchMessages(value),
            }),
        });

        return out;
    });
}
