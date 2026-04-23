import { ref } from 'vue';

/**
 * @typedef {Object} MessageComposerApi
 * @property {() => void} focus
 * @property {() => void} openFilePicker
 * @property {() => void} toggleRecording
 * @property {() => void} toggleEncryption
 * @property {import('vue').Ref<boolean>} recording
 * @property {import('vue').Ref<boolean>} encryptionOpen
 */

/** @type {import('vue').Ref<MessageComposerApi | null>} */
const api = ref(null);

/**
 * Called by `NewMessageForm.vue` on mount. Returns a teardown to call on unmount.
 * @param {MessageComposerApi} impl
 */
export function registerMessageComposer(impl) {
    api.value = impl;
    return () => {
        if (api.value === impl) {
            api.value = null;
        }
    };
}

/**
 * Read-side hook for command providers and palette code.
 * Returns the ref so callers can observe changes reactively.
 */
export function useMessageComposer() {
    return api;
}
