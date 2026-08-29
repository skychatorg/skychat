import { useClientStore } from '@/stores/client.js';
import { computed, ref, watch } from 'vue';

// Module scope on purpose: the picker lives in the player's control strip while the logic that
// applies the selection lives in JellyfinPlayer, and both must read the same refs.
const preferredSubLang = ref(localStorage.getItem('jf.subLang') || 'default');
const preferredAudioLang = ref(localStorage.getItem('jf.audLang') || 'default');
watch(preferredSubLang, (v) => localStorage.setItem('jf.subLang', v));
watch(preferredAudioLang, (v) => localStorage.setItem('jf.audLang', v));

export function useJellyfinTracks() {
    const client = useClientStore();
    const jellyfin = computed(() => client.state.player.current?.video?.jellyfin || null);
    return { preferredAudioLang, preferredSubLang, jellyfin };
}
