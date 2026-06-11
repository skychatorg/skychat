import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

/**
 * Thin reactive facade over the store's voice state so components don't reach into
 * store internals everywhere.
 */
export function useVoice() {
    const client = useClientStore();
    return {
        connected: computed(() => client.state.currentVoiceChannelId !== null),
        currentChannelId: computed(() => client.state.currentVoiceChannelId),
        channels: computed(() => client.state.voiceChannels),
        channelUsers: computed(() => client.state.voiceChannelUsers),
        speaking: computed(() => client.state.voiceSpeaking),
        muted: computed(() => client.voice.muted),
        deafened: computed(() => client.voice.deafened),
        pushToTalk: computed(() => client.voice.pushToTalk),
        join: (id) => client.joinVoice(id),
        leave: () => client.leaveVoice(),
        startMic: () => client.voiceStartMic(),
        setMuted: (m) => client.setVoiceMuted(m),
        setDeafened: (d) => client.setVoiceDeafened(d),
        setPushToTalk: (p) => client.setVoicePushToTalk(p),
        isSpeaking: (userId) => !!client.state.voiceSpeaking[userId],
    };
}
