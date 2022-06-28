<script setup>
import { onMounted, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

const app = useAppStore();
const client = useClientStore();

const searchInput = ref('');
const searchType = ref('video');
const searchTypes = ref([
    { id: 'video', name: 'Video' },
    { id: 'playlist', name: 'Playlist' },
]);

const searchInputEl = ref(null);
onMounted(() => {
    searchInputEl.value.focus();
});

watch(() => searchType, () => {
    if (searchInput.value.length > 0) {
        search();
    }
});

const search = () => {
    client.sendMessage(`/playersearch yt ${searchType.value} ${searchInput.value}`);
};

const addToQueue = item => {
    if (client.state.playerApiSearchResult.type === 'video') {
        client.sendMessage(`/yt ${item.id} video`);
    } else {
        client.sendMessage(`/yt ${item.id} playlist`);
    }
};

</script>

<template>
    <vue-final-modal
        classes="modal-container"
        content-class="modal-content"
        :esc-to-close="true"
        v-slot="{ close }"
    >
        <div class="h-full w-full">

            <!-- Search input -->
            <input
                v-model="searchInput"
                ref="searchInputEl"
                type="text"
                placeholder="Search"
                class="form-control w-full"
                @keyup.enter.stop="search()"
            />

            <!-- Search type -->
            <div class="btn-group mt-2">
                <button
                    v-for="type in searchTypes"
                    :key="type.id"
                    @click="searchType = type.id"
                    class="btn"
                    :class="type.id === searchType ? 'active' : ''"
                >
                    {{ type.name }}
                </button>
            </div>

            <!-- Results -->
            <div
                v-if="client.state.playerApiSearchResult"
                class="search-results"
            >
                <HoverCard
                    v-for="item in client.state.playerApiSearchResult.items"
                    :key="item.id"
                    :selectable="true"
                    @click="addToQueue(item), close()"
                    class="cursor-pointer m-2"
                >
                    <div class="flex p-2">
                        
                        <!-- thumb -->
                        <div class="w-24">
                            <img :src="item.thumb">
                        </div>

                        <!-- informations -->
                        <div class="px-4 py-2 w-0 grow flex flex-col">
                            <div class="text-md text-bold">{{ item.title }}</div>
                        </div>
                    </div>
                </HoverCard>
            </div>
        </div>
    </vue-final-modal>
</template>

<style scoped>

@import url('./modal.css');


</style>
