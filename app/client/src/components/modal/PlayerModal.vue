<script setup>
import { computed, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useUserRight } from '@/composables/useUserRight';
import { usePlayerAdd } from '@/composables/usePlayerAdd';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import PlayerUpNext from '@/components/player/add/PlayerUpNext.vue';
import YoutubeSource from '@/components/player/add/YoutubeSource.vue';
import MusicSource from '@/components/player/add/MusicSource.vue';
import JellyfinSource from '@/components/player/add/JellyfinSource.vue';
import LinkSource from '@/components/player/add/LinkSource.vue';

const app = useAppStore();
const client = useClientStore();
const { blockedReason } = usePlayerAdd();
const canMusic = useUserRight('minRightForNavidrome', 0);
const canJellyfin = useUserRight('minRightForJellyfinBrowse');

const sources = computed(() =>
    [
        { id: 'youtube', label: 'YouTube', icon: 'video', component: YoutubeSource, shown: true },
        {
            id: 'music',
            label: 'Music',
            icon: 'music',
            component: MusicSource,
            shown: client.state.config?.navidromeEnabled && canMusic.value,
        },
        {
            id: 'jellyfin',
            label: 'Jellyfin',
            icon: 'film',
            component: JellyfinSource,
            shown: client.state.config?.jellyfinEnabled && canJellyfin.value,
        },
        { id: 'link', label: 'Link', icon: 'link', component: LinkSource, shown: true },
    ].filter((source) => source.shown),
);

// The last source used is reopened next time, unless the opener asks for one
const readTab = () => {
    try {
        return localStorage.getItem('player.addTab');
    } catch {
        return null;
    }
};
const tab = ref(readTab() || 'youtube');
watch(tab, (value) => {
    try {
        localStorage.setItem('player.addTab', value);
    } catch {
        // Storage blocked: the tab just won't be remembered
    }
});
const active = computed(() => sources.value.find((source) => source.id === tab.value) ?? sources.value[0]);

// On phones the two columns don't fit side by side, so one shows at a time
const pane = ref('add');

watch(
    () => app.modals.player,
    (data) => {
        if (!data) return;
        if (data.tab) tab.value = data.tab;
        pane.value = data.pane === 'queue' ? 'queue' : 'add';
    },
);
</script>

<template>
    <ModalTemplate id="player" title="Player" variant="wide">
        <div class="h-full min-h-0 flex flex-col lg:flex-row gap-4 pb-4">
            <div class="lg:hidden flex gap-1 p-1 rounded-lg bg-white/[.04] shrink-0" role="tablist">
                <button
                    v-for="option in [
                        { id: 'add', label: 'Add' },
                        { id: 'queue', label: `Up next · ${client.state.player.queue.length}` },
                    ]"
                    :key="option.id"
                    role="tab"
                    class="flex-1 py-1.5 rounded-md text-sm"
                    :class="pane === option.id ? 'bg-white/10 text-white' : 'text-white/60'"
                    :aria-selected="pane === option.id"
                    @click="pane = option.id"
                >
                    {{ option.label }}
                </button>
            </div>

            <section class="min-h-0 min-w-0 flex-1 flex-col" :class="pane === 'add' ? 'flex' : 'hidden lg:flex'">
                <div v-if="blockedReason" class="flex-1 flex flex-col items-center justify-center text-center gap-2 p-6">
                    <fa icon="circle-play" class="text-3xl opacity-40" />
                    <p class="text-sm text-white/80 max-w-xs">{{ blockedReason }}</p>
                </div>
                <template v-else>
                    <div class="flex gap-1 mb-3 shrink-0" role="tablist" aria-label="Add from">
                        <button
                            v-for="source in sources"
                            :key="source.id"
                            role="tab"
                            class="flex-1 sm:flex-none min-w-0 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm"
                            :class="active.id === source.id ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/5'"
                            :aria-selected="active.id === source.id"
                            @click="tab = source.id"
                        >
                            <fa :icon="source.icon" />
                            {{ source.label }}
                        </button>
                    </div>
                    <KeepAlive>
                        <component :is="active.component" :key="active.id" class="flex-1 min-h-0" />
                    </KeepAlive>
                </template>
            </section>

            <aside
                class="lg:w-80 shrink-0 min-h-0 overflow-y-auto scrollbar lg:pl-4 lg:border-l border-white/10"
                :class="pane === 'queue' ? 'block flex-1' : 'hidden lg:block'"
                aria-label="Up next"
            >
                <PlayerUpNext />
            </aside>
        </div>
    </ModalTemplate>
</template>
