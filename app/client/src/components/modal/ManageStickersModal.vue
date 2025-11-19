<script setup>
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, ref } from 'vue';

const app = useAppStore();
const client = useClientStore();

const STICKER_CODE_REGEX = /^:([a-z0-9-_)(]+):?$/i;

const newStickerCode = ref('');
const selectedFile = ref(null);
const fileInput = ref(null);
const isSubmitting = ref(false);
const feedbackMessage = ref('');
const feedbackType = ref(null);

const canManageStickers = computed(() => {
    const threshold = client.state.config?.minRightForStickerManagement ?? 'op';
    if (threshold === 'op') {
        return client.state.op;
    }
    const userRight = client.state.user?.right ?? -1;
    return client.state.op || userRight >= threshold;
});

const stickerEntries = computed(() => {
    const stickers = client.state.stickers || {};
    return Object.entries(stickers).sort(([a], [b]) => a.localeCompare(b));
});

const canSubmit = computed(() => {
    return STICKER_CODE_REGEX.test(newStickerCode.value.trim()) && !!selectedFile.value && !isSubmitting.value;
});

const onFileChange = (event) => {
    const [file] = event.target.files || [];
    selectedFile.value = file || null;
};

const normalizeCode = (code) => {
    let normalized = code.trim().toLowerCase();
    if (!normalized.startsWith(':')) {
        normalized = `:${normalized}`;
    }
    if (!normalized.endsWith(':')) {
        normalized = `${normalized}:`;
    }
    return normalized;
};

const setFeedback = (type, message) => {
    feedbackType.value = type;
    feedbackMessage.value = message;
};

const resetForm = () => {
    newStickerCode.value = '';
    selectedFile.value = null;
    if (fileInput.value) {
        fileInput.value.value = '';
    }
};

const submitSticker = async () => {
    if (!canManageStickers.value) {
        return;
    }
    setFeedback(null, '');
    if (!STICKER_CODE_REGEX.test(newStickerCode.value.trim())) {
        setFeedback('error', 'Sticker code must start with : and only contain letters, numbers, - _ ( ).');
        return;
    }
    if (!selectedFile.value) {
        setFeedback('error', 'Please select an image to upload.');
        return;
    }
    isSubmitting.value = true;
    try {
        const uploadedUrl = await app.upload(selectedFile.value);
        if (!uploadedUrl) {
            throw new Error('Upload failed');
        }
        const normalizedCode = normalizeCode(newStickerCode.value);
        client.sendMessage(`/stickeradd ${normalizedCode} ${uploadedUrl}`);
        setFeedback('success', `Sticker ${normalizedCode} uploaded.`);
        resetForm();
    } catch (error) {
        setFeedback('error', error.message || 'Unable to upload sticker.');
    } finally {
        isSubmitting.value = false;
    }
};

const deleteSticker = (code) => {
    if (!canManageStickers.value) {
        return;
    }
    if (!confirm(`Delete sticker ${code}?`)) {
        return;
    }
    client.sendMessage(`/stickerdel ${code}`);
};
</script>

<template>
    <ModalTemplate id="manageStickers" title="Manage stickers">
        <div v-if="canManageStickers" class="flex flex-col gap-6 pb-6 text-skygray-lightest">
            <form class="flex flex-col gap-4" @submit.prevent="submitSticker">
                <div>
                    <label class="block text-sm font-semibold text-skygray-white" for="sticker-code-input">Sticker code</label>
                    <input
                        id="sticker-code-input"
                        v-model="newStickerCode"
                        class="form-control mt-1 w-full"
                        placeholder=":party-parrot:"
                        type="text"
                    />
                    <p class="text-xs text-skygray-light mt-1">
                        Codes must start with ":" and can contain letters, numbers, hyphens, underscores, parenthesis.
                    </p>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-skygray-white" for="sticker-file-input">Sticker image</label>
                    <input
                        id="sticker-file-input"
                        ref="fileInput"
                        class="form-control mt-1 w-full"
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        @change="onFileChange"
                    />
                    <p class="text-xs text-skygray-light mt-1">PNG, JPG or GIF images work best.</p>
                </div>
                <div>
                    <button class="form-control" type="submit" :disabled="!canSubmit">
                        <fa v-if="isSubmitting" icon="spinner" class="animate-spin mr-2" />
                        Add sticker
                    </button>
                    <p
                        v-if="feedbackMessage"
                        class="text-sm mt-2"
                        :class="{ 'text-danger': feedbackType === 'error', 'text-primary-light': feedbackType === 'success' }"
                    >
                        {{ feedbackMessage }}
                    </p>
                </div>
            </form>

            <div>
                <h3 class="font-semibold mb-2 text-skygray-white">Existing stickers ({{ stickerEntries.length }})</h3>
                <div v-if="stickerEntries.length" class="grid gap-4 sm:grid-cols-2">
                    <div
                        v-for="[code, url] in stickerEntries"
                        :key="code"
                        class="border border-skygray-light/60 bg-skygray-black/30 rounded-xl p-3 flex flex-col gap-3 text-skygray-lightest shadow-lg shadow-skygray-black/20"
                    >
                        <div class="flex items-center justify-between text-xs font-mono uppercase tracking-wide text-skygray-light">
                            <span class="truncate pr-3" :title="code">{{ code }}</span>
                            <button
                                type="button"
                                class="text-danger hover:text-danger-light transition-colors"
                                title="Delete sticker"
                                aria-label="Delete sticker"
                                @click="deleteSticker(code)"
                            >
                                <fa icon="trash" />
                            </button>
                        </div>
                        <img :src="url" :alt="code" class="max-h-24 w-full object-contain self-center bg-skygray-black/40 rounded-lg p-2" />
                    </div>
                </div>
                <p v-else class="text-sm text-skygray-light">No stickers have been added yet.</p>
            </div>
        </div>
        <div v-else class="text-sm text-skygray-light">You do not have permission to manage stickers.</div>
    </ModalTemplate>
</template>
