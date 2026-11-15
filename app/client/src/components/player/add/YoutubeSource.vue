<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { apiClient, useClientStore } from '@/stores/client';
import { formatMs } from '@/lib/formatTime';
import { mediaFromLink } from '@/lib/mediaLink';
import { usePlayerAdd } from '@/composables/usePlayerAdd';

const client = useClientStore();
const { isQueued, send } = usePlayerAdd();

const query = ref('');
const type = ref('video');
const searchedType = ref('video');
const searching = ref(false);
const input = ref(null);

// A pasted link is added as is, no search needed
const link = computed(() => mediaFromLink(query.value));

// Search runs on Enter only: every query spends YouTube API quota
const search = () => {
    if (link.value) {
        send(`/${link.value.fetcher} ${link.value.param}`);
        query.value = '';
        return;
    }
    if (!query.value.trim()) return;
    searching.value = true;
    searchedType.value = type.value;
    send(`/playersearch yt ${type.value} ${query.value.trim()}`);
};
watch(type, () => query.value.trim() && !link.value && search());

const results = computed(() => client.state.playerApiSearchResult?.items ?? []);
watch(
    () => client.state.playerApiSearchResult,
    () => (searching.value = false),
);

const add = (item) => send(`/yt ${item.id} ${searchedType.value}`);
const queued = (item) => searchedType.value === 'video' && isQueued('youtube', item.id);

// A failed search is toasted by the app: just leave the loading state
const onError = () => (searching.value = false);
onMounted(() => {
    input.value?.focus();
    apiClient.on('error', onError);
});
onBeforeUnmount(() => apiClient.removeListener('error', onError));
</script>

<template>
    <div class="flex flex-col min-h-0">
        <form class="flex gap-2 mb-3" @submit.prevent="search">
            <div class="relative grow min-w-0">
                <fa :icon="link ? 'link' : 'magnifying-glass'" class="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-50" />
                <input
                    ref="input"
                    v-model="query"
                    type="search"
                    placeholder="Search YouTube or paste a link"
                    aria-label="Search YouTube or paste a link"
                    class="form-control w-full pl-9"
                />
            </div>
            <div class="flex shrink-0 rounded-lg hairline overflow-hidden text-sm" role="group" aria-label="Search for">
                <button
                    v-for="option in [
                        { id: 'video', label: 'Videos' },
                        { id: 'playlist', label: 'Playlists' },
                    ]"
                    :key="option.id"
                    type="button"
                    class="px-3"
                    :class="type === option.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5'"
                    :aria-pressed="type === option.id"
                    @click="type = option.id"
                >
                    {{ option.label }}
                </button>
            </div>
            <button type="submit" class="btn text-sm shrink-0" :disabled="!query.trim()">{{ link ? 'Add' : 'Search' }}</button>
        </form>
        <p v-if="link" class="text-xs text-white/50 -mt-1 mb-3">Adds {{ link.label }} to the queue.</p>

        <div class="grow min-h-0 overflow-y-auto scrollbar pr-1">
            <div v-if="searching" class="text-center text-sm opacity-60 py-10">Searching…</div>
            <div v-else-if="!results.length" class="text-center text-sm opacity-60 py-10">
                Search for a video or a playlist, then press Enter.
            </div>
            <div v-else class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
                <button
                    v-for="item in results"
                    :key="item.id"
                    class="group flex flex-col text-left min-w-0 disabled:cursor-default"
                    :disabled="queued(item)"
                    :title="queued(item) ? 'Already playing or queued' : 'Add to the queue'"
                    @click="add(item)"
                >
                    <span
                        class="relative aspect-video w-full overflow-hidden rounded-lg bg-black ring-2 ring-inset ring-transparent group-enabled:group-hover:ring-[rgb(var(--color-primary))]"
                    >
                        <img :src="item.thumb" alt="" loading="lazy" class="h-full w-full object-cover" />
                        <span
                            class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-xs shadow"
                            :class="queued(item) ? 'bg-primary text-white' : 'bg-black/60 opacity-0 group-hover:opacity-100'"
                        >
                            <fa :icon="queued(item) ? 'check' : 'plus'" />
                        </span>
                        <span v-if="item.duration" class="absolute bottom-1.5 right-1.5 px-1 rounded bg-black/70 text-xs font-mono">
                            {{ formatMs(item.duration) }}
                        </span>
                    </span>
                    <span class="mt-1 text-sm leading-tight line-clamp-2" :title="item.title">{{ item.title }}</span>
                </button>
            </div>
        </div>
    </div>
</template>
