<script setup>
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { useUserRight } from '@/composables/useUserRight';
import { useClientStore } from '@/stores/client';
import { computed, ref } from 'vue';

const client = useClientStore();

const WORD_REGEX = /^[\p{L}\p{N}-]{2,32}$/u;

const newWord = ref('');
const selectedSticker = ref('');
const feedbackMessage = ref('');

const canManageHighlights = useUserRight('minRightForHighlightManagement');

const stickerCodes = computed(() => Object.keys(client.state.stickers || {}).sort());

const highlightEntries = computed(() => {
    const highlights = client.state.highlights || {};
    return Object.entries(highlights).sort(([a], [b]) => a.localeCompare(b));
});

const canSubmit = computed(() => WORD_REGEX.test(newWord.value.trim()) && !!selectedSticker.value);

const submitHighlight = () => {
    if (!canManageHighlights.value || !canSubmit.value) {
        return;
    }
    feedbackMessage.value = '';
    const word = newWord.value.trim().toLowerCase();
    if (client.state.highlights?.[word]) {
        feedbackMessage.value = `"${word}" is already highlighted. Adding it again replaces its sticker.`;
    }
    client.sendMessage(`/highlight add ${word} ${selectedSticker.value}`);
    newWord.value = '';
};

const deleteHighlight = (word) => {
    if (!canManageHighlights.value) {
        return;
    }
    if (!confirm(`Stop highlighting "${word}"?`)) {
        return;
    }
    client.sendMessage(`/highlight del ${word}`);
};
</script>

<template>
    <ModalTemplate id="manageHighlights" title="Manage highlighted words" variant="wide">
        <div v-if="canManageHighlights" class="flex flex-col gap-6 pb-6 text-skygray-lightest">
            <form class="flex flex-col gap-4 w-full max-w-md" @submit.prevent="submitHighlight">
                <div>
                    <label class="block text-sm font-semibold text-skygray-white" for="highlight-word-input">Word</label>
                    <input
                        id="highlight-word-input"
                        v-model="newWord"
                        class="form-control mt-1 w-full"
                        placeholder="congratulations"
                        type="text"
                    />
                    <p class="text-xs text-skygray-light mt-1">
                        Messages containing this word show it highlighted. Hovering it plays a sticker burst.
                    </p>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-skygray-white" for="highlight-sticker-select">Sticker</label>
                    <div class="flex items-center gap-3 mt-1">
                        <select id="highlight-sticker-select" v-model="selectedSticker" class="form-control w-full">
                            <option value="" disabled>Pick a sticker</option>
                            <option v-for="code in stickerCodes" :key="code" :value="code">{{ code }}</option>
                        </select>
                        <img
                            v-if="selectedSticker && client.state.stickers[selectedSticker]"
                            :src="client.state.stickers[selectedSticker]"
                            :alt="selectedSticker"
                            class="h-10 w-10 object-contain shrink-0"
                        />
                    </div>
                </div>
                <div>
                    <button class="form-control" type="submit" :disabled="!canSubmit">Add highlighted word</button>
                    <p v-if="feedbackMessage" class="text-sm mt-2 text-primary-light">{{ feedbackMessage }}</p>
                </div>
            </form>

            <div>
                <h3 class="font-semibold mb-2 text-skygray-white">Highlighted words ({{ highlightEntries.length }})</h3>
                <div v-if="highlightEntries.length" class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                    <div
                        v-for="[word, sticker] in highlightEntries"
                        :key="word"
                        class="border border-skygray-light/60 bg-skygray-black/30 rounded-xl p-3 flex items-center gap-3 text-skygray-lightest shadow-lg shadow-skygray-black/20"
                    >
                        <img
                            :src="client.state.stickers[sticker]"
                            :alt="sticker"
                            :title="sticker"
                            class="h-12 w-12 object-contain shrink-0 bg-skygray-black/40 rounded-lg p-1"
                        />
                        <span class="skychat-highlight truncate grow" :title="word">{{ word }}</span>
                        <button
                            type="button"
                            class="text-danger hover:text-danger-light transition-colors"
                            title="Delete highlighted word"
                            aria-label="Delete highlighted word"
                            @click="deleteHighlight(word)"
                        >
                            <fa icon="trash" />
                        </button>
                    </div>
                </div>
                <p v-else class="text-sm text-skygray-light">No highlighted words yet.</p>
            </div>
        </div>
        <div v-else class="text-sm text-skygray-light">You do not have permission to manage highlighted words.</div>
    </ModalTemplate>
</template>
