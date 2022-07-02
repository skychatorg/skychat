<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useToast } from "vue-toastification";
import HoverCard from '@/components/util/HoverCard.vue';
import MediaPlayer from '@/components/player/MediaPlayer.vue';


const app = useAppStore();
const client = useClientStore();
const toast = useToast();

const showPlayer = computed(() => {
    return client.state.player.current && app.playerMode.enabled;
});

const playerHeightCss = computed(() => {
    if (! showPlayer.value) {
        return 'auto';
    }
    return {
        xs: '100px',
        sm: '20vh',
        md: '35vh',
        lg: 'calc(100vh - 450px)',
    }[app.playerMode.size];
});

</script>

<template>
    <div class="pannel group w-full flex flex-col">
        
        <!-- Pannel content -->
        <div
            class="pannel-content grow flex transition"
        >

            <!-- Actual player implementation -->
            <MediaPlayer v-if="showPlayer" class="player overflow-hidden grow" />

            <!-- If player hidden but something is playing -->
            <div
                class="w-full py-1 flex justify-center"
                v-if="! showPlayer && client.state.player.current"
            >
                <div
                    v-if="client.state.player.current.video.thumb"
                    class="mr-2 w-8 h-8 rounded-xl border border-2 overflow-hidden bg-black flex justify-center"
                    :title="client.state.player.current.video.title"
                >
                    <img :src="client.state.player.current.video.thumb" class="h-full object-cover" />
                </div>
                <div class="flex flex-col justify-center">
                    {{ client.state.player.current.video.title }}
                </div>
            </div>
        </div>

        <!-- Pannel control bar -->
        <div class="basis-12 p-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition duration-200">

            <div class="grid grid-cols-12 gap-2 text-skygray-lighter">
            
                <!-- Player type (big to disabled) -->
                <div class="col-span-4 btn-group">
                    <button
                        @click="toast.error('The cinema mode is not yet implemented.')"
                        title="Toggle cinema mode"
                        class="hidden btn text-sm"
                        :class="{ 'active': app.playerMode.cinemaMode, 'disabled': ! showPlayer }"
                    >
                        <fa icon="tv" />
                    </button>
                    <button
                        @click="app.shrinkPlayer"
                        title="Shrink player"
                        class="btn text-sm"
                        :class="{ 'disabled': app.playerMode.size === 'xs' || ! showPlayer }"
                    >
                        <fa icon="chevron-up" />
                    </button>
                    <button
                        @click="app.expandPlayer"
                        title="Expand player"
                        class="btn text-sm"
                        :class="{ 'disabled': app.playerMode.size === 'lg' || ! showPlayer }"
                    >
                        <fa icon="chevron-down" />
                    </button>
                    <button
                        @click="app.setPlayerEnabled(! app.playerMode.enabled)"
                        title="Enable/disable player"
                        class="btn text-sm"
                        :class="{ 'active': app.playerMode.enabled }"
                    >
                        <fa :icon="'toggle-' + (app.playerMode.enabled ? 'on' : 'off')" />
                    </button>
                </div>
            
                <!-- Player controls -->
                <div class="col-start-5 col-span-4 btn-group">
                    <button
                        @click="client.sendMessage(`/player replay30`)"
                        title="Replay 30 seconds"
                        class="btn text-sm"
                        :class="{
                            'disabled': ! showPlayer,
                        }"
                    >
                        <fa icon="caret-left" />
                        <fa icon="caret-left" />
                    </button>
                    <!-- <button class="btn text-sm">
                        <fa icon="caret-left" />
                    </button>
                    <button class="hidden btn text-sm">
                        <fa icon="pause" />
                    </button>
                    <button class="btn text-sm">
                        <fa icon="caret-right" />
                    </button> -->
                    <button
                        @click="client.sendMessage(`/player skip30`)"
                        title="Skip 30 seconds"
                        class="btn text-sm"
                        :class="{
                            'disabled': ! showPlayer,
                        }"
                    >
                        <fa icon="caret-right" />
                        <fa icon="caret-right" />
                    </button>
                </div>
            
                <!-- Player actions -->
                <div class="col-start-9 col-span-4 btn-group">
                    <button
                        @click="client.sendMessage('/player skip')"
                        title="Skip current video"
                        class="btn text-sm"
                        :class="{
                            'disabled': ! showPlayer,
                        }"
                    >
                        <fa icon="forward-step" />
                    </button>
                    <button
                        @click="app.toggleModal('youtubeVideoSearcher')"
                        title="Add a media from Youtube"
                        class="btn text-sm"
                    >
                        <fa icon="plus" />
                    </button>
                    <button
                        @click="app.toggleModal('playerQueue')"
                        title="Open player queue"
                        :class="{
                            'disabled': ! client.state.player.queue.length,
                        }"
                        class="btn text-sm"
                    >
                        <fa icon="list" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pannel-content {

    /* Pannel total size */
    height: v-bind(playerHeightCss);
}

.queue {
    min-width: 16rem;
    flex-basis: 16rem;
}
</style>
